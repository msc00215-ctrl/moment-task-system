/**
 * Decision Extractor
 * LINEメッセージから「決定事項・重要情報」を自動抽出して
 * 📚 確定知識ベース シートに追記する（複利型自動学習）
 */

const Anthropic = require('@anthropic-ai/sdk');
const { getSheetsClient } = require('../utils/googleAuth');
const { credentials } = require('../config');
const { withRetry } = require('../utils/retry');
const { logger } = require('../utils/logger');

const SS_MAIN = process.env.SPREADSHEET_ID || '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY';
const SHEET = '📚 確定知識ベース';

// 決定・確定を示すキーワード
const DECISION_MARKERS = [
  '決まりました', '決まった', 'に決定', '確定です', '確定しました', 'に確定',
  'になりました', 'になります', 'です！', 'でした！',
  '変更になりました', '変更です', '変更しました',
  '〜になった', 'となりました', 'とします', 'ことになりました',
  '連絡です', 'お知らせです', 'ご確認ください',
  '時間が決まりました', '場所が決まりました',
];

// カテゴリ自動判定キーワード
const CATEGORY_MAP = [
  { keywords: ['時間', '時刻', '〜時', '開始', '終了', 'スタート', 'ゲート'], cat: 'タイムスケジュール' },
  { keywords: ['場所', 'どこ', 'エリア', 'ゾーン', '会場', '倉庫', 'テント'], cat: '場所・配置' },
  { keywords: ['人数', '名', 'スタッフ', 'ボランティア', '担当'], cat: 'スタッフ・人数' },
  { keywords: ['備品', '資材', '機材', '道具', 'ケーブル', 'テーブル', '椅子'], cat: '備品・資材' },
  { keywords: ['食事', '賄い', '食数', '弁当', '昼食', '夕食'], cat: '賄い・食事' },
  { keywords: ['出店', 'ショップ', '店舗', '搬入', '搬出'], cat: '出店' },
  { keywords: ['ルール', '禁止', '注意', '持ち込み', '入場', '退場'], cat: 'ルール・注意事項' },
  { keywords: ['予算', '費用', '円', 'コスト', '支払い', '請求'], cat: '予算・費用' },
  { keywords: ['天気', '天候', '雨', '台風', '中止', '延期'], cat: '天気・中止条件' },
];

function detectCategory(text) {
  for (const { keywords, cat } of CATEGORY_MAP) {
    if (keywords.some(kw => text.includes(kw))) return cat;
  }
  return 'その他';
}

function isDecisionMessage(text) {
  if (!text || text.length < 10) return false;
  if (text.includes('？') || text.includes('?')) return false;
  return DECISION_MARKERS.some(marker => text.includes(marker));
}

let claudeClient;
async function getClaude() {
  if (claudeClient) return claudeClient;
  const apiKey = await credentials.anthropicApiKey();
  claudeClient = new Anthropic({ apiKey });
  return claudeClient;
}

let sheetsClient;
async function getSheets() {
  if (sheetsClient) return sheetsClient;
  sheetsClient = await getSheetsClient();
  return sheetsClient;
}

const EXTRACT_PROMPT = `あなたはMOMENT 2026の運営AIです。
LINEメッセージから「確定した事実・決定事項」を抽出してください。

【ルール】
- 「決まった」「確定」「になりました」系の事実のみ抽出
- 1〜3文の簡潔な事実文にまとめる
- 数値・時刻・固有名詞はそのまま残す
- タスク指示（「〜してください」）は抽出しない
- 確定事項がなければ空文字列を返す

【出力形式 - JSONのみ、コードブロック不要】
{"fact": "抽出した事実（確定事項がない場合は空文字列）", "category": "カテゴリ名"}`;

/**
 * LINEメッセージから決定事項を抽出してシートに保存
 */
async function extractAndSaveDecision(text, groupName) {
  if (!isDecisionMessage(text)) return false;

  try {
    const claude = await getClaude();
    const response = await withRetry(
      () => claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: EXTRACT_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
      { retries: 1 }
    );

    const content = response.content?.[0]?.text;
    if (!content) return false;

    const jsonStr = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(jsonStr);
    const fact = parsed.fact?.trim();
    if (!fact) return false;

    const category = parsed.category || detectCategory(text);
    const timestamp = new Date().toISOString();

    const sheets = await getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SS_MAIN,
      range: `'${SHEET}'!A:D`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[timestamp, category, fact, groupName]] },
    });

    logger.info({ category, fact: fact.slice(0, 50) }, '確定知識ベースに追記');
    return true;
  } catch (err) {
    logger.warn({ err: err.message }, '決定事項抽出スキップ');
    return false;
  }
}

module.exports = { extractAndSaveDecision, isDecisionMessage };
