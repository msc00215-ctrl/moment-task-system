/**
 * LINE Webhook 署名検証
 * - x-line-signature ヘッダと Channel Secret から HMAC-SHA256 を計算し比較
 * - functions-framework は req.rawBody を保持してくれる (Cloud Functions では既定で利用可能)
 */
const crypto = require('node:crypto');
const { getChannelSecret } = require('../services/lineService');
const { logger } = require('../utils/logger');

async function verifyLineSignature(req) {
  const signature = req.get('x-line-signature') || req.headers['x-line-signature'];
  if (!signature) return false;

  const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  if (!rawBody) {
    logger.warn('rawBody が空 — 署名検証不能');
    return false;
  }

  let secret;
  try {
    secret = await getChannelSecret();
  } catch (err) {
    logger.error({ err: err.message }, 'Channel Secret 取得失敗 — 検証不能');
    return false;
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

module.exports = { verifyLineSignature };
