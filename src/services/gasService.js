/**
 * GAS doPost Web App への HTTP POST
 * Google Sheets への書き込みプロキシとして使用（Render から直接 Sheets API 認証不要）
 */
const { env } = require('../config');
const { logger } = require('../utils/logger');

/**
 * @param {Object} payload - { type: 'lineLog'|'task', ... }
 */
async function postToGas(payload) {
  const url = env.GAS_WEBHOOK_URL;
  if (!url) {
    logger.warn('GAS_WEBHOOK_URL 未設定 — スキップ');
    return false;
  }

  const body = JSON.stringify({
    ...payload,
    secret: env.GAS_SECRET_TOKEN,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'GAS POST 失敗');
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err: err.message }, 'GAS POST エラー');
    return false;
  }
}

module.exports = { postToGas };
