/**
 * lineWebhook ハンドラのテスト
 * 外部依存はすべてモック（OpenAI / GAS / LINE API / 署名検証）
 */

jest.mock('../../src/middleware/lineSignature', () => ({
  verifyLineSignature: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/openaiService', () => ({
  extractTasks:          jest.fn().mockResolvedValue([]),
  generateJuniorResponse: jest.fn().mockResolvedValue(null),
  extractEquipmentInfo:  jest.fn().mockResolvedValue({ found: false }),
}));

jest.mock('../../src/services/gasService', () => ({
  postToGas:    jest.fn().mockResolvedValue(true),
  getSheetData: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/services/lineService', () => ({
  reply:           jest.fn().mockResolvedValue(undefined),
  getClient:       jest.fn().mockResolvedValue({ getGroupSummary: jest.fn().mockResolvedValue({ groupName: 'テストグループ' }) }),
  getChannelSecret: jest.fn().mockResolvedValue('secret'),
}));

jest.mock('../../src/config', () => ({
  assertRequired: jest.fn(),
  env: { GAS_WEBHOOK_URL: 'https://gas.example.com', GAS_SECRET_TOKEN: 'test' },
  credentials: {
    lineChannelAccessToken: jest.fn().mockResolvedValue('token'),
    lineChannelSecret: jest.fn().mockResolvedValue('secret'),
    openaiApiKey: jest.fn().mockResolvedValue('key'),
  },
}));

const { handleWebhook } = require('../../src/handlers/lineWebhook');
const { extractTasks, generateJuniorResponse, extractEquipmentInfo } = require('../../src/services/openaiService');
const { postToGas, getSheetData } = require('../../src/services/gasService');
const { reply } = require('../../src/services/lineService');
const { verifyLineSignature } = require('../../src/middleware/lineSignature');

function makeReq(text, options = {}) {
  return {
    ip: '127.0.0.1',
    headers: { 'x-line-signature': 'valid' },
    get: (h) => (h === 'x-line-signature' ? 'valid' : undefined),
    rawBody: Buffer.from('test'),
    body: {
      events: [{
        type: 'message',
        message: { type: 'text', text },
        replyToken: options.replyToken ?? 'reply-token-123',
        timestamp: Date.now(),
        source: {
          type: options.sourceType ?? 'group',
          userId: options.userId ?? 'U123',
          groupId: options.groupId ?? 'C456',
        },
      }],
    },
  };
}

function makeRes() {
  const res = { status: jest.fn(), send: jest.fn(), headersSent: false };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  extractTasks.mockResolvedValue([]);
  generateJuniorResponse.mockResolvedValue(null);
  extractEquipmentInfo.mockResolvedValue({ found: false });
  postToGas.mockResolvedValue(true);
  getSheetData.mockResolvedValue([]);
  reply.mockResolvedValue(undefined);
  verifyLineSignature.mockResolvedValue(true);
});

describe('handleWebhook — 基本動作', () => {
  test('署名検証失敗 → 401', async () => {
    verifyLineSignature.mockResolvedValueOnce(false);
    const req = makeReq('テスト');
    const res = makeRes();
    await handleWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('イベントなし → 200 だが処理なし', async () => {
    const req = { ...makeReq(''), body: { events: [] }, get: () => 'valid', ip: '127.0.0.1', rawBody: Buffer.from('test') };
    const res = makeRes();
    await handleWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(extractTasks).not.toHaveBeenCalled();
  });
});

describe('handleWebhook — 通常メッセージ（ジュニア未呼び出し）', () => {
  test('全メッセージはログ記録される', async () => {
    const req = makeReq('明日9時集合やで');
    const res = makeRes();
    await handleWebhook(req, res);
    await new Promise(r => setTimeout(r, 50));
    expect(postToGas).toHaveBeenCalledWith(expect.objectContaining({ type: 'lineLog' }));
  });

  test('タスク抽出は常に実行される', async () => {
    const req = makeReq('田中さんテント設営よろしく');
    const res = makeRes();
    await handleWebhook(req, res);
    await new Promise(r => setTimeout(r, 50));
    expect(extractTasks).toHaveBeenCalledWith('田中さんテント設営よろしく', expect.any(String));
  });

  test('ジュニアが呼ばれていない場合は返答なし', async () => {
    const req = makeReq('明日9時集合やで');
    const res = makeRes();
    await handleWebhook(req, res);
    await new Promise(r => setTimeout(r, 50));
    expect(reply).not.toHaveBeenCalled();
  });

  test('タスクが抽出された場合はGASに送信', async () => {
    extractTasks.mockResolvedValueOnce([{ task: 'テント設営', assignee: 'hajime', department: '設営', deadline: null, area: null, priority: '中', status: '未着手' }]);
    const req = makeReq('hajimeさん、テント設営お願い');
    const res = makeRes();
    await handleWebhook(req, res);
    await new Promise(r => setTimeout(r, 50));
    expect(postToGas).toHaveBeenCalledWith(expect.objectContaining({ type: 'task' }));
  });
});

describe('handleWebhook — ジュニア呼び出し', () => {
  test('ジュニア呼び出し → generateJuniorResponse が呼ばれる', async () => {
    generateJuniorResponse.mockResolvedValueOnce('発電機は電源エリアやで！');
    const req = makeReq('ジュニア、発電機どこ？');
    const res = makeRes();
    await handleWebhook(req, res);
    await new Promise(r => setTimeout(r, 50));
    expect(generateJuniorResponse).toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith('reply-token-123', '発電機は電源エリアやで！', 'U123');
  });

  test('出店情報も含めて Junior に渡される', async () => {
    const mockVendors = [{ name: 'コーヒー屋', category: 'ドリンク', location: 'エントランス横', hours: '10:00-22:00', menu: 'コーヒー/ラテ', contact: '', notes: '' }];
    getSheetData.mockImplementation(type => Promise.resolve(type === 'vendor' ? mockVendors : []));
    generateJuniorResponse.mockResolvedValueOnce('エントランス横のコーヒー屋さんやで！10時から22時まで🍵');
    const req = makeReq('ジュニア、コーヒーどこで買える？');
    const res = makeRes();
    await handleWebhook(req, res);
    await new Promise(r => setTimeout(r, 50));
    const callArgs = generateJuniorResponse.mock.calls[0];
    expect(callArgs[2].vendors).toEqual(mockVendors);
    expect(reply).toHaveBeenCalledWith('reply-token-123', expect.stringContaining('コーヒー'), 'U123');
  });

  test('備品情報あり → GASに登録して確認返信', async () => {
    extractEquipmentInfo.mockResolvedValueOnce({
      found: true, item: '発電機', location: '電源エリアコンテナ',
      category: '電源機材', quantity: 2, unit: '台', department: '電源', notes: null,
    });
    const req = makeReq('ジュニア、発電機は電源エリアコンテナに2台あるで');
    const res = makeRes();
    await handleWebhook(req, res);
    await new Promise(r => setTimeout(r, 50));
    expect(postToGas).toHaveBeenCalledWith(expect.objectContaining({ type: 'equipment', item: '発電機' }));
    expect(reply).toHaveBeenCalledWith('reply-token-123', expect.stringContaining('発電機'), 'U123');
    expect(generateJuniorResponse).not.toHaveBeenCalled();
  });

  test('備品情報なし → Q&Aへ進む', async () => {
    extractEquipmentInfo.mockResolvedValueOnce({ found: false });
    generateJuniorResponse.mockResolvedValueOnce('それはまだわからんわ！');
    const req = makeReq('ジュニア、今日の天気は？');
    const res = makeRes();
    await handleWebhook(req, res);
    await new Promise(r => setTimeout(r, 50));
    expect(generateJuniorResponse).toHaveBeenCalled();
  });

  test('ジュニア応答が null の場合は reply しない', async () => {
    generateJuniorResponse.mockResolvedValueOnce(null);
    const req = makeReq('ジュニア、テスト');
    const res = makeRes();
    await handleWebhook(req, res);
    await new Promise(r => setTimeout(r, 50));
    expect(reply).not.toHaveBeenCalled();
  });
});
