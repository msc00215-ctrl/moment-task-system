/**
 * gasService のテスト
 * fetch はグローバルモックで差し替える
 */

// fetch をモックに差し替え
global.fetch = jest.fn();

// 環境変数をテスト用に設定
process.env.GAS_WEBHOOK_URL   = 'https://gas.example.com/exec';
process.env.GAS_SECRET_TOKEN  = 'test-secret';

// モジュールキャッシュをクリアしてから require（環境変数を読むタイミングを制御）
jest.resetModules();
const { postToGas, getSheetData } = require('../../src/services/gasService');

beforeEach(() => {
  fetch.mockReset();
});

describe('postToGas', () => {
  test('成功時は true を返す', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    const result = await postToGas({ type: 'lineLog', messages: [] });
    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('https://gas.example.com/exec');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.secret).toBe('test-secret');
    expect(body.type).toBe('lineLog');
  });

  test('GAS が 4xx を返した場合は false', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 403 });
    const result = await postToGas({ type: 'task' });
    expect(result).toBe(false);
  });

  test('ネットワークエラー時は false を返す（例外は投げない）', async () => {
    fetch.mockRejectedValueOnce(new Error('network error'));
    const result = await postToGas({ type: 'task' });
    expect(result).toBe(false);
  });
});

describe('getSheetData', () => {
  test('equipment データを正常取得', async () => {
    const mockData = [{ item: 'テント', location: '倉庫A' }];
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: mockData }),
    });
    const result = await getSheetData('equipment');
    expect(result).toEqual(mockData);
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('type=equipment');
    expect(url).toContain('secret=test-secret');
  });

  test('GAS が ok:false を返した場合は空配列', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false }),
    });
    const result = await getSheetData('staff');
    expect(result).toEqual([]);
  });

  test('ネットワークエラー時はキャッシュまたは空配列', async () => {
    fetch.mockRejectedValueOnce(new Error('timeout'));
    const result = await getSheetData('equipment');
    expect(Array.isArray(result)).toBe(true);
  });
});
