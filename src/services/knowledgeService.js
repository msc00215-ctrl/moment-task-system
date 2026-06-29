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

// キーワード → 読むべきシート のマッピング
const SHEET_KEYWORD_MAP = [
  {
    keywords: ['コテージ', 'cottage', '号室', '棟', '宿泊', '部屋割'],
    sheets: ['🏠 コテージ割り'],
  },
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
    keywords: ['アーティスト', 'artist', 'DJ', '出演', 'performer', 'ライブ'],
    sheets: ['🎤 アーティスト管理'],
  },
  {
    keywords: ['工程', '設営', '撤収', '日程', 'スケジュール', '段取り'],
    sheets: ['🟢 MOMENT設営 工程表', '📋 全体スケジュール'],
  },
  {
    keywords: ['スタッフ', '担当', '入り時間', '到着', '連絡先'],
    sheets: ['👥 ボランティア名簿', '📋 全体スケジュール'],
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
 * 質問に応じた関連シートを丸ごと読んでコンテキストを返す
 * @param {string} question - ユーザーの質問文
 * @returns {Promise<string>}
 */
async function getRelevantContext(question) {
  const sheets = await getSheetsClient();
  const q = question || '';

  // キーワードマッチで関連シートを特定
  const matched = new Set();
  for (const { keywords, sheets: targets } of SHEET_KEYWORD_MAP) {
    if (keywords.some(kw => q.includes(kw))) {
      targets.forEach(t => matched.add(t));
    }
  }

  // マッチしたシートを読む（全行）
  const sections = [];
  if (matched.size > 0) {
    for (const title of matched) {
      const text = await readSheet(sheets, title, 500);
      if (text) sections.push(text);
    }
    logger.info({ matched: [...matched] }, 'Q&A: キーワードマッチシート読み込み');
  }

  // 確定知識ベースは常に追加（最大200行）
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

module.exports = { getKnowledgeContext, getRelevantContext, addEquipmentItem, invalidateCache };
