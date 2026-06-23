/**
 * Areas マスタリポジトリ
 * - シート 'Areas' は (AreaId, AreaName, ...) を想定
 * - 完全一致で AreaId を解決
 */
const { readRange } = require('../services/sheetsService');
const { TTLCache } = require('../utils/cache');
const { logger } = require('../utils/logger');

const CACHE_TTL_MS = 10 * 60 * 1000; // Area はさらに変更頻度低い
const cache = new TTLCache(CACHE_TTL_MS);
const CACHE_KEY = 'areas:all';

const COL_AREA_ID = 0;
const COL_AREA_NAME = 1;

async function loadAll() {
  return cache.getOrLoad(CACHE_KEY, async () => {
    try {
      const rows = await readRange('Areas!A:Z');
      return rows.slice(1).filter((r) => r[COL_AREA_ID]);
    } catch (err) {
      logger.error({ err: err.message }, 'Areas マスタ読み込み失敗');
      return [];
    }
  });
}

/**
 * @param {string|null} name
 * @returns {Promise<string|null>}
 */
async function resolveAreaIdByName(name) {
  if (!name) return null;
  const areas = await loadAll();
  const hit = areas.find((a) => a[COL_AREA_NAME] === name);
  return hit ? hit[COL_AREA_ID] : null;
}

function invalidate() {
  cache.invalidate(CACHE_KEY);
}

module.exports = { resolveAreaIdByName, invalidate };
