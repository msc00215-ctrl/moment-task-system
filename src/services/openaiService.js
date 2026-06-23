/**
 * OpenAI Service
 * - LINE 文章からタスク要素を JSON で抽出
 * - response_format: json_object を使い Markdown コードブロック混入を防止
 */
const OpenAI = require('openai');
const { credentials } = require('../config');
const { withRetry } = require('../utils/retry');
const { logger } = require('../utils/logger');
const { normalizeExtractedTask } = require('../utils/validator');

let cachedClient;

async function getClient() {
  if (cachedClient) return cachedClient;
  const apiKey = await credentials.openaiApiKey();
  cachedClient = new OpenAI({ apiKey, timeout: 15_000 });
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

// 後方互換：既存コードが extractTask() の返り値として単一オブジェクトを期待している場合のため
// tasks[0] を返す（複数タスクは handlers 側で対応が必要）

/**
 * @param {string} text - LINE から受け取ったメッセージ本文
 * @returns {Promise<{ task: string|null, assignee: string|null, deadline: string|null, area: string|null }>}
 */
/**
 * @param {string} text - LINE から受け取ったメッセージ本文
 * @returns {Promise<{ task, assignee, department, deadline, area, priority, status }[]>}
 *   複数タスクが含まれる場合は配列で返る。タスクなし or エラー時は空配列。
 */
async function extractTasks(text) {
  if (!text || typeof text !== 'string') return [];

  try {
    const client = await getClient();
    const completion = await withRetry(
      () =>
        client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
          max_tokens: 800,
        }),
      { retries: 2 },
    );

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      logger.warn('OpenAI 応答が空');
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      logger.warn({ content }, 'OpenAI 応答が JSON でない');
      return [];
    }

    const tasks = parsed.tasks;
    if (!Array.isArray(tasks)) return [];
    return tasks.map(t => normalizeExtractedTask(t));
  } catch (err) {
    logger.error({ err: err.message }, 'OpenAI 呼び出し失敗 — 空配列で継続');
    return [];
  }
}

// 後方互換：既存の呼び出し元が extractTask() (単数) を使っている場合のシム
async function extractTask(text) {
  const tasks = await extractTasks(text);
  return tasks.length > 0 ? tasks[0] : normalizeExtractedTask(null);
}

module.exports = { extractTask, extractTasks };
