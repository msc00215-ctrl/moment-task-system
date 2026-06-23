/**
 * 指数バックオフ + ジッターでリトライ
 * - 外部 API (OpenAI / LINE / Sheets) の一時的な失敗から守る
 * - 4xx (リトライ不可) と 5xx / ネットワーク (リトライ可) を区別
 */
const { logger } = require('./logger');

const DEFAULT_OPTS = {
  retries: 3,
  baseDelayMs: 300,
  maxDelayMs: 4000,
  factor: 2,
};

/**
 * @param {() => Promise<T>} fn - リトライ対象の関数
 * @param {object} [options]
 * @param {(err: Error) => boolean} [options.shouldRetry] - リトライ判定
 * @returns {Promise<T>}
 */
async function withRetry(fn, options = {}) {
  const opts = { ...DEFAULT_OPTS, ...options };
  let lastErr;

  for (let attempt = 0; attempt <= opts.retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = options.shouldRetry ? options.shouldRetry(err) : isTransient(err);
      if (!retryable || attempt === opts.retries) {
        throw err;
      }
      const delay = Math.min(opts.baseDelayMs * opts.factor ** attempt, opts.maxDelayMs);
      const jitter = Math.floor(Math.random() * delay * 0.3);
      logger.warn({ attempt: attempt + 1, delayMs: delay + jitter, err: err.message }, 'リトライします');
      await sleep(delay + jitter);
    }
  }
  throw lastErr;
}

function isTransient(err) {
  // ネットワーク系
  if (['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'].includes(err.code)) return true;
  // HTTP ステータス系
  const status = err.status || err.response?.status;
  if (status === 429) return true; // レート制限
  if (status >= 500 && status < 600) return true; // サーバ側障害
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { withRetry, sleep };
