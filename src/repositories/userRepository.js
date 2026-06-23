/**
 * Users マスタリポジトリ
 * - シート 'Users' は (UserId, Name, ...) の構造を想定
 * - 名前 → UserId 解決を頻繁に行うのでキャッシュで高速化
 *   AppSheet 同期速度の本質は「Sheets API の往復回数」を減らすこと。
 *   Users はほぼ静的なのでキャッシュ TTL は長め (5分)。
 */
const { readRange } = require('../services/sheetsService');
const { TTLCache } = require('../utils/cache');
const { logger } = require('../utils/logger');

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new TTLCache(CACHE_TTL_MS);
const CACHE_KEY = 'users:all';

const COL_USER_ID = 0;
const COL_NAME = 1;

async function loadAll() {
  return cache.getOrLoad(CACHE_KEY, async () => {
    try {
      const rows = await readRange('Users!A:Z');
      // ヘッダ行を除く
      return rows.slice(1).filter((r) => r[COL_USER_ID]);
    } catch (err) {
      logger.error({ err: err.message }, 'Users マスタ読み込み失敗');
      return [];
    }
  });
}

/**
 * 名前で UserId を引く。部分一致 (元プロトの indexOf と同等)。
 * @param {string|null} name
 * @returns {Promise<string>} 見つからなければ 'UNASSIGNED'
 */
async function resolveUserIdByName(name) {
  if (!name) return 'UNASSIGNED';
  const users = await loadAll();
  const hit = users.find((u) => typeof u[COL_NAME] === 'string' && u[COL_NAME].includes(name));
  return hit ? hit[COL_USER_ID] : 'UNASSIGNED';
}

function invalidate() {
  cache.invalidate(CACHE_KEY);
}

module.exports = { resolveUserIdByName, invalidate };
