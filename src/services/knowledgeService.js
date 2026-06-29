/**
 * Knowledge Service
 * 工程表スプシの全シートを読み込み、Q&A用のテキストコンテキストを構築する
 * - 5分キャッシュ（頻繁な API 呼び出しを防止）
 * - 優先シートを先に読み、合計トークン数を抑制
 */
const { getSheetsClient } = require('../utils/googleAuth');
const { logger } = require('../utils/logger');

const SS_MAIN = process.env.SPREADSHEET_ID || '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分

// 優先して読む重要シート（小さくて重要なものを先頭に）
const PRIORITY_SHEETS = [
  '🏠 コテージ割り',          // 12行・小さい・よく聞かれる
  '🎵 ゲート・音楽時間',       // 6行・小さい
  '🎟️ リストバンド・証明書',   // 5行・小さい
  '👶 キッズエリア',           // 8行・小さい
  '🍽️ 賄い 食数管理',         // 27行
  '📦 備品・資材DB',
  '📚 確定知識ベース',
  '🛍️ 出店リスト',
  '👥 ボランティア名簿',
  '🎤 アーティスト管理',
  '🟢 MOMENT設営 工程表',
  '📋 全体スケジュール',
  '📱 LINEリアルタイム',
];

// 除外シート（大量データ・機密・不要）
const SKIP_SHEETS = [
  '📊 タスク連携', '✅ 完了タスク', '👤 スタッフ管理表',
  '🧑‍🤝‍🧑 ボランティア配置', '📋 タスク（現役）',
];

// 各シートの最大読み取り行数（トークン節約）
const MAX_ROWS_PER_SHEET = 60;

let cache = null;
let cacheTime = 0;

/**
 * 全シートの内容をテキスト形式で返す（キャッシュ付き）
 * @returns {Promise<string>} Q&Aコンテキスト文字列
 */
async function getKnowledgeContext() {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL_MS) {
    return cache;
  }

  try {
    const sheets = await getSheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SS_MAIN });
    const allTitles = meta.data.sheets.map(s => s.properties.title);

    // 優先シートを先に、その後残りのシート（SKIP以外）
    const skipSet = new Set(SKIP_SHEETS);
    const prioritySet = new Set(PRIORITY_SHEETS);
    const ordered = [
      ...PRIORITY_SHEETS.filter(t => allTitles.includes(t)),
      ...allTitles.filter(t => !prioritySet.has(t) && !skipSet.has(t)),
    ];

    const sections = [];
    let totalRows = 0;

    for (const title of ordered) {
      if (totalRows > 800) break; // 合計行数上限
      try {
        const r = await sheets.spreadsheets.values.get({
          spreadsheetId: SS_MAIN,
          range: `'${title}'!A1:J${MAX_ROWS_PER_SHEET}`,
          valueRenderOption: 'FORMATTED_VALUE',
        });
        const rows = (r.data.values || []).filter(row => row.some(c => c && String(c).trim()));
        if (rows.length === 0) continue;

        const rowTexts = rows.map(row => row.join(' | '));
        sections.push(`【${title}】\n${rowTexts.join('\n')}`);
        totalRows += rows.length;
      } catch (e) {
        logger.warn({ title, err: e.message }, 'シート読み取りスキップ');
      }
    }

    cache = sections.join('\n\n');
    cacheTime = now;
    logger.info({ sheets: sections.length, rows: totalRows }, 'ナレッジキャッシュ更新完了');
    return cache;
  } catch (err) {
    logger.error({ err: err.message }, 'ナレッジ取得失敗');
    return cache || '（スプレッドシートの読み込みに失敗しました）';
  }
}

/**
 * 📦 備品・資材DB に新しい行を追加する
 */
async function addEquipmentItem({ category, name, location, quantity, assignee, status, notes }) {
  try {
    const sheets = await getSheetsClient();
    const row = [
      category || 'その他',
      name || '',
      location || '',
      quantity || '',
      assignee || '',
      status || '📝未確認',
      notes || '',
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SS_MAIN,
      range: "'📦 備品・資材DB'!A:G",
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
    // キャッシュを無効化（新データを反映させるため）
    cache = null;
    cacheTime = 0;
    logger.info({ name, location }, '備品DB に追加完了');
    return true;
  } catch (err) {
    logger.error({ err: err.message }, '備品DB 追加失敗');
    return false;
  }
}

/**
 * キャッシュを強制リフレッシュ
 */
function invalidateCache() {
  cache = null;
  cacheTime = 0;
}

module.exports = { getKnowledgeContext, addEquipmentItem, invalidateCache };
