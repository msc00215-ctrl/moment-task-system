/**
 * Q&A Service
 * LINEメッセージが「質問」かどうかを判定し、
 * スプレッドシートのデータを元にOpenAIが自然言語で回答する
 *
 * ■ 備品登録フロー
 *   スタッフが「備品登録: 品名, 場所, 数量」形式で送ると📦備品DBに自動追記
 */
const OpenAI = require('openai');
const { credentials } = require('../config');
const { withRetry } = require('../utils/retry');
const { logger } = require('../utils/logger');
const { getKnowledgeContext, getRelevantContext, addEquipmentItem } = require('./knowledgeService');

let cachedClient;

async function getClient() {
  if (cachedClient) return cachedClient;
  const apiKey = await credentials.openaiApiKey();
  cachedClient = new OpenAI({ apiKey, timeout: 20_000 });
  return cachedClient;
}

// 質問と判定するキーワード
const QUESTION_MARKERS = [
  'どこ', 'どこに', 'どこの', 'どこで', 'どこへ',
  '何時', 'なんじ', 'いつ', '何時から', '何時まで',
  '誰が', 'だれが', '誰', '担当',
  '何個', '何本', '何台', '何枚', '何名', '何食',
  '教えて', 'おしえて', 'わかる？', 'わかりますか', 'ある？', 'ありますか',
  '？', '?',
  'どうやって', 'どうする', 'どうなってる', 'どうなった',
  '確認', 'かくにん', '場所', 'ばしょ',
  '何', 'なに', 'どれ', 'どう',
];

// 備品登録コマンドのパターン
const EQUIPMENT_REGISTER_PATTERN = /^備品登録[：:]\s*(.+)$/m;

/**
 * メッセージが質問かどうかを判定
 */
function isQuestion(text) {
  if (!text) return false;
  return QUESTION_MARKERS.some(marker => text.includes(marker));
}

/**
 * 「備品登録: 品名, 場所, 数量[, 担当者][, 備考]」コマンドを解析
 */
function parseEquipmentRegister(text) {
  const match = text.match(EQUIPMENT_REGISTER_PATTERN);
  if (!match) return null;
  const parts = match[1].split(/[,，、]/).map(s => s.trim());
  return {
    name: parts[0] || '',
    location: parts[1] || '',
    quantity: parts[2] || '',
    assignee: parts[3] || '',
    notes: parts[4] || '',
  };
}

const QA_SYSTEM_PROMPT = `あなたはMOMENT 2026（奈良・洞川キャンプ場、7/3〜7/5開催）の運営AIアシスタント「ジュニア」です。
スタッフからの質問にスプレッドシートの情報を元に簡潔に答えてください。

【回答ルール】
- 返答は短く、要点だけ（3〜5行以内が理想）
- 絵文字を適度に使って読みやすく
- スプシに情報があれば具体的な数値・場所・担当者名を答える
- 情報が見つからない場合は「スプシに情報がありません。\n📦備品追加するなら: 備品登録: 品名, 保管場所, 数量」と返す
- タメ口気味でフレンドリーに（でもフォーマルすぎない）

【スプレッドシートデータ】
{KNOWLEDGE}`;

/**
 * Q&A モードで回答を生成
 * @param {string} question - スタッフからの質問
 * @param {string} senderName - 送信者名（あれば）
 * @returns {Promise<string|null>} 回答文字列、またはnull（回答不要の場合）
 */
async function answerQuestion(question, senderName = '') {
  try {
    const knowledge = await getRelevantContext(question);
    const client = await getClient();

    const systemPrompt = QA_SYSTEM_PROMPT.replace('{KNOWLEDGE}', knowledge);

    const completion = await withRetry(
      () => client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: senderName ? `${senderName}：${question}` : question },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
      { retries: 2 }
    );

    const answer = completion.choices?.[0]?.message?.content?.trim();
    if (!answer) return null;

    return answer;
  } catch (err) {
    logger.error({ err: err.message }, 'Q&A 回答生成失敗');
    return '🙏 ちょっと調べてみたけどわかりませんでした。スプシ直接確認してみて！';
  }
}

module.exports = { isQuestion, parseEquipmentRegister, answerQuestion };
