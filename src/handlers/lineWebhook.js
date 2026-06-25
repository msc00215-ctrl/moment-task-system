/**
 * LINE Webhook ハンドラ（Render 版）
 *
 * セキュリティ対策:
 * - LINE署名検証（不正リクエストを401で弾く）
 * - レート制限（1ユーザー1分10件まで）
 * - データ参照コマンドのブロック
 * - ログ保存前に個人情報（電話番号・メール）をマスキング
 * - Botの返答に個人情報・システム情報を含めない
 */
const { verifyLineSignature } = require('../middleware/lineSignature');
const { extractTasks, generateResponse } = require('../services/openaiService');
const { reply } = require('../services/lineService');
const { postToGas, getSheetData } = require('../services/gasService');
const { assertRequired } = require('../config');
const { logger } = require('../utils/logger');
const { maskPII, isDataQuery, checkRateLimit } = require('../utils/security');

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

  // ① レート制限チェック（返信なし・ログのみ）
  if (!checkRateLimit(userId)) {
    logger.warn({ userId }, 'レート制限超過');
    return;
  }

  // ② データ参照コマンドのブロック（返信なし・ログのみ）
  if (isDataQuery(text)) {
    logger.info({ userId, groupName }, 'データ参照コマンドをブロック');
    return;
  }

  // ③ 個人情報マスキングしてからログ保存
  const maskedText = maskPII(text);
  postToGas({
    type: 'lineLog',
    messages: [{ timestamp, groupId: groupId || 'direct', groupName, userId, text: maskedText }],
  }).catch(err => logger.error({ err: err.message }, 'GAS ログ送信失敗'));

  // ④ タスク抽出（元テキストをAIに渡す。PIIはOpenAIプロンプトで除外指示済み）
  let tasks;
  try {
    tasks = await extractTasks(text, groupName);
  } catch (err) {
    logger.error({ err: err.message }, 'extractTasks 失敗');
    return;
  }

  // ⑤ タスクがある → Sheetsに黙って保存、返信なし
  if (tasks && tasks.length > 0) {
    await postToGas({
      type: 'task',
      groupName,
      groupId: groupId || 'direct',
      userId,
      originalText: maskedText,
      timestamp,
      tasks,
    }).catch(err => logger.error({ err: err.message }, 'GAS タスク送信失敗'));
    return; // 返信なし
  }

  // ⑥ 質問応答は一時停止中
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
