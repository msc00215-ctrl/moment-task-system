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
 *  1. メンバーリスト取得
 *  2. 備品登録（コマンド or 自然言語）
 *  3. Q&A（質問に回答）
 *  4. 確定情報登録（「〇〇に決まったよ」系）→「覚えたよ！」と返す
 */
const { verifyLineSignature } = require('../middleware/lineSignature');
const { extractTasks } = require('../services/openaiService');
const { isQuestion, parseEquipmentRegister, answerQuestion } = require('../services/qaService');
const { addEquipmentItem } = require('../services/knowledgeService');
const { extractAndSaveDecision, isDecisionMessage } = require('../services/decisionExtractor');
const { reply, getGroupMembers } = require('../services/lineService');
const { postToGas } = require('../services/gasService');
const { assertRequired } = require('../config');
const { logger } = require('../utils/logger');

// 「ジュニア」と呼びかけているか（グループでの返答トリガー）
function isCalledByName(text) {
  return /ジュニア[、,，\s！!]?/.test(text) || text.startsWith('ジュニア');
}

// 「ジュニア、」プレフィックスを除いた本文を返す
function stripPrefix(text) {
  return text.replace(/^ジュニア[、,，\s！!]*/, '').trim();
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

async function handleSingleEvent(event) {
  if (!event || event.type !== 'message') return;
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

  // ── 返答処理 ──────────────────────────────────────────────────
  // グループ: 「ジュニア」呼びかけ時のみ / DM: 常時
  const called = isDM || isCalledByName(text);
  if (!called || !replyToken) return;

  // 「ジュニア、」を除いた本文で処理
  const body = isDM ? text : stripPrefix(text);

  // 1. メンバーリスト取得「メンバーリスト」「メンバー一覧」
  if (/メンバー(?:リスト|一覧)/.test(body) && groupId) {
    try {
      logger.info({ groupId }, 'メンバーリスト取得リクエスト');
      const members = await getGroupMembers(groupId);

      const list = members
        .map((m, i) => `${i + 1}. ${m.displayName}`)
        .join('\n');

      const message = `👥 グループメンバー（${members.length}名）\n\n${list}`;
      await safeReply(replyToken, userId, message);
      return;
    } catch (err) {
      logger.error({ err: err.message }, 'メンバーリスト取得エラー');
      await safeReply(replyToken, userId, '❌ メンバーリスト取得に失敗しました。時間を置いて試してください。');
      return;
    }
  }

  // 2. 備品登録（コマンド形式）「備品登録: テント, Bエリア, 10張」
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

  // 3. 備品登録（自然言語）「テント（10張）はBエリアに置いてあるよ」
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

  // 4. Q&A（質問に回答）
  if (isQuestion(body) || isDM) {
    logger.info({ textLen: body.length }, '質問メッセージ → Q&Aモード');
    const answer = await answerQuestion(body);
    if (answer) {
      await safeReply(replyToken, userId, answer);
    }
    return;
  }

  // 5. 確定情報の登録（「〇〇に決まったよ」系）→ 確認返答
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

module.exports = { handleWebhook };
