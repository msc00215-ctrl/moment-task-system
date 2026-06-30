/**
 * Google 認証ユーティリティ（全サービス共通）
 *
 * 優先順位:
 * 1. GOOGLE_SERVICE_ACCOUNT_JSON 環境変数（Render本番: JSON文字列を直接設定）
 * 2. GOOGLE_APPLICATION_CREDENTIALS 環境変数（ファイルパス指定）
 * 3. ADC（Application Default Credentials）
 */
const { google } = require('googleapis');

let cachedAuth = null;

async function getGoogleAuth(scopes = ['https://www.googleapis.com/auth/spreadsheets']) {
  if (cachedAuth) return cachedAuth;

  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonStr) {
    const credentials = JSON.parse(jsonStr);
    cachedAuth = new google.auth.GoogleAuth({ credentials, scopes });
  } else {
    // ファイルパス指定 or ADC
    cachedAuth = new google.auth.GoogleAuth({ scopes });
  }
  return cachedAuth;
}

async function getSheetsClient() {
  const auth = await getGoogleAuth();
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

module.exports = { getGoogleAuth, getSheetsClient };
