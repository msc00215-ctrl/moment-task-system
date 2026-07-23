/**
 * Q&A Service (Anthropic Claude / OAuth対応)
 * OAuthトークンは期限切れ時に自動リフレッシュ
 */
const { withTokenRefresh } = require('../utils/anthropicOAuth');
const { withRetry } = require('../utils/retry');
const { logger } = require('../utils/logger');
const { getRelevantContext } = require('./knowledgeService');

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

const EQUIPMENT_REGISTER_PATTERN = /^備品登録[：:]\s*(.+)$/m;

function isQuestion(text) {
  if (!text) return false;
  return QUESTION_MARKERS.some(marker => text.includes(marker));
}

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

async function answerQuestion(question, senderName = '') {
  try {
    const knowledge = await getRelevantContext(question);
    const systemPrompt = QA_SYSTEM_PROMPT.replace('{KNOWLEDGE}', knowledge);
    const userMessage = senderName ? `${senderName}：${question}` : question;

    const response = await withRetry(
      () =>
        withTokenRefresh(client =>
          client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          })
        ),
      { retries: 2 }
    );

    const answer = response.content?.[0]?.text?.trim();
    if (!answer) return null;
    return answer;
  } catch (err) {
    logger.error({ err: err.message }, 'Q&A 回答生成失敗');
    return '🙏 ちょっと調べてみたけどわかりませんでした。スプシ直接確認してみて！';
  }
}

module.exports = { isQuestion, parseEquipmentRegister, answerQuestion };
