/**
 * LINE Messaging API ラッパ
 * - replyToken は 30 秒で失効するため reply 系は最優先
 * - 失効時は push にフォールバック
 */
const line = require('@line/bot-sdk');
const { credentials } = require('../config');
const { withRetry } = require('../utils/retry');
const { logger } = require('../utils/logger');

let cachedClient;
let cachedSecret;

async function getClient() {
  if (cachedClient) return cachedClient;
  const accessToken = await credentials.lineChannelAccessToken();
  cachedClient = new line.messagingApi.MessagingApiClient({ channelAccessToken: accessToken });
  return cachedClient;
}

async function getChannelSecret() {
  if (cachedSecret) return cachedSecret;
  cachedSecret = await credentials.lineChannelSecret();
  return cachedSecret;
}

/**
 * 返信。replyToken 失効時は userId 指定の push にフォールバックする。
 */
async function reply(replyToken, text, fallbackUserId) {
  const client = await getClient();
  const messages = [{ type: 'text', text: truncate(text, 5000) }];

  try {
    await withRetry(() => client.replyMessage({ replyToken, messages }), { retries: 2 });
  } catch (err) {
    logger.warn({ err: err.message }, 'reply 失敗 — push にフォールバック');
    if (fallbackUserId) {
      try {
        await withRetry(() => client.pushMessage({ to: fallbackUserId, messages }), { retries: 2 });
      } catch (pushErr) {
        logger.error({ err: pushErr.message }, 'push も失敗 — 通知断念');
      }
    }
  }
}

/**
 * Push メッセージ送信（複数メッセージ対応）
 * @returns {Promise<Array<{id: string, quoteToken: string}>>} 送信済みメッセージ一覧
 */
async function pushMessages(to, messages) {
  const client = await getClient();
  try {
    const res = await withRetry(
      () => client.pushMessage({ to, messages }),
      { retries: 2 },
    );
    return res?.sentMessages || [];
  } catch (err) {
    logger.error({ err: err.message }, 'pushMessages 失敗');
    return [];
  }
}

/**
 * メッセージをグループ/チャットにピン止め
 */
async function pinMessage(chatId, messageId) {
  try {
    const accessToken = await credentials.lineChannelAccessToken();
    const res = await fetch(
      `https://api.line.me/v3/bot/chat/${encodeURIComponent(chatId)}/pin`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageId }),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      logger.warn({ status: res.status, body }, 'pinMessage 失敗（スキップ）');
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'pinMessage エラー（スキップ）');
  }
}

function truncate(text, max) {
  if (typeof text !== 'string') return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

module.exports = { getClient, reply, getChannelSecret, pushMessages, pinMessage };
