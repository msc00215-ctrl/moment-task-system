/**
 * Render / ローカル用: env var から直接取得（Secret Manager 不使用）
 * secret名のハイフンをアンダースコアに変換して大文字化して探す
 * 例: 'openai-api-key' → OPENAI_API_KEY
 */
const { logger } = require('../utils/logger');

async function getSecret(secretName, localEnvKey) {
  if (localEnvKey && process.env[localEnvKey]) return process.env[localEnvKey];

  const envKey = secretName.toUpperCase().replace(/-/g, '_');
  if (process.env[envKey]) return process.env[envKey];

  logger.error({ secretName, envKey }, '環境変数未設定');
  throw new Error(`環境変数が未設定: ${envKey}`);
}

function invalidateSecretCache() {}

module.exports = { getSecret, invalidateSecretCache };
