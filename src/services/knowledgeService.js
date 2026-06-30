/**
 * Knowledge Service
 * 質問内容に応じて関連シートを丸ごと読み込んでコンテキストを構築する。
 * - 全シート一括読み込みではなく「質問→関連シート特定→フル読み込み」方式
 * - 関連シートが特定できない場合は 📚 確定知識ベース を全行読む
 */
const { getSheetsClient } = require('../utils/googleAuth');
const { logger } = require('../utils/logger');

const SS_MAIN = process.env.SPREADSHEET_ID || '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY';
const CACHE_TTL_MS = 5 * 60 * 1000;

// 通常ジュニア用キーワードマップ（機密シートは除外）
const SHEET_KEYWORD_MAP = [
  {
    keywords: ['ゲート', '音楽', '開場', '閉場', '音スタート', '音エンド', 'アルコール禁止'],
    sheets: ['🎵 ゲート・音楽時間'],
  },
  {
    keywords: ['キッズ', '子供', '子ども', '託児', '保育', 'kids'],
    sheets: ['👶 キッズエリア'],
  },
  {
    keywords: ['リストバンド', 'wristband', '腕輪', '証明書', '関係者'],
    sheets: ['🎟️ リストバンド・証明書'],
  },
  {
    keywords: ['賄い', '食事', '昼食', '夕食', '朝食', '食数', '弁当', '飯'],
    sheets: ['🍽️ 賄い 食数管理'],
  },
  {
    keywords: ['備品', '資材', '道具', '機材', 'ケーブル', 'テーブル', '椅子'],
    sheets: ['📦 備品・資材DB'],
  },
  {
    keywords: ['出店', 'shop', 'ショップ', '店舗', '搬入', '出展', '露店'],
    sheets: ['🛍️ 出店リスト'],
  },
  {
    keywords: ['ボランティア', 'volunteer', '名簿', '在場', '人数'],
    sheets: ['👥 ボランティア名簿'],
  },
  {
    keywords: ['工程', '設営', '撤収', '日程', 'スケジュール', '段取り'],
    sheets: ['🟢 MOMENT設営 工程表', '📋 全体スケジュール'],
  },
  {
    keywords: ['スタッフ', '担当', '入り時間', '到着'],
    sheets: ['👥 ボランティア名簿', '📋 全体スケジュール'],
  },
];

// コアスタッフ専用キーワードマップ（機密シートを含む全シート）
const CORE_SHEET_KEYWORD_MAP = [
  ...SHEET_KEYWORD_MAP,
  {
    keywords: ['コテージ', 'cottage', '号室', '棟', '宿泊', '部屋割'],
    sheets: ['🏠 コテージ割り'],
  },
  {
    keywords: ['アーティスト', 'artist', 'DJ', '出演', 'performer', 'ライブ', 'ケア', 'rider'],
    sheets: ['🎤 アーティスト管理'],
  },
];

// 除外シート
const SKIP_SHEETS = new Set([
  '📊 タスク連携', '✅ 完了タスク', '👤 スタッフ管理表',
  '🧑‍🤝‍🧑 ボランティア配置', '📋 タスク（現役）',
]);

// シートごとのキャッシュ（シート名 → {text, time}）
const sheetCache = new Map();

async function readSheet(sheets, title, maxRows = 500) {
  const cached = sheetCache.get(title);
  if (cached && (Date.now() - cached.time) < CACHE_TTL_MS) return cached.text;

  try {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SS_MAIN,
      range: `'${title}'!A1:J${maxRows}`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (r.data.values || []).filter(row => row.some(c => c && String(c).trim()));
    const text = rows.length > 0 ? `【${title}】\n${rows.map(row => row.join(' | ')).join('\n')}` : '';
    sheetCache.set(title, { text, time: Date.now() });
    return text;
  } catch (e) {
    logger.warn({ title, err: e.message }, 'シート読み取りスキップ');
    return '';
  }
}

/**
 * キーワードマップから関連シートを読み込む共通処理
 */
async function readMatchedSheets(sheets, question, keywordMap) {
  const q = question || '';
  const matched = new Set();
  for (const { keywords, sheets: targets } of keywordMap) {
    if (keywords.some(kw => q.includes(kw))) {
      targets.forEach(t => matched.add(t));
    }
  }
  const sections = [];
  if (matched.size > 0) {
    for (const title of matched) {
      const text = await readSheet(sheets, title, 500);
      if (text) sections.push(text);
    }
    logger.info({ matched: [...matched] }, 'Q&A: シート読み込み');
  }
  return sections;
}

/**
 * 通常ジュニア用コンテキスト（機密シート除外）
 */
async function getRelevantContext(question) {
  const sheets = await getSheetsClient();
  const sections = await readMatchedSheets(sheets, question, SHEET_KEYWORD_MAP);
  const kbText = await readSheet(sheets, '📚 確定知識ベース', 200);
  if (kbText) sections.push(kbText);
  return sections.join('\n\n');
}

/**
 * コアスタッフ専用コンテキスト（機密シート含む全シート）
 */
async function getCoreContext(question) {
  const sheets = await getSheetsClient();
  const sections = await readMatchedSheets(sheets, question, CORE_SHEET_KEYWORD_MAP);
  const kbText = await readSheet(sheets, '📚 確定知識ベース', 200);
  if (kbText) sections.push(kbText);
  return sections.join('\n\n');
}

/**
 * 後方互換: 全体コンテキスト（備品登録等で使用）
 */
async function getKnowledgeContext() {
  return getRelevantContext('');
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
    sheetCache.delete('📦 備品・資材DB');
    logger.info({ name, location }, '備品DB に追加完了');
    return true;
  } catch (err) {
    logger.error({ err: err.message }, '備品DB 追加失敗');
    return false;
  }
}

function invalidateCache() {
  sheetCache.clear();
}

module.exports = { getKnowledgeContext, getRelevantContext, getCoreContext, addEquipmentItem, invalidateCache };
