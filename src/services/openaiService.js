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

const SYSTEM_PROMPT = `あなたはMOMENT 2026（奈良・洞川キャンプ場、7/3〜7/5開催）の運営タスク管理AIです。
LINEグループのメッセージからタスクを抽出し、必ずJSONのみで返してください。説明文・前置き絶対禁止。

【スタッフ名 → 表記統一・部署対応】
HI-C / hi-c → 全体
妹尾 真行 / 妹尾 / Masayuki Senoo → 全体
YMT / ヤマト → 出店管理
石田翔馬 / ショウマ → 運営本部
masato morokuma / 諸隈 / モロクマ → 運営本部
武藤剛亘 → 運営本部
＆you⭐︎ → エントランス
kazuha tanaka / かずは → エントランス
Shusui Tanaka / 秋水 → エントランス
Hide → 場外P
YUTO / ゆうと → 警備
青木 陽平 → 警備
南城 祐介 / 南城 / 南ちゃん → ボランティア
KEITA / けいた → ボランティア
Joshua SW / ジョシュア → 舞台監督
ルウジ → 舞台監督
yusuke ono / 小野裕介 / レオ / SOL → 音響
kan2 / kamba / 神波崇 → 音響
川島 → 音響
Kunihiko Harada / 原田 → 電源
たなのりくん / 田中 → 電源
yoshinobu nakamura / モヤさん → 電源
後藤拓己 / GOTO / KAMADEN → 電源
Shu YAMAWAKI / 山脇 / 山脇Shu → 演出・照明
Haruki Moriguchi / モリグチ / CRACKWORKS → VJ・演出
Ruriko Hosono / 細野ルリコ → 照明
oleoreo / オレオ → ステージ
岩城真人 / 岩城 → ステージ
hajime / 忍 / はじめさん → 設営
🌞Hiroto Arai / ヒロト → バー
田岡太一 / 田岡 → バー
MARIA / マリア → 広報
Momoko / ももこ → 広報
ʚ愛ɞ / 愛ちゃん → 物販
akinoko / あきのこ → キッズ
中道大雅 / タイガ → 清掃
正弥 / マサヤ / はっしゃん → 食堂
ナカムラ ダイスケ / だいすけ → 食堂
Yuto Saruwatari / 猿ちゃん / 猿渡 → シャトルバス
ZIGN / ジン → デコレーション
Samaya Design / サマヤ → デコレーション
濵田隆史 → 撮影
池上健太 / KAGAMI JAPAN → 撮影
井原麻耶 / MAYADESU → 撮影
河合篤志 / TYPE-A → 映像

【グループ名で部署を補完】
グループ名に「音響」→ 部署:音響 / 「電源」→ 部署:電源 / 「設営」→ 部署:設営
「BAR」「バー」→ 部署:バー / 「デコレーション」→ 部署:デコレーション
「エントランス」→ 部署:エントランス / 「警備」→ 部署:警備

【タスクと判断する条件（どれか1つでも該当すれば抽出する）】
- 「〜してください」「〜お願い」「〜頼む」「〜よろしく」
- 「〜確認して」「〜手配して」「〜準備して」「〜発注して」「〜連絡して」
- 「〜までに」「〜日まで」「期限」などの締め切り表現
- 「〜担当で」「〜係で」などの役割割り当て
- 購入・発注・搬入・設営・撤収などの具体的な作業指示

【タスクと判断しない条件（空配列 {"tasks":[]} で返す）】
- 挨拶のみ（「おはよう」「お疲れさまです」「よろしくです」のみ）
- 感謝・リアクション（「ありがとう」「了解」「👍」「OK」のみ）
- 純粋な疑問（「〜ですか？」で情報を求めているだけのもの）
- 単なる情報共有で誰かのアクションが不要なもの

【日付解釈（2026年7月のイベント基準）】
- 「明日」「あした」→ メッセージの翌日（YYYY-MM-DD形式）
- 「今週中」→ その週の日曜日
- 「来週」→ 翌週の月曜日
- 「6/30」「6月30日」→ 2026-06-30
- 日付が不明 → null

【ステータス判定】
「〜しました」「〜済み」「〜完了」「〜できました」「OKもらった」「確認取れた」「終わりました」
→ status: "完了"
「〜予定」「〜する見込み」→ status: "予定"
「調整中」「検討中」→ status: "調整中"
その他の依頼・指示 → status: "未着手"

【優先度判定】
「急いで」「至急」「ASAP」「緊急」「今すぐ」→ priority: "高"
「できれば」「余裕があれば」「後で」→ priority: "低"
その他 → priority: "中"

【出力形式 — JSONのみ・複数タスクは配列で列挙】
{"tasks":[{"task":"タスク内容（具体的かつ簡潔に）","assignee":"担当者名（上記の統一表記）","department":"部署名","deadline":"YYYY-MM-DD or null","area":"エリア名 or null","priority":"高|中|低","status":"未着手|対応中|完了|予定|調整中"}]}

【抽出例①】
入力:「妹尾さん、カムロックケーブル80mを6/30までに手配してください」
出力:{"tasks":[{"task":"カムロックケーブル80mを手配","assignee":"妹尾 真行","department":"全体","deadline":"2026-06-30","area":null,"priority":"中","status":"未着手"}]}

【抽出例②】
入力:「音響の搬入終わりました！機材全部入ってます」
出力:{"tasks":[{"task":"音響機材搬入","assignee":null,"department":"音響","deadline":null,"area":null,"priority":"中","status":"完了"}]}

【抽出例③】
入力:「おはようございます！今日もよろしくお願いします😊」
出力:{"tasks":[]}

【抽出例④】
入力:「ヒロトさん、バーの冷蔵庫確認と、田岡さんに飲料在庫の発注を至急お願いします」
出力:{"tasks":[{"task":"バーの冷蔵庫確認","assignee":"🌞Hiroto Arai","department":"バー","deadline":null,"area":"バーエリア","priority":"中","status":"未着手"},{"task":"飲料在庫の発注","assignee":"田岡太一","department":"バー","deadline":null,"area":null,"priority":"高","status":"未着手"}]}`;

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
async function extractTasks(text, groupName = null) {
  if (!text || typeof text !== 'string') return [];

  const userContent = groupName
    ? `グループ名:「${groupName}」\nメッセージ:「${text}」`
    : `メッセージ:「${text}」`;

  try {
    const client = await getClient();
    const completion = await withRetry(
      () =>
        client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
          max_tokens: 1500,
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
