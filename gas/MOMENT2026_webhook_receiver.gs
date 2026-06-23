/**
 * MOMENT 2026 LINE Bot Webhook レシーバー
 * Render から POST されたデータを Google Sheets に書き込む
 *
 * デプロイ手順:
 * 1. GASエディタ → デプロイ → 新しいデプロイ
 * 2. 種類: ウェブアプリ
 * 3. 実行ユーザー: 自分
 * 4. アクセス: 全員（匿名を含む）
 * 5. デプロイ → URL を Render の GAS_WEBHOOK_URL 環境変数に設定
 */

const SPREADSHEET_ID = '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ';
const SECRET_TOKEN = PropertiesService.getScriptProperties().getProperty('GAS_SECRET_TOKEN') || '';

const SHEET_LINE_LOG = '📱 LINEリアルタイム';
const SHEET_TASKS    = '📋 タスク自動抽出';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // トークン検証（設定している場合のみ）
    if (SECRET_TOKEN && data.secret !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 403);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (data.type === 'lineLog') {
      writeLineLog(ss, data.messages || []);
    } else if (data.type === 'task') {
      writeTasks(ss, data);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('doPost エラー:', err.message);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function writeLineLog(ss, messages) {
  if (!messages.length) return;
  const sheet = getOrCreateSheet(ss, SHEET_LINE_LOG, [
    'タイムスタンプ', 'グループ名', 'グループID', 'ユーザーID', 'メッセージ'
  ]);

  const rows = messages.map(m => [
    m.timestamp || new Date().toISOString(),
    m.groupName  || '',
    m.groupId    || '',
    m.userId     || '',
    m.text       || '',
  ]);

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function writeTasks(ss, data) {
  const tasks = data.tasks || [];
  if (!tasks.length) return;

  const sheet = getOrCreateSheet(ss, SHEET_TASKS, [
    'タイムスタンプ', 'グループ名', 'ユーザーID', 'タスク内容',
    '担当者', '部署', '期限', '優先度', 'ステータス', '元メッセージ'
  ]);

  const rows = tasks.map(t => [
    data.timestamp    || new Date().toISOString(),
    data.groupName    || '',
    data.userId       || '',
    t.task            || '',
    t.assignee        || '',
    t.department      || '',
    t.deadline        || '',
    t.priority        || '中',
    t.status          || '未着手',
    data.originalText || '',
  ]);

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function getOrCreateSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#E8F0FE');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse(obj, code) {
  const output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// スクリプトプロパティに GAS_SECRET_TOKEN を設定するユーティリティ（1回だけ実行）
function setupSecretToken() {
  const token = 'ここにランダムな文字列を入れる（例: moment2026_secret_abc123）';
  PropertiesService.getScriptProperties().setProperty('GAS_SECRET_TOKEN', token);
  console.log('GAS_SECRET_TOKEN を設定しました:', token);
}
