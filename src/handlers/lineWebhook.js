/**
 * LINE Webhook ハンドラ
 *
 * 動作フロー:
 * 1. 全メッセージ → ログ記録 + タスク自動抽出（無言）
 * 2. 「ジュニア」と呼ばれた時だけ → ジュニアが返答
 *    - 備品情報を教えてもらった → シートに保存して確認返信
 *    - 質問 → スタッフ/備品/スケジュール情報をもとに回答
 */
const { verifyLineSignature } = require('../middleware/lineSignature');
const { extractTasks, generateJuniorResponse, extractEquipmentInfo } = require('../services/openaiService');
const { reply } = require('../services/lineService');
const { postToGas, getSheetData } = require('../services/gasService');
const { assertRequired } = require('../config');
const { logger } = require('../utils/logger');
const { maskPII, checkRateLimit, isJuniorMention } = require('../utils/security');

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
  const userId     = event.source?.userId || 'unknown';
  const sourceType = event.source?.type   || 'unknown';
  const groupId    = event.source?.groupId || event.source?.roomId || null;
  const timestamp  = new Date(event.timestamp || Date.now()).toISOString();
  const groupName  = groupId ? await fetchGroupName(groupId) : 'DM';

  logger.info({ sourceType, groupName, textLen: text.length }, 'メッセージ受信');

  // ① レート制限
  if (!checkRateLimit(userId)) {
    logger.warn({ userId }, 'レート制限超過');
    return;
  }

  // ② 全メッセージをログ保存（PII マスク済み）
  const maskedText = maskPII(text);
  postToGas({
    type: 'lineLog',
    messages: [{ timestamp, groupId: groupId || 'direct', groupName, userId, text: maskedText }],
  }).catch(err => logger.error({ err: err.message }, 'GAS ログ送信失敗'));

  // ③ タスク抽出（常に・無言）
  let tasks;
  try {
    tasks = await extractTasks(text, groupName);
  } catch (err) {
    logger.error({ err: err.message }, 'extractTasks 失敗');
  }

  if (tasks && tasks.length > 0) {
    postToGas({
      type: 'task',
      groupName,
      groupId: groupId || 'direct',
      userId,
      originalText: maskedText,
      timestamp,
      tasks,
    }).catch(err => logger.error({ err: err.message }, 'GAS タスク送信失敗'));
  }

  // ④ 「ジュニア」が呼ばれていない → 終了（返答なし）
  if (!isJuniorMention(text) || !replyToken) return;

  // ⑤ 備品情報を教えてもらったか確認
  let equipInfo;
  try {
    equipInfo = await extractEquipmentInfo(text);
  } catch {
    equipInfo = { found: false };
  }

  if (equipInfo?.found && equipInfo.item && equipInfo.location) {
    postToGas({
      type: 'equipment',
      item:       equipInfo.item,
      category:   equipInfo.category   || '',
      quantity:   equipInfo.quantity   ?? '',
      unit:       equipInfo.unit       || '',
      location:   equipInfo.location,
      department: equipInfo.department || '',
      notes:      equipInfo.notes      || '',
    }).catch(err => logger.error({ err: err.message }, 'GAS 備品登録失敗'));

    const qty = equipInfo.quantity ? `${equipInfo.quantity}${equipInfo.unit || ''}` : '';
    await safeReply(replyToken, userId,
      `覚えたで！${equipInfo.item}${qty ? `（${qty}）` : ''} → ${equipInfo.location}やな🌱`);
    return;
  }

  // ⑥ ジュニア Q&A
  try {
    const [equipment, staff, vendors, artists] = await Promise.all([
      getSheetData('equipment'),
      getSheetData('staff'),
      getSheetData('vendor'),
      getSheetData('artist'),
    ]);
    const response = await generateJuniorResponse(text, groupName, { equipment, staff, vendors, artists });
    if (response) await safeReply(replyToken, userId, response);
  } catch (err) {
    logger.error({ err: err.message }, 'Junior応答失敗');
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
