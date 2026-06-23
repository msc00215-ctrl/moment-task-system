/**
 * 集中設定モジュール（Render / env var 版）
 * GCP_PROJECT_ID / Secret Manager は不使用。env var から直接取得。
 */

const env = {
  NODE_ENV: process.env.NODE_ENV || 'production',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  SPREADSHEET_ID: process.env.SPREADSHEET_ID || '',
  GAS_WEBHOOK_URL: process.env.GAS_WEBHOOK_URL || '',
  GAS_SECRET_TOKEN: process.env.GAS_SECRET_TOKEN || '',
};

function requireEnv(key) {
  if (!process.env[key]) throw new Error(`環境変数 ${key} が未設定`);
  return process.env[key];
}

const credentials = {
  openaiApiKey: () => Promise.resolve(requireEnv('OPENAI_API_KEY')),
  lineChannelAccessToken: () => Promise.resolve(requireEnv('LINE_CHANNEL_ACCESS_TOKEN')),
  lineChannelSecret: () => Promise.resolve(requireEnv('LINE_CHANNEL_SECRET')),
  appsheetAccessKey: () => Promise.resolve(process.env.APPSHEET_ACCESS_KEY || ''),
};

function assertRequired() {
  const missing = [];
  if (!env.GAS_WEBHOOK_URL) missing.push('GAS_WEBHOOK_URL');
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) missing.push('LINE_CHANNEL_ACCESS_TOKEN');
  if (!process.env.LINE_CHANNEL_SECRET) missing.push('LINE_CHANNEL_SECRET');
  if (!process.env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (missing.length > 0) throw new Error(`必須環境変数が未設定: ${missing.join(', ')}`);
}

module.exports = { env, credentials, assertRequired };
