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

【個人情報の取り扱い（必須）】
- 電話番号・メールアドレス・住所・郵便番号はタスク内容に含めない
- 「090-xxxx-xxxxに連絡して」→ task: "〇〇に連絡する"（番号は除外）
- 個人の氏名はスタッフ一覧にある担当者名のみ使用する
- 一覧にない氏名・個人情報は task フィールドに含めない

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
          model: 'gpt-4o-mini',
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

// ─────────────────────────────────────────────
// 質問応答（タスク抽出後、タスクがない場合に呼ばれる）
// ─────────────────────────────────────────────

const RESPONSE_SYSTEM_PROMPT_BASE = `あなたはMOMENT 2026の運営アシスタントBotです。
スタッフ・ボランティアからの質問に、以下の情報をもとに丁寧かつ簡潔に日本語で答えてください。

【MOMENT 2026 基本情報】
イベント名: MOMENT 2026
開催日: 2026年7月3日(金)〜7月5日(日)
場所: 洞川キャンプ場（奈良県吉野郡天川村）
ゲートオープン: 7月3日(金) 9:00
タイムテーブル開始: 7月3日(金) 15:00
After終了: 7月5日(日) 23:30
撤収開始: 7月6日(月) 7:00〜

設営スケジュール:
- 6/29(月): 10:00 倉庫積み込み / 15:00 会場入り・テント設営
- 6/30(火): 8:00 備品荷下ろし・資材運搬
- 7/1(水): 8:00 エントランス設営・投光器設置
- 7/2(木): 8:00 備品清掃・整理 / 14:00 最終確認 / 16:00 ゴミ拾い全員
- 7/3(金): 9:00 ゲートオープン / 15:00 開演

【返答ルール】
- 備品の保管場所・スタッフのシフト・担当部署は積極的に案内する
- 電話番号・メールアドレスなどの個人連絡先は絶対に教えない
- 財務・出演料・契約情報は答えない
- 情報にない内容は「担当者にご確認ください」と案内する
- タスク登録は「自動で記録されています」と伝えるだけ
- 返答は3〜5文以内でフレンドリーかつ簡潔に
- 絵文字は1〜2個まで`;

function buildResponseSystemPrompt(context = {}) {
  const { equipment = [], staff = [] } = context;
  let ctx = '';

  if (equipment.length > 0) {
    const lines = equipment.map(e => {
      const qty  = e.quantity ? `${e.quantity}${e.unit || ''}` : '';
      const loc  = e.location || '未登録';
      const dept = e.department ? ` [${e.department}]` : '';
      const note = e.notes ? ` ※${e.notes}` : '';
      return `- ${e.item}${qty ? `（${qty}）` : ''}: ${loc}${dept}${note}`;
    });
    ctx += `\n\n【備品・資材の保管場所】\n${lines.join('\n')}`;
  }

  if (staff.length > 0) {
    const lines = staff.map(s => {
      const shift = [s.shiftStart && `入り:${s.shiftStart}`, s.shiftEnd && `退:${s.shiftEnd}`]
        .filter(Boolean).join(' ');
      const note = s.notes ? ` ※${s.notes}` : '';
      return `- ${s.name}（${s.department}）${s.role ? ` / ${s.role}` : ''}${shift ? ` / ${shift}` : ''}${note}`;
    });
    ctx += `\n\n【スタッフ・シフト情報】\n${lines.join('\n')}`;
  }

  return RESPONSE_SYSTEM_PROMPT_BASE + ctx;
}

/**
 * 質問への自然言語応答を生成する
 * @param {string} text - ユーザーのメッセージ
 * @param {string|null} groupName - LINEグループ名
 * @param {{ equipment?: Array, staff?: Array }} context - シートから取得したコンテキスト
 * @returns {Promise<string|null>}
 */
async function generateResponse(text, groupName = null, context = {}) {
  if (!text || typeof text !== 'string') return null;

  const systemPrompt = buildResponseSystemPrompt(context);
  const userContent  = groupName
    ? `グループ:「${groupName}」\nメッセージ:「${text}」`
    : `メッセージ:「${text}」`;

  try {
    const client = await getClient();
    const completion = await withRetry(
      () =>
        client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userContent },
          ],
          temperature: 0.4,
          max_tokens: 400,
        }),
      { retries: 1 },
    );

    const response = completion.choices?.[0]?.message?.content?.trim();
    if (!response) return null;
    if (response === 'SKIP' || response.length < 5) return null;

    return response;
  } catch (err) {
    logger.error({ err: err.message }, '応答生成失敗');
    return null;
  }
}

// ─────────────────────────────────────────────
// ジュニア — キャラクター応答
// ─────────────────────────────────────────────

const JUNIOR_BASE_PROMPT = `あなたはMOMENT 2026の現場バディ「ジュニア」です。

【キャラクター】
まだ生まれたてのAIバディ。みんなに育ててもらいながら成長していく存在。
親しみやすく温かいタメ口。関西弁ベースやけどきつくない。
「横にいる頼れるツレ」のスタンス。誰一人置いてきぼりにしない。

【MOMENT 2026 基本情報】
開催日: 2026年7月3日(金)〜7月5日(日)
テーマ: "深化"
場所: 洞川キャンプ場（奈良県吉野郡天川村）
最寄り駅: 下市口駅（ローカルアーティスト送迎あり）
ゲートオープン: 7月3日(金) 9:00 / タイムテーブル開始: 7月3日(金) 15:00
After終了: 7月5日(日) 23:30 / 撤収開始: 7月6日(月) 7:00〜
収容人数: 850名
チケット: 前売り全810枚完売 / 当日券なし

ラインナップ: 計29組（初出演15組含む）
- 海外LIVE: Azu Tiwaline、JakoJako、Hybrid Man
- 海外DJ: Morgan、Gordon
- 国内LIVE: Kuniyuki、Olive Oil、Hideo Nakasako
- Opening Ceremony: Hiroo Tachibana & KAZUMA ONISHI with MuSuHi
- アンビエント・チルステージ: オートキャンプテントサイトエリアに追加設置（ラインナップは当日サプライズ）

駐車場:
- Aパーキング: 96台 / Bパーキング: 52台 / A・B間: 2台 → 合計150台
- 出店者駐車場: あたらしや体育館

シャトルバス運行時間:
[MOMENT ⇄ 場外駐車場]
- 7/3(金): 通常運行 9:00-22:00 / 早朝便 5:00-7:00
- 7/4(土): 通常運行 9:00-20:00 / 早朝便 7:00-9:00
- 7/5(日): 通常運行 9:00-16:00
- 7/6(月): 最終便 9:00-11:00
[MOMENT ⇄ 洞川温泉]
- 7/5(日)・7/6(月): 11:00-20:00

近隣キャンプ場（予約は各施設に直接）:
- 桝源フォレスト・イン洞川キャンプ場
- 松林オートキャンプ場
- どろがわ山上川キャンプ場 西浦

サウナ:
- エリア: 川沿いエリア（the sauna 天川）
- タイプ: バレルサウナ＋テントサウナ の2タイプ
- 料金: 三日通し券 ¥7,000 / 一日券 ¥3,000

BAR:
- メインBAR: Family Tree Bottles（大阪・福島のワインショップ）
  取り扱い: ナチュールワイン、メスカル、MOMENTオリジナルクラフトビール、スピリッツ、ボトル販売あり
  フィーチャーリカー: フロール・デ・カーニャ（プレミアムラム）、MACANE（国産マカボタニカルリキュール）
  限定: 洞川温泉醸造所コラボクラフトビール
- 2ndバー: 六角堂（マカ堂に併設）

カップルール（BAR共通）:
- 使い捨てカップなし
- 専用カップ: ¥500
- カラビナ付きステンレスマグカップ: ¥1,500
- 前回参加時のカップ持参推奨

キャッシュレス対応:
- VISA / Mastercard / American Express / JCB / Diners Club / Discover
- PayPay / 交通系IC

お酒ルール（重要）:
- 深夜0:00〜6:00は酒類の販売・提供禁止（奈良県警指導）
- 持ち込み可能: 缶ビール・缶チューハイ・缶ハイボールなど缶アルコール飲料のみ
- 持ち込み禁止: 瓶・ペットボトル・紙パックのアルコール（荷物検査で没収）
- 缶ビールは会場最寄り「まつみや食堂」でも購入可能

キッズエリア開放時間:
- 7/3(金): 12:00-18:30
- 7/4(土): 10:00-18:30
- 7/5(日): 10:00-17:00
- 託児サービス: 1歳以上 / ¥2,000 / 最長3時間（定員あり）
- 保護者同伴は無料

ワークショップ:
- ヨガ（無料）: 7/4・7/5 8:30-9:30、メインステージ横 芝エリア（雨天=ワークショップエリア）
  講師: Mitsuki / coji cose (TAMARU)
- ドラムサークル（無料）: 7/4 10:00-11:00、メインフロア
  講師: RAGAM 田辺響 / cojicose (TAMARU) / 出演: Elements Link

警備スケジュール:
- 1日目(7/3): 9:00〜22:00
- 2日目(7/4): 9:00〜20:00
- 3日目(7/5): 10:00〜17:00

ボランティア: 計12名
- 活動内容: 1人あたり1日4時間×3日間（合計12時間）
- 特典: 入場無料・テント設営無料・駐車場代無料・賄い（稼働日1食、設営撤収日2食）
- 各リーダー: ボランティア統括=南城祐介/KEITA、場内P=YUTO、出店=YMT、物販=愛ちゃん、清掃=タイガ、シャトルバス=ルウジ、運営統括=石田翔馬

救護:
- 救護場所: 管理棟

夜間ゲートルール:
- 車での入場: 初日(7/3)22:00まで、2・3日目(7/4-5)20:00まで
- 歩いての入場・再入場: 夜間でもOK（宿場町から徒歩可能）
- 制服警備員がエントランスに常駐

ゴミルール:
- 基本: テントへ持ち帰って分別
- ゴミ箱: 3個設置（メイン・BAR・チルアウト各1）

その他ルール:
- 犬の入場: フロアに連れ込まなければOK
- 荷物検査: あり（⚠️ Bag Check）
- 缶アルコールのダンスフロアへの大量持ち込みは禁止

設営スケジュール:
- 6/29(月): 10:00 倉庫積み込み / 15:00 会場入り・テント設営
- 6/30(火): 8:00 備品荷下ろし・資材運搬
- 7/1(水): 8:00 エントランス設営・投光器設置
- 7/2(木): 8:00 備品清掃・整理 / 14:00 最終確認 / 16:00 ゴミ拾い全員

【返答ルール】
- 3〜4文以内で簡潔に
- 知らないことは「それはまだわからんわ！誰か教えてくれへん？」と素直に言う
- 個人の連絡先・財務情報は絶対に答えない
- 絵文字は1〜2個まで
- タメ口・フレンドリーに`;

function buildJuniorSystemPrompt(context = {}) {
  const { equipment = [], staff = [], vendors = [], artists = [] } = context;
  let ctx = '';

  if (equipment.length > 0) {
    const lines = equipment.map(e => {
      const qty = e.quantity ? `${e.quantity}${e.unit || ''}` : '';
      return `- ${e.item}${qty ? `（${qty}）` : ''}: ${e.location}${e.department ? ` [${e.department}]` : ''}`;
    });
    ctx += `\n\n【知ってる備品・資材の場所】\n${lines.join('\n')}`;
  }

  if (staff.length > 0) {
    const lines = staff.map(s => {
      const shift = [s.shiftStart && `入り:${s.shiftStart}`, s.shiftEnd && `退:${s.shiftEnd}`]
        .filter(Boolean).join(' ');
      return `- ${s.name}（${s.department}）${shift ? ` / ${shift}` : ''}`;
    });
    ctx += `\n\n【スタッフ情報】\n${lines.join('\n')}`;
  }

  if (vendors.length > 0) {
    const lines = vendors
      .filter(v => v.name)
      .map(v => {
        const parts = [v.location && `場所:${v.location}`, v.hours && `時間:${v.hours}`, v.menu && `メニュー:${v.menu}`].filter(Boolean);
        return `- ${v.name}（${v.category}）${parts.length ? ` / ${parts.join(' / ')}` : ''}`;
      });
    if (lines.length > 0) ctx += `\n\n【出店情報】\n${lines.join('\n')}`;
  }

  if (artists.length > 0) {
    const lines = artists
      .filter(a => a.name && (a.perfTime || a.stage))
      .map(a => {
        const parts = [];
        if (a.perfTime) parts.push(a.perfTime);
        if (a.stage)    parts.push(`${a.stage}フロア`);
        if (a.hotel)    parts.push(`宿:${a.hotel}${a.stayType ? `（${a.stayType}）` : ''}`);
        if (a.careStaff && a.careStaff !== 'ー' && a.careStaff !== '-') {
          parts.push(`担当:${a.careStaff}`);
        }
        return `- ${a.name}: ${parts.join(' / ')}`;
      });
    if (lines.length > 0) {
      ctx += `\n\n【アーティスト出演・宿泊情報】\n（※連絡先・電話番号は答えないこと）\n${lines.join('\n')}`;
    }
  }

  return JUNIOR_BASE_PROMPT + ctx;
}

async function generateJuniorResponse(text, groupName = null, context = {}) {
  if (!text || typeof text !== 'string') return null;

  const systemPrompt = buildJuniorSystemPrompt(context);
  const userContent  = groupName
    ? `グループ:「${groupName}」\nメッセージ:「${text}」`
    : `メッセージ:「${text}」`;

  try {
    const client = await getClient();
    const completion = await withRetry(
      () => client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent },
        ],
        temperature: 0.6,
        max_tokens: 200,
      }),
      { retries: 1 },
    );

    const response = completion.choices?.[0]?.message?.content?.trim();
    if (!response || response.length < 5) return null;
    return response;
  } catch (err) {
    logger.error({ err: err.message }, 'Junior応答生成失敗');
    return null;
  }
}

// ─────────────────────────────────────────────
// ジュニア — 備品情報の抽出（会話から学習）
// ─────────────────────────────────────────────

const EQUIPMENT_EXTRACT_PROMPT = `JSONのみを返してください。

メッセージから備品・資材の保管場所情報を抽出します。
情報が不十分または含まれていない場合は {"found": false} を返してください。
場所が曖昧な場合（「あそこ」「ここ」等）も {"found": false} を返してください。

出力形式:
{"found":true,"item":"アイテム名","category":"設営資材|電源機材|什器|消耗品|照明機材|音響機材|その他","quantity":数値またはnull,"unit":"単位またはnull","location":"具体的な保管場所","department":"担当部署またはnull","notes":"備考またはnull"}

例:
入力:「ジュニア、テント3張は設営エリアのA倉庫にあるよ」
出力:{"found":true,"item":"テント","category":"設営資材","quantity":3,"unit":"張","location":"設営エリアA倉庫","department":"設営","notes":null}

入力:「ジュニア、音響の担当誰？」
出力:{"found":false}`;

async function extractEquipmentInfo(text) {
  if (!text) return { found: false };

  try {
    const client = await getClient();
    const completion = await withRetry(
      () => client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: EQUIPMENT_EXTRACT_PROMPT },
          { role: 'user',   content: text },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 200,
      }),
      { retries: 1 },
    );

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return { found: false };

    try {
      return JSON.parse(content);
    } catch {
      return { found: false };
    }
  } catch (err) {
    logger.warn({ err: err.message }, '備品情報抽出失敗');
    return { found: false };
  }
}

module.exports = { extractTask, extractTasks, generateResponse, generateJuniorResponse, extractEquipmentInfo };
