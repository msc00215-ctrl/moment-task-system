/**
 * AI Service (Anthropic Claude)
 * - LINE 文章からタスク要素を JSON で抽出
 * - ANTHROPIC_API_KEY を使用（OAuthトークン不要・期限切れなし）
 */
const Anthropic = require('@anthropic-ai/sdk');
const { credentials } = require('../config');
const { withRetry } = require('../utils/retry');
const { logger } = require('../utils/logger');
const { normalizeExtractedTask } = require('../utils/validator');

let cachedClient;

async function getClient() {
  if (cachedClient) return cachedClient;
  const apiKey = await credentials.anthropicApiKey();
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

const SYSTEM_PROMPT = `あなたはMOMENT 2026（奈良・洞川キャンプ場、7/3-5開催）の運営タスク管理AIです。
LINEメッセージからタスク要素を抽出し、必ずJSONのみで返してください。説明文・前置き絶対禁止。

【スタッフ名→部署の対応（名前表記を揃えること）】
HI-C→全体 / 妹尾 真行→全体 / YMT/ヤマト→出店管理
石田翔馬→運営本部 / masato morokuma/諸隈→運営本部 / 武藤剛亘→運営本部
＆you⭐︎→エントランス / kazuha tanaka→エントランス / Shusui Tanaka/秋水→エントランス
Hide→場外P / YUTO→警備 / 青木 陽平→警備
南城 祐介→ボランティア / KEITA→ボランティア
Joshua SW/ジョシュア→舞台監督 / ルウジ→舞台監督
yusuke ono/レオ→音響 / kan2→音響
Kunihiko Harada/原田→電源 / たなのりくん→電源 / yoshinobu nakamura→電源
Shu YAMAWAKI/山脇→演出 / Haruki Moriguchi/モリグチ→演出
oleoreo/オレオ→ステージ / 岩城真人→ステージ
hajime/忍→設営 / 🌞Hiroto Arai/ヒロト→バー / 田岡太一→バー
MARIA/マリア→広報 / Momoko→広報 / ʚ愛ɞ→物販
akinoko→キッズ / 中道大雅/タイガ→清掃
正弥/マサヤ/はっしゃん→食堂 / ナカムラ ダイスケ/だいすけ→食堂
Yuto Saruwatari→シャトルバス

【抽出ルール】
- 担当者が明示されていない場合は送信者を担当者とする
- @メンションがある場合はメンションされた人を担当者とする
- 完了報告（「〜しました」「〜済み」「OKもらった」）は status を "完了" に
- 複数タスクが含まれる場合は tasks 配列に個別で追加する
- 雑談・挨拶・スタンプのみのメッセージは tasks を空配列で返す

【出力形式 — JSONのみ】
{
  "tasks": [
    {
      "task": "タスク内容（具体的に）",
      "assignee": "担当者名（スタッフ一覧の表記に揃える）",
      "department": "部署名",
      "deadline": "YYYY-MM-DD or null",
      "area": "エリア名 or null",
      "priority": "高|中|低",
      "status": "未着手|対応中|完了|予定|調整中"
    }
  ]
}`;

/**
 * @param {string} text - LINE から受け取ったメッセージ本文
 * @returns {Promise<{ task, assignee, department, deadline, area, priority, status }[]>}
 */
async function extractTasks(text) {
  if (!text || typeof text !== 'string') return [];

  try {
    const client = await getClient();
    const response = await withRetry(
      () =>
        client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: text }],
        }),
      { retries: 2 },
    );

    const content = response.content?.[0]?.text;
    if (!content) {
      logger.warn('Claude 応答が空');
      return [];
    }

    let parsed;
    try {
      // コードブロックを除去してパース
      const jsonStr = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      logger.warn({ content }, 'Claude 応答が JSON でない');
      return [];
    }

    const tasks = parsed.tasks;
    if (!Array.isArray(tasks)) return [];
    return tasks.map(t => normalizeExtractedTask(t));
  } catch (err) {
    logger.error({ err: err.message }, 'Claude 呼び出し失敗 — 空配列で継続');
    return [];
  }
}

async function extractTask(text) {
  const tasks = await extractTasks(text);
  return tasks.length > 0 ? tasks[0] : normalizeExtractedTask(null);
}

module.exports = { extractTask, extractTasks };
