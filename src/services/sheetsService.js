/**
 * Google Sheets Service
 * - シングルトン Sheets クライアントを保持
 * - 認証は ADC (Application Default Credentials) を利用
 *   - Cloud Functions / App Engine ではアタッチされたサービスアカウントが自動使用される
 *   - 必要スコープ: https://www.googleapis.com/auth/spreadsheets
 *
 * AppSheet 同期速度の考え方:
 * - AppSheet は Sheet 変更を検知 → Server-side Sync が走る
 * - 書き込み回数を最小化 (batchUpdate / append を 1 リクエストで)
 * - Read もキャッシュ層で減らす (User / Area マスタは滅多に変わらない)
 */
const { getSheetsClient: _getSheetsClient } = require('../utils/googleAuth');
const { env } = require('../config');
const { withRetry } = require('../utils/retry');

let cachedSheets;

async function getSheetsClient() {
  if (cachedSheets) return cachedSheets;
  cachedSheets = await _getSheetsClient();
  return cachedSheets;
}

/**
 * シート全体を読む。ヘッダ行込みで返す。
 * @param {string} range - 例: 'Users!A:Z'
 */
async function readRange(range) {
  const sheets = await getSheetsClient();
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range,
      majorDimension: 'ROWS',
      valueRenderOption: 'UNFORMATTED_VALUE', // 日付などの型を保つ
    }),
  );
  return res.data.values || [];
}

/**
 * 単一行を末尾追記。AppSheet 同期は append 完了後すぐ走るので USER_ENTERED で書く。
 * @param {string} sheetName - 例: 'Tasks'
 * @param {Array<unknown>} row - 値の配列
 */
async function appendRow(sheetName, row) {
  const sheets = await getSheetsClient();
  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: env.SPREADSHEET_ID,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    }),
  );
}

/**
 * 複数行をまとめて書く (バッチ追記)。AppSheet 同期 1 回で済む。
 */
async function appendRows(sheetName, rows) {
  if (!rows.length) return;
  const sheets = await getSheetsClient();
  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: env.SPREADSHEET_ID,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    }),
  );
}

module.exports = { readRange, appendRow, appendRows };
