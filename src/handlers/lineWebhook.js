/**
 * LINE Webhook ハンドラ（Render 版）
 *
 * 動作:
 * 1. 署名検証 → 不正なら 401
 * 2. 早期 200 返却（LINE リトライ防止）
 * 3. 全テキストメッセージ → GAS "📱 LINEリアルタイム" シートにログ
 * 4. OpenAI でタスク抽出 → タスクあれば GAS "📋 タスク" シートに追記
 * 5. タスクが抽出できた場合のみ LINE グループに確認返信
 */
const { verifyLineSignature } = require('../middleware/lineSignature');
const { extractTasks } = require('../services/openaiService');
const { reply } = require('../services/lineService');
const { postToGas } = require('../services/gasService');
const { assertRequired } = require('../config');
const { logger } = require('../utils/logger');

// groupId → groupName のインメモリキャッシュ（プロセス再起動でリセット）
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
  const timestamp = new Date(event.timestamp || Date.now()).toISOString();

  const groupName = groupId ? await fetchGroupName(groupId) : 'DM';

  logger.info({ sourceType, groupName, textLen: text.length }, 'メッセージ受信');

  // 1. 全メッセージをリアルタイムログシートに記録
  postToGas({
    type: 'lineLog',
    messages: [{ timestamp, groupId: groupId || 'direct', groupName, userId, text }],
  }).catch(err => logger.error({ err: err.message }, 'GAS ログ送信失敗'));

  // 2. タスク抽出（グループ名を文脈として渡す）
  let tasks;
  try {
    tasks = await extractTasks(text, groupName);
  } catch (err) {
    logger.error({ err: err.message }, 'extractTasks 失敗');
    return;
  }

  if (!tasks || tasks.length === 0) return;

  // 3. 抽出タスクをシートに記録
  await postToGas({
    type: 'task',
    groupName,
    groupId: groupId || 'direct',
    userId,
    originalText: text,
    timestamp,
    tasks,
  }).catch(err => logger.error({ err: err.message }, 'GAS タスク送信失敗'));

  // 4. LINE への確認返信（タスクが見つかった場合のみ）
  if (replyToken) {
    const msg = buildReplyMessage(tasks);
    await safeReply(replyToken, userId, msg);
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

function buildReplyMessage(tasks) {
  const lines = [`✅ タスク ${tasks.length}件 登録しました！`];
  tasks.slice(0, 5).forEach((t, i) => {
    lines.push(`${i + 1}. ${t.task}`);
    if (t.assignee) lines.push(`   担当: ${t.assignee}`);
    if (t.deadline) lines.push(`   期限: ${t.deadline}`);
  });
  if (tasks.length > 5) lines.push(`   …他 ${tasks.length - 5} 件`);
  return lines.join('\n');
}

async function safeReply(replyToken, userId, text) {
  try {
    await reply(replyToken, text, userId);
  } catch (err) {
    logger.error({ err: err.message }, 'reply 失敗');
  }
}

module.exports = { handleWebhook };
