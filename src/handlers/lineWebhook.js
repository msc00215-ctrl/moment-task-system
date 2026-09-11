/**
 * LINE Webhook ハンドラ
 *
 * 動作フロー:
 * ┌─ 全メッセージ（グループ・DM共通）─────────────────┐
 * │  ・リアルタイムログ記録（GASシート）               │
 * │  ・決定事項の自動抽出 → 確定知識ベースへ（silent） │
 * │  ・タスク自動抽出 → スプシへ（ステルス・返答なし） │
 * └──────────────────────────────────────────────────┘
 *
 * ┌─ 返答するのは以下の場合のみ ──────────────────────┐
 * │  【グループ】「ジュニア」と呼びかけた時だけ返答   │
 * │  【DM】     全メッセージに返答                    │
 * └──────────────────────────────────────────────────┘
 *
 * 返答の優先順位:
 *  1. 備品登録（コマンド or 自然言語）
 *  2. Q&A（質問に回答）
 *  3. 確定情報登録（「〇〇に決まったよ」系）→「覚えたよ！」と返す
 */
const { verifyLineSignature } = require('../middleware/lineSignature');
const { extractTasks } = require('../services/openaiService');
const { isQuestion, parseEquipmentRegister, answerQuestion, answerQuestionCore } = require('../services/qaService');
const { addEquipmentItem, saveManualKnowledgeEntry } = require('../services/knowledgeService');
const { extractAndSaveDecision, isDecisionMessage } = require('../services/decisionExtractor');
const { reply } = require('../services/lineService');
const { postToGas } = require('../services/gasService');
const { assertRequired } = require('../config');
const { logger } = require('../utils/logger');
const { maskPII, checkRateLimit, isJuniorMention } = require('../utils/security');

// 「コアジュニア」呼びかけ検出（コアスタッフ専用シークレットモード）
function isCalledByCore(text) {
  return /^コアジュニア[、,，\s！!]?/.test(text);
}

// 「コアジュニア、」プレフィックスを除いた本文を返す
function stripCorePrefix(text) {
  return text.replace(/^コアジュニア[、,，\s！!]*/, '').trim();
}

// 「ジュニア」と呼びかけているか（グループでの返答トリガー）
// ※「コアジュニア」は別処理なのでここでは除外
function isCalledByName(text) {
  return /^ジュニア[、,，\s！!]?/.test(text) && !isCalledByCore(text);
}

// 「ジュニア、」プレフィックスを除いた本文を返す
function stripPrefix(text) {
  return text.replace(/^ジュニア[、,，\s！!]*/, '').trim();
}

// 手動記録コマンド検出（「記録して」を含む）
function isRecordCommand(text) {
  return text.includes('記録して') || text.includes('覚えといて') || text.includes('メモして');
}

// 記録内容を抽出（必要事項チェック付き）
// 返り値: { content: string } | { missing: string }
function parseRecordCommand(text) {
  let content = null;

  // パターン1: 「〇〇を記録して」「〇〇って記録して」「〇〇は記録して」
  let m = text.match(/^(.+?)(?:を|って|は)(?:記録して|覚えといて|メモして)/);
  if (m) content = m[1].trim();

  // パターン2: 「記録して。〇〇」「記録して：〇〇」「記録して\n〇〇」
  if (!content) {
    m = text.match(/(?:記録して|覚えといて|メモして)[。\n：:、]\s*(.+)/s);
    if (m) content = m[1].trim();
  }

  // パターン3: コマンドのみで内容なし
  if (!content || content.length < 5) {
    return {
      missing: '📝 記録したい内容が分からなかったよ！\n\n以下の形式で送ってね：\n\n【例1】\nジュニア、〇〇を記録して\n\n【例2】\nジュニア、記録して。\n〇〇（記録したい内容）\n\n何を記録する？',
    };
  }

  return { content };
}

// 自然言語の備品登録を解析「テント（10張）はBエリアに置いてあるよ」
function parseEquipmentNatural(text) {
  // 「備品〇〇はXXに」「〇〇（XX個）はYYに」形式
  const m = text.match(/^(?:備品)?(.+?)(?:（(.+?)）)?\s*[はが]?\s*(.+?)[にへ](?:置いてある|あるよ|置いてあるよ|保管|あります)?/);
  if (!m) return null;
  return {
    name: m[1].trim(),
    quantity: m[2] || '',
    location: m[3].trim(),
    assignee: '',
    notes: '',
  };
}

const groupNameCache = new Map();

async function handleWebhook(req, res) {
  try {
    assertRequired();
  } catch (err) {
    logger.error({ err: err.message }, '設定不足 — Webhook 停止');
    res.status(500).send('Configuration error');
    return;
  }

  const valid = await verifyLineSignature(req);
  if (!valid) {
    logger.warn({ ip: req.ip }, 'LINE 署名検証失敗');
    res.status(401).send('Invalid signature');
    return;
  }

  res.status(200).send('OK');

  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  if (events.length === 0) return;

  const results = await Promise.allSettled(events.map(handleSingleEvent));
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      logger.error({ err: r.reason?.message, eventIndex: i }, 'イベント処理失敗');
    }
  });
}

async function handleJoinEvent(event) {
  const chatId = event.source?.groupId || event.source?.roomId;
  if (!chatId) return;
  logger.info({ chatId }, 'グループ参加 — 自己紹介を送信');
  try {
    const sent = await pushMessages(chatId, [
      { type: 'text', text: INTRO_SHORT },
      { type: 'text', text: INTRO_MANUAL },
    ]);
    const manualMsgId = sent[1]?.id;
    if (manualMsgId) {
      await pinMessage(chatId, manualMsgId);
      logger.info({ chatId, messageId: manualMsgId }, 'ピン止め完了');
    }
  } catch (err) {
    logger.error({ err: err.message }, 'join 自己紹介失敗');
  }
}

async function handleSingleEvent(event) {
  if (!event) return;

  if (event.type === 'join') {
    await handleJoinEvent(event);
    return;
  }

  if (event.type !== 'message') return;
  if (!event.message || event.message.type !== 'text') return;

  const text = (event.message.text || '').trim();
  if (!text) return;

  const replyToken = event.replyToken;
  const userId = event.source?.userId || 'unknown';
  const sourceType = event.source?.type || 'unknown'; // 'user' | 'group' | 'room'
  const groupId = event.source?.groupId || event.source?.roomId || null;
  const isDM = sourceType === 'user';
  const timestamp = new Date(event.timestamp || Date.now()).toISOString();
  const groupName = groupId ? await fetchGroupName(groupId) : 'DM';

  logger.info({ sourceType, groupName, textLen: text.length }, 'メッセージ受信');

  // ── ステルス処理（全メッセージ・返答なし）──────────────────────
  // 決定事項の自動抽出 → 確定知識ベースへ
  extractAndSaveDecision(text, groupName).catch(err =>
    logger.warn({ err: err.message }, '決定事項抽出スキップ')
  );

  // リアルタイムログ記録
  postToGas({
    type: 'lineLog',
    messages: [{ timestamp, groupId: groupId || 'direct', groupName, userId, text }],
  }).catch(err => logger.error({ err: err.message }, 'GAS ログ送信失敗'));

  // タスク自動抽出 → スプシへ（返答なし・ステルス）
  extractTasks(text).then(tasks => {
    if (!tasks || tasks.length === 0) return;
    return postToGas({
      type: 'task',
      groupName,
      groupId: groupId || 'direct',
      userId,
      originalText: text,
      timestamp,
      tasks,
    });
  }).catch(err => logger.warn({ err: err.message }, 'タスク抽出スキップ'));

  // 賄い確認数の記録（ステルス — 「昼/夜 グループ名 人数」形式を検知）
  const mealConf = parseMealConfirmation(text);
  if (mealConf) {
    const jstDate = new Date(event.timestamp || Date.now())
      .toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
      .split(' ')[0];
    postToGas({
      type:      'mealConfirm',
      mealTime:  mealConf.mealTime,
      group:     mealConf.group,
      count:     mealConf.count,
      date:      jstDate,
      groupName,
      userId,
      timestamp,
    }).catch(err => logger.error({ err: err.message }, 'GAS 賄い確認送信失敗'));
  }

  // ── 返答処理 ──────────────────────────────────────────────────

  // 【コアスタッフモード】「コアジュニア」呼びかけ時（グループ・DM共通）
  if (isCalledByCore(text) && replyToken) {
    const coreBody = stripCorePrefix(text);
    logger.info({ textLen: coreBody.length }, 'コアスタッフモード起動');
    const coreAnswer = await answerQuestionCore(coreBody);
    if (coreAnswer) await safeReply(replyToken, userId, coreAnswer);
    return;
  }

  // 【通常モード】グループ: 「ジュニア」呼びかけ時のみ / DM: 常時
  const called = isDM || isCalledByName(text);
  if (!called || !replyToken) return;

  // 「ジュニア、」を除いた本文で処理
  const body = isDM ? text : stripPrefix(text);

  // 1. 手動記録コマンド「〇〇を記録して」「記録して。〇〇」
  if (isRecordCommand(body)) {
    const parsed = parseRecordCommand(body);
    if (parsed.missing) {
      await safeReply(replyToken, userId, parsed.missing);
      return;
    }
    const result = await saveManualKnowledgeEntry(parsed.content);
    await safeReply(replyToken, userId,
      result.ok
        ? `承知しました。📚\n「${parsed.content.slice(0, 60)}${parsed.content.length > 60 ? '…' : ''}」\nを確定知識ベースに記録したよ！\nカテゴリ: ${result.category}`
        : '❌ 記録に失敗したよ。もう一度試してみて！'
    );
    return;
  }

  // 3. 備品登録（コマンド形式）「備品登録: テント, Bエリア, 10張」
  const equipCmd = parseEquipmentRegister(body);
  if (equipCmd) {
    const ok = await addEquipmentItem({
      category: 'その他',
      name: equipCmd.name,
      location: equipCmd.location,
      quantity: equipCmd.quantity,
      assignee: equipCmd.assignee,
      status: '📝未確認',
      notes: equipCmd.notes,
    });
    await safeReply(replyToken, userId,
      ok
        ? `✅ 📦備品DB に追加したよ！\n・品名: ${equipCmd.name}\n・場所: ${equipCmd.location}\n・数量: ${equipCmd.quantity}`
        : '❌ 備品DBへの追加に失敗。スプシを直接確認してね。'
    );
    return;
  }

  // 4. 備品登録（自然言語）「テント（10張）はBエリアに置いてあるよ」
  if (body.includes('あるよ') || body.includes('置いてある') || body.includes('保管')) {
    const equipNat = parseEquipmentNatural(body);
    if (equipNat && equipNat.name && equipNat.location) {
      const ok = await addEquipmentItem({
        category: 'その他',
        name: equipNat.name,
        location: equipNat.location,
        quantity: equipNat.quantity,
        status: '📝未確認',
        notes: equipNat.notes,
      });
      if (ok) {
        await safeReply(replyToken, userId,
          `✅ 📦備品DB に記録したよ！\n・${equipNat.name}　${equipNat.quantity ? '（' + equipNat.quantity + '）' : ''}\n・場所: ${equipNat.location}`
        );
        return;
      }
    }
  }

  // 5. Q&A（質問に回答）
  if (isQuestion(body) || isDM) {
    logger.info({ textLen: body.length }, '質問メッセージ → Q&Aモード');
    const answer = await answerQuestion(body);
    if (answer) {
      await safeReply(replyToken, userId, answer);
    }
    return;
  }

  // 6. 確定情報の登録（「〇〇に決まったよ」系）→ 確認返答
  if (isDecisionMessage(body)) {
    // extractAndSaveDecision はステルス処理で既に実行済み
    // ジュニアに直接言った場合は「覚えたよ」と返す
    await safeReply(replyToken, userId, `📚 覚えたよ！確定知識ベースに追加しておくね✨`);
    return;
  }
}

async function fetchGroupName(groupId) {
  if (groupNameCache.has(groupId)) return groupNameCache.get(groupId);
  try {
    const { getClient } = require('../services/lineService');
    const client = await getClient();
    const summary = await client.getGroupSummary(groupId);
    const name = summary?.groupName || groupId;
    groupNameCache.set(groupId, name);
    return name;
  } catch {
    return groupId;
  }
}

async function safeReply(replyToken, userId, text) {
  try {
    await reply(replyToken, text, userId);
  } catch (err) {
    logger.error({ err: err.message }, 'reply 失敗');
  }
}

/**
 * 賄い確認フォーマットを検出する（OpenAI不要・正規表現で処理）
 * 対応形式: 「昼 MOMENT 6」「夜 公式 25名」「#昼 ボランティア 98人」等
 * @param {string} text
 * @returns {{ mealTime: '昼'|'夜', group: string, count: number }|null}
 */
function parseMealConfirmation(text) {
  // 食事回を検出: 昼|12時|午前 → '昼' / 夜|18時|夕 → '夜'
  const mealMatch = text.match(/[#＃]?\s*(?:(昼|12時|ひる|午昼)|(夜|18時|よる|夕))/);
  if (!mealMatch) return null;
  const mealTime = mealMatch[1] ? '昼' : '夜';

  // グループ名を検出
  let group = null;
  if (/moment|もーめん/i.test(text)) {
    group = 'MOMENT';
  } else if (/公式|official|スタッフ/i.test(text)) {
    group = '公式スタッフ';
  } else if (/ボランティア|vol\b|ぼらんてぃあ/i.test(text)) {
    group = 'ボランティア';
  }
  if (!group) return null;

  // 人数を検出（グループ名の後に続く数字）
  const numMatch = text.match(/(\d+)\s*(?:名|人|にん)?/);
  if (!numMatch) return null;
  const count = parseInt(numMatch[1], 10);
  if (isNaN(count) || count <= 0 || count > 500) return null;

  return { mealTime, group, count };
}

module.exports = { handleWebhook };
