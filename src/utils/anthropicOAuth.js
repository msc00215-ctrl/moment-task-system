/**
 * Anthropic OAuth トークン自動リフレッシュ
 *
 * OAuthアクセストークンは期限切れになるが、リフレッシュトークンは長期間有効。
 * 401エラーを検知してトークンを自動更新し、リクエストを再実行する。
 *
 * 必要な環境変数:
 *   ANTHROPIC_OAUTH_ACCESS_TOKEN  - アクセストークン（期限切れでも可）
 *   ANTHROPIC_OAUTH_REFRESH_TOKEN - リフレッシュトークン
 *   ANTHROPIC_OAUTH_CLIENT_ID     - OAuthクライアントID
 */
const Anthropic = require('@anthropic-ai/sdk');
const { logger } = require('./logger');

const TOKEN_ENDPOINT = 'https://claude.ai/oauth/token';

let currentAccessToken = process.env.ANTHROPIC_OAUTH_ACCESS_TOKEN || '';
let client = null;

function buildOAuthClient(accessToken) {
  return new Anthropic({
    authToken: accessToken,
    defaultHeaders: { 'anthropic-beta': 'oauth-2025-04-20' },
  });
}

function buildApiKeyClient(apiKey) {
  return new Anthropic({ apiKey });
}

async function refreshAccessToken() {
  const refreshToken = process.env.ANTHROPIC_OAUTH_REFRESH_TOKEN;
  const clientId = process.env.ANTHROPIC_OAUTH_CLIENT_ID;

  if (!refreshToken || !clientId) {
    throw new Error(
      'ANTHROPIC_OAUTH_REFRESH_TOKEN と ANTHROPIC_OAUTH_CLIENT_ID が必要です'
    );
  }

  logger.info('Anthropic OAuthトークンをリフレッシュ中...');

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`トークンリフレッシュ失敗 ${res.status}: ${body}`);
  }

  const data = await res.json();
  currentAccessToken = data.access_token;

  // 新しいリフレッシュトークンが返ってきた場合は更新
  if (data.refresh_token) {
    process.env.ANTHROPIC_OAUTH_REFRESH_TOKEN = data.refresh_token;
  }

  client = buildOAuthClient(currentAccessToken);
  logger.info('OAuthトークンのリフレッシュ完了');
  return client;
}

async function getClient() {
  if (client) return client;

  // 起動時に必ずリフレッシュして新鮮なトークンを取得
  if (process.env.ANTHROPIC_OAUTH_REFRESH_TOKEN && process.env.ANTHROPIC_OAUTH_CLIENT_ID) {
    return refreshAccessToken();
  }

  // OAuthアクセストークン直接指定
  if (currentAccessToken) {
    client = buildOAuthClient(currentAccessToken);
    return client;
  }

  // 通常のAPIキーにフォールバック
  if (process.env.ANTHROPIC_API_KEY) {
    client = buildApiKeyClient(process.env.ANTHROPIC_API_KEY);
    return client;
  }

  throw new Error(
    'ANTHROPIC_OAUTH_REFRESH_TOKEN、ANTHROPIC_OAUTH_ACCESS_TOKEN、ANTHROPIC_API_KEY のいずれかが必要です'
  );
}

/**
 * 401（トークン期限切れ）を検知して自動リフレッシュ後にリトライするラッパー
 * @param {(client: Anthropic) => Promise<T>} fn
 */
async function withTokenRefresh(fn) {
  const c = await getClient();
  try {
    return await fn(c);
  } catch (err) {
    const is401 = err?.status === 401 && err?.error?.error?.type === 'authentication_error';
    const hasRefresh = process.env.ANTHROPIC_OAUTH_REFRESH_TOKEN && process.env.ANTHROPIC_OAUTH_CLIENT_ID;
    if (!is401 || !hasRefresh) throw err;

    logger.warn('OAuthトークン期限切れ — 自動リフレッシュ');
    client = null;
    const refreshed = await refreshAccessToken();
    return await fn(refreshed);
  }
}

module.exports = { getClient, withTokenRefresh };
