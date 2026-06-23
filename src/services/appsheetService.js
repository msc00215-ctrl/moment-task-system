/**
 * AppSheet API Service
 * - AppSheet 通常同期は数秒〜十数秒のラグがある
 * - AppSheet API 経由で直接 Add すると、AppSheet は内部状態を即時更新 → クライアントへ最速反映
 * - APPSHEET_APP_ID 未設定なら no-op (Sheets 経由フォールバック)
 *
 * 参考: https://support.google.com/appsheet/answer/10105768
 *   POST https://api.appsheet.com/api/v2/apps/{appId}/tables/{tableName}/Action
 *   Header: ApplicationAccessKey
 */
const { env, credentials } = require('../config');
const { withRetry } = require('../utils/retry');
const { logger } = require('../utils/logger');

const BASE = 'https://api.appsheet.com/api/v2/apps';

/**
 * AppSheet 経由で行を追加 (即時同期)
 * @param {string} tableName - AppSheet 上のテーブル名 (例: 'Tasks')
 * @param {object} row - { ColumnName: value } 形式
 * @returns {Promise<boolean>} 成功 true / 設定なし or 失敗時 false (呼び出し側でフォールバック)
 */
async function addRow(tableName, row) {
  if (!env.APPSHEET_APP_ID) return false;
  let accessKey;
  try {
    accessKey = await credentials.appsheetAccessKey();
  } catch {
    logger.warn('AppSheet access key 未設定 — Sheets 経由にフォールバック');
    return false;
  }

  const url = `${BASE}/${env.APPSHEET_APP_ID}/tables/${encodeURIComponent(tableName)}/Action`;
  const body = {
    Action: 'Add',
    Properties: { Locale: 'ja-JP', Timezone: 'Asia/Tokyo' },
    Rows: [row],
  };

  try {
    const res = await withRetry(
      () =>
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ApplicationAccessKey: accessKey,
          },
          body: JSON.stringify(body),
        }),
      {
        retries: 2,
        shouldRetry: (err) => err.code === 'ETIMEDOUT' || /5\d\d/.test(String(err.status)),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn({ status: res.status, body: text }, 'AppSheet API 失敗 — フォールバック');
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err: err.message }, 'AppSheet API 例外 — フォールバック');
    return false;
  }
}

module.exports = { addRow };
