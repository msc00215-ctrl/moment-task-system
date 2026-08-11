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
 * グループメンバーのリストを取得
 * @param {string} groupId - LINE グループID
 * @returns {Promise<Array>} メンバーのプロフィール配列（displayName, userId, pictureUrl 含む）
 */
async function getGroupMembers(groupId) {
  if (!groupId) {
    throw new Error('groupId は必須です');
  }

  const client = await getClient();

  try {
    // グループメンバーの全 userIds を取得
    // 最大 100 件ずつ取次できるため、ページネーションで全件取得
    let memberIds = [];
    let start = undefined;

    // 最初のページを取得
    const firstResult = await withRetry(() =>
      client.getGroupMembersIds(groupId, { limit: 100 })
    );
    memberIds = memberIds.concat(firstResult.memberIds || []);
    start = firstResult.next;

    // 2ページ目以降があればループで取得
    while (start) {
      const result = await withRetry(() =>
        client.getGroupMembersIds(groupId, { limit: 100, start })
      );
      memberIds = memberIds.concat(result.memberIds || []);
      start = result.next;
    }

    logger.info({ groupId, count: memberIds.length }, 'グループメンバーID取得完了');

    // 各メンバーのプロフィール情報を並行取得
    const profiles = await Promise.all(
      memberIds.map(userId =>
        withRetry(() => client.getProfile(userId))
          .catch(err => {
            logger.warn({ userId, err: err.message }, 'プロフィール取得失敗');
            return null;
          })
      )
    );

    // null（取得失敗）を除外し、結果を整形
    return profiles.filter(Boolean).map(profile => ({
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl || '',
      statusMessage: profile.statusMessage || '',
    }));
  } catch (err) {
    logger.error({ groupId, err: err.message }, 'グループメンバー取得失敗');
    throw err;
  }
}

function truncate(text, max) {
  if (typeof text !== 'string') return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

module.exports = { getClient, reply, getChannelSecret, getGroupMembers };
