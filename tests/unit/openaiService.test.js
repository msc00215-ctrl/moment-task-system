/**
 * openaiService のテスト
 * OpenAI SDK はモックに差し替える
 */

// OpenAI クライアントをモック
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

// 環境変数
process.env.OPENAI_API_KEY = 'test-key';

jest.resetModules();
const OpenAI = require('openai');
const { extractTasks, generateJuniorResponse, extractEquipmentInfo } = require('../../src/services/openaiService');

let mockCreate;

beforeEach(() => {
  jest.clearAllMocks();
  const instance = new OpenAI();
  mockCreate = instance.chat.completions.create;
  OpenAI.mockImplementation(() => ({ chat: { completions: { create: mockCreate } } }));
});

function makeCompletion(content) {
  return { choices: [{ message: { content } }] };
}

describe('extractTasks', () => {
  test('タスクを正常抽出', async () => {
    mockCreate.mockResolvedValueOnce(
      makeCompletion(JSON.stringify({ tasks: [{ task: 'テント設営', assignee: 'hajime', department: '設営', deadline: '2026-07-01', area: null, priority: '中', status: '未着手' }] }))
    );
    const result = await extractTasks('hajimeさん、テント設営お願いします', '設営グループ');
    expect(result).toHaveLength(1);
    expect(result[0].task).toBe('テント設営');
    expect(result[0].assignee).toBe('hajime');
  });

  test('タスクなしの場合は空配列', async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify({ tasks: [] })));
    const result = await extractTasks('おはようございます！');
    expect(result).toEqual([]);
  });

  test('空文字列は即座に空配列を返す', async () => {
    const result = await extractTasks('');
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('OpenAI がエラーを返した場合も空配列（例外を投げない）', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API error'));
    const result = await extractTasks('テスト');
    expect(result).toEqual([]);
  });

  test('不正な JSON は空配列', async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion('not json'));
    const result = await extractTasks('テスト');
    expect(result).toEqual([]);
  });
});

describe('generateJuniorResponse', () => {
  test('関西弁の返答を返す', async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion('発電機は電源エリアのコンテナやで！🔌'));
    const result = await generateJuniorResponse('ジュニア、発電機どこ？', 'テストグループ', {
      equipment: [{ item: '発電機', location: '電源エリアコンテナ', department: '電源', quantity: 2, unit: '台' }],
      staff: [],
    });
    expect(result).toBe('発電機は電源エリアのコンテナやで！🔌');
  });

  test('空文字列は null を返す', async () => {
    const result = await generateJuniorResponse('');
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('APIエラー時は null（例外を投げない）', async () => {
    mockCreate.mockRejectedValueOnce(new Error('rate limit'));
    const result = await generateJuniorResponse('ジュニア、テストやで');
    expect(result).toBeNull();
  });
});

describe('extractEquipmentInfo', () => {
  test('備品情報を正常抽出', async () => {
    const mockInfo = { found: true, item: 'テント', category: '設営資材', quantity: 3, unit: '張', location: '設営エリアA倉庫', department: '設営', notes: null };
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify(mockInfo)));
    const result = await extractEquipmentInfo('ジュニア、テント3張は設営エリアのA倉庫にあるよ');
    expect(result.found).toBe(true);
    expect(result.item).toBe('テント');
    expect(result.location).toBe('設営エリアA倉庫');
  });

  test('備品情報が含まれない場合は found:false', async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify({ found: false })));
    const result = await extractEquipmentInfo('ジュニア、音響の担当誰？');
    expect(result.found).toBe(false);
  });

  test('空文字列は即座に found:false', async () => {
    const result = await extractEquipmentInfo('');
    expect(result).toEqual({ found: false });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('APIエラー時は found:false（例外を投げない）', async () => {
    mockCreate.mockRejectedValueOnce(new Error('timeout'));
    const result = await extractEquipmentInfo('テスト');
    expect(result).toEqual({ found: false });
  });
});
