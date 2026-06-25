/**
 * GAS Web App との通信
 * - doPost: Sheets への書き込みプロキシ
 * - doGet:  備品・スタッフデータの読み取り（10分キャッシュ）
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

// ─── 読み取りキャッシュ（10分TTL）───────────────────────
const _cache = new Map();
const CACHE_TTL = 10 * 60_000;

/**
 * GAS doGet からシートデータを取得（キャッシュあり）
 * @param {'equipment'|'staff'} type
 * @returns {Promise<Array>}
 */
async function getSheetData(type) {
  const url = env.GAS_WEBHOOK_URL;
  if (!url) return [];

  const cached = _cache.get(type);
  if (cached && Date.now() < cached.expiry) return cached.data;

  try {
    const getUrl = new URL(url);
    getUrl.searchParams.set('type', type);
    if (env.GAS_SECRET_TOKEN) getUrl.searchParams.set('secret', env.GAS_SECRET_TOKEN);

    const res = await fetch(getUrl.toString(), { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      logger.warn({ status: res.status, type }, 'GAS GET 失敗');
      return cached?.data || [];
    }

    const json = await res.json();
    const data = json.ok ? (json.data || []) : [];
    _cache.set(type, { data, expiry: Date.now() + CACHE_TTL });
    logger.info({ type, count: data.length }, 'GAS シートデータ取得');
    return data;
  } catch (err) {
    logger.warn({ err: err.message, type }, 'GAS GET エラー — キャッシュで継続');
    return cached?.data || [];
  }
}

module.exports = { postToGas, getSheetData };
