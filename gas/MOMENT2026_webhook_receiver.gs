/**
 * MOMENT 2026 LINE Bot Webhook レシーバー
 *
 * シート構成:
 *   📋 タスク（現役）  ← 常に最新状態のみ。同じタスクは上書き更新
 *   ✅ 完了タスク      ← 完了したタスクを自動アーカイブ
 *   📱 LINEリアルタイム ← 直近500件のみ保持（古いものは自動削除）
 *
 * デプロイ手順:
 * 1. GASエディタ → デプロイ → 新しいデプロイ（または既存を更新）
 * 2. 種類: ウェブアプリ / 実行ユーザー: 自分 / アクセス: 全員
 * 3. URL を Render の GAS_WEBHOOK_URL 環境変数に設定
 */

const SPREADSHEET_ID = '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ';
const SECRET_TOKEN   = PropertiesService.getScriptProperties().getProperty('GAS_SECRET_TOKEN') || '';

const SHEET_TASKS    = '📋 タスク（現役）';
const SHEET_DONE     = '✅ 完了タスク';
const SHEET_LINE_LOG = '📱 LINEリアルタイム';
const LINE_LOG_MAX   = 500; // LINEログの最大保持件数

const TASK_HEADERS = [
  '最終更新', 'グループ名', '担当者', '部署', 'タスク内容',
  '期限', '優先度', 'ステータス', '初回登録', '元メッセージ'
];
const LINE_HEADERS = ['タイムスタンプ', 'グループ名', 'ユーザーID', 'メッセージ'];

// 列インデックス（0始まり）
const COL = {
  LAST_UPDATED: 0,
  GROUP:        1,
  ASSIGNEE:     2,
  DEPARTMENT:   3,
  TASK:         4,
  DEADLINE:     5,
  PRIORITY:     6,
  STATUS:       7,
  CREATED:      8,
  ORIGINAL:     9,
};

// ─────────────────────────────────────────────
// エントリポイント
// ─────────────────────────────────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (SECRET_TOKEN && data.secret !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (data.type === 'lineLog') {
      writeLineLog(ss, data.messages || []);
    } else if (data.type === 'task') {
      upsertTasks(ss, data);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('doPost エラー:', err.message);
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ─────────────────────────────────────────────
// タスク: upsert（同じタスクは上書き、完了は即アーカイブ）
// ─────────────────────────────────────────────

function upsertTasks(ss, data) {
  const tasks = data.tasks || [];
  if (!tasks.length) return;

  const activeSheet = getOrCreateSheet(ss, SHEET_TASKS, TASK_HEADERS);
  const doneSheet   = getOrCreateSheet(ss, SHEET_DONE,  TASK_HEADERS);

  const now = new Date().toISOString();

  tasks.forEach(t => {
    const taskText   = (t.task       || '').trim();
    const assignee   = (t.assignee   || '').trim();
    const department = (t.department || data.groupName || '').trim();
    const deadline   = t.deadline   || '';
    const priority   = t.priority   || '中';
    const status     = t.status     || '未着手';
    const original   = (data.originalText || '').slice(0, 200);
    const groupName  = data.groupName || '';

    if (!taskText) return;

    const isCompleted = status === '完了';

    // アクティブシートで既存行を検索
    const activeRows   = activeSheet.getDataRange().getValues();
    const existingIdx  = findTaskRow(activeRows, taskText, assignee);

    if (isCompleted) {
      // 完了 → アクティブから削除してアーカイブへ移動
      if (existingIdx >= 0) {
        activeSheet.deleteRow(existingIdx + 1); // 1始まり
      }
      const doneRow = [now, groupName, assignee, department, taskText,
                       deadline, priority, '完了', now, original];
      doneSheet.getRange(doneSheet.getLastRow() + 1, 1, 1, doneRow.length).setValues([doneRow]);
    } else {
      // 未着手/対応中/予定 → upsert
      if (existingIdx >= 0) {
        // 既存行を上書き（最終更新・ステータス等のみ更新、初回登録は保持）
        const existingCreated = activeRows[existingIdx][COL.CREATED] || now;
        const updatedRow = [now, groupName, assignee, department, taskText,
                            deadline, priority, status, existingCreated, original];
        activeSheet.getRange(existingIdx + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
      } else {
        // 新規追加
        const newRow = [now, groupName, assignee, department, taskText,
                        deadline, priority, status, now, original];
        activeSheet.getRange(activeSheet.getLastRow() + 1, 1, 1, newRow.length).setValues([newRow]);
      }
    }
  });

  applyTaskFormatting(activeSheet);
}

// タスク内容 + 担当者でマッチ（担当者未設定の場合はタスク内容のみで照合）
function findTaskRow(rows, taskText, assignee) {
  for (let i = 1; i < rows.length; i++) {
    const rowTask     = (rows[i][COL.TASK]     || '').trim();
    const rowAssignee = (rows[i][COL.ASSIGNEE] || '').trim();
    if (!rowTask) continue;

    const taskMatch     = rowTask === taskText;
    const assigneeMatch = !assignee || !rowAssignee || rowAssignee === assignee;

    if (taskMatch && assigneeMatch) return i;
  }
  return -1;
}

// ステータスに応じて行の背景色を変更
function applyTaskFormatting(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const statusCol = COL.STATUS + 1; // 1始まり
  const statuses  = sheet.getRange(2, statusCol, lastRow - 1, 1).getValues();

  statuses.forEach((row, i) => {
    const rowNum = i + 2;
    let color = '#FFFFFF';
    if (row[0] === '対応中')  color = '#FFF9C4'; // 黄
    if (row[0] === '予定')    color = '#E8F5E9'; // 緑薄
    if (row[0] === '調整中')  color = '#FCE4EC'; // ピンク
    sheet.getRange(rowNum, 1, 1, TASK_HEADERS.length).setBackground(color);
  });
}

// ─────────────────────────────────────────────
// LINEログ: 追記 + 500件超過分を自動削除
// ─────────────────────────────────────────────

function writeLineLog(ss, messages) {
  if (!messages.length) return;

  const sheet = getOrCreateSheet(ss, SHEET_LINE_LOG, LINE_HEADERS);

  const rows = messages.map(m => [
    m.timestamp || new Date().toISOString(),
    m.groupName || '',
    m.userId    || '',
    m.text      || '',
  ]);

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

  // 500件を超えた古い行を削除
  const total = sheet.getLastRow() - 1; // ヘッダー除く
  if (total > LINE_LOG_MAX) {
    const excess = total - LINE_LOG_MAX;
    sheet.deleteRows(2, excess); // ヘッダーの次の行から古い順に削除
  }
}

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

function getOrCreateSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1A237E')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, headers.length, 140);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────
// 初回セットアップ用（1回だけ実行）
// ─────────────────────────────────────────────

function setupSecretToken() {
  const token = 'ここにランダムな文字列を入れる（例: moment2026_secret_abc123）';
  PropertiesService.getScriptProperties().setProperty('GAS_SECRET_TOKEN', token);
  console.log('GAS_SECRET_TOKEN を設定しました:', token);
}
