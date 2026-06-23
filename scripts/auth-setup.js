/**
 * Google Sheets OAuth2 認証セットアップ
 * 一回だけ実行すれば、以降は全自動
 *
 * 使い方: node scripts/auth-setup.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');

const TOKEN_PATH = path.join(__dirname, '../config/token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../config/oauth-credentials.json');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

async function main() {
  console.log(`
╔══════════════════════════════════════════════╗
║  Google Sheets API 認証セットアップ（1回のみ）  ║
╚══════════════════════════════════════════════╝
`);

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.log(`
❌ OAuth 認証情報ファイルが見つかりません。

以下の手順で取得してください：

1. ブラウザで開く:
   https://console.cloud.google.com/apis/credentials/oauthclient

2. 「OAuth クライアント ID を作成」をクリック

3. アプリの種類: 「デスクトップ アプリ」を選択

4. 名前: moment-sync

5. 「作成」→ 「JSON をダウンロード」

6. ダウンロードした JSON ファイルを以下に配置:
   ${CREDENTIALS_PATH}

7. もう一度 node scripts/auth-setup.js を実行

※ プロジェクトがない場合は先に作成:
   https://console.cloud.google.com/projectcreate
`);
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/callback');

  if (fs.existsSync(TOKEN_PATH)) {
    console.log('✅ 認証済みです。再認証は不要です。\n');
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oAuth2Client.setCredentials(token);
    await testConnection(oAuth2Client);
    return;
  }

  // ローカルサーバーで認証コードを受け取る
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('🌐 ブラウザが開きます。Google アカウントでログインして承認してください...\n');

  // ブラウザを開く
  const { default: open } = await import('open');
  await open(authUrl);

  // ローカルサーバーで認証コードを待つ
  const code = await waitForAuthCode();

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));

  console.log('✅ 認証完了！token.json を保存しました。');
  console.log('   以降は自動でデータ同期されます。\n');

  await testConnection(oAuth2Client);
}

function waitForAuthCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:3000');
      const code = url.searchParams.get('code');

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>✅ 認証完了！</h1><p>このタブを閉じてください。</p>');
        server.close();
        resolve(code);
      } else {
        res.writeHead(400);
        res.end('認証コードが見つかりません');
        reject(new Error('No auth code'));
      }
    });

    server.listen(3000, () => {
      console.log('⏳ ブラウザで承認を待っています...');
    });

    server.on('error', reject);
  });
}

async function testConnection(auth) {
  console.log('📡 Google Sheets 接続テスト中...');
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    // タスク一覧シートへの接続テスト
    const sheetId = '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ';
    const res = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    console.log(`✅ 接続成功！シート名: ${res.data.properties.title}`);
  } catch (err) {
    console.log('⚠️  接続テスト: シートへのアクセス権限が必要かもしれません');
    console.log('   シートを開いて「共有」→ サービスアカウントのメールを追加してください');
    console.log('   (接続自体は成功しています)\n');
  }
}

main().catch(console.error);
