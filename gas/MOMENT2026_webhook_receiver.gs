/**
 * MOMENT 2026 LINE Bot Webhook レシーバー
 *
 * シート構成:
 *   📋 タスク（現役）  ← 常に最新状態のみ。同じタスクは上書き更新
 *   ✅ 完了タスク      ← 完了したタスクを自動アーカイブ
 *   📱 LINEリアルタイム ← 直近500件のみ保持（古いものは自動削除）
 *   📦 備品・資材      ← 備品の保管場所・数量管理
 *   👥 スタッフ        ← スタッフ名・部署・シフト管理
 *   🔗 リンク集        ← 関連スプレッドシートへのリンク
 *
 * デプロイ手順:
 * 1. GASエディタ → デプロイ → 新しいデプロイ（または既存を更新）
 * 2. 種類: ウェブアプリ / 実行ユーザー: 自分 / アクセス: 全員
 * 3. URL を Render の GAS_WEBHOOK_URL 環境変数に設定
 */

const SPREADSHEET_ID   = '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ';
const SCHEDULE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY/edit';
const SECRET_TOKEN     = PropertiesService.getScriptProperties().getProperty('GAS_SECRET_TOKEN') || '';

const SHEET_TASKS      = '📋 タスク（現役）';
const SHEET_DONE       = '✅ 完了タスク';
const SHEET_LINE_LOG   = '📱 LINEリアルタイム';
const SHEET_EQUIPMENT  = '📦 備品・資材';
const SHEET_STAFF      = '👥 スタッフ';
const SHEET_LINKS      = '🔗 リンク集';
const LINE_LOG_MAX     = 500;

const TASK_HEADERS = [
  '最終更新', 'グループ名', '担当者', '部署', 'タスク内容',
  '期限', '優先度', 'ステータス', '初回登録', '元メッセージ'
];
const LINE_HEADERS = ['タイムスタンプ', 'グループ名', 'ユーザーID', 'メッセージ'];
const EQUIPMENT_HEADERS = ['アイテム名', 'カテゴリ', '数量', '単位', '保管場所', '担当部署', '備考'];
const STAFF_HEADERS     = ['名前', '部署', '役割', '入り日時', '退場日時', '備考'];
const LINKS_HEADERS     = ['タイトル', 'URL', '説明'];

const COL = {
  LAST_UPDATED: 0, GROUP: 1, ASSIGNEE: 2, DEPARTMENT: 3, TASK: 4,
  DEADLINE: 5, PRIORITY: 6, STATUS: 7, CREATED: 8, ORIGINAL: 9,
};

// ─────────────────────────────────────────────
// エントリポイント（書き込み）
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
// エントリポイント（読み取り） — Botが参照するデータを返す
// ─────────────────────────────────────────────

function doGet(e) {
  try {
    const type   = (e.parameter && e.parameter.type)   || '';
    const secret = (e.parameter && e.parameter.secret) || '';

    if (SECRET_TOKEN && secret !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (type === 'equipment') {
      return jsonResponse({ ok: true, data: getEquipmentData(ss) });
    }
    if (type === 'staff') {
      return jsonResponse({ ok: true, data: getStaffData(ss) });
    }

    return jsonResponse({ ok: false, error: 'unknown type' });
  } catch (err) {
    console.error('doGet エラー:', err.message);
    return jsonResponse({ ok: false, error: err.message });
  }
}

function getEquipmentData(ss) {
  const sheet = ss.getSheetByName(SHEET_EQUIPMENT);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, EQUIPMENT_HEADERS.length).getValues();
  return rows
    .filter(r => r[0])
    .map(r => ({
      item:       r[0] || '',
      category:   r[1] || '',
      quantity:   r[2] || '',
      unit:       r[3] || '',
      location:   r[4] || '',
      department: r[5] || '',
      notes:      r[6] || '',
    }));
}

function getStaffData(ss) {
  const sheet = ss.getSheetByName(SHEET_STAFF);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, STAFF_HEADERS.length).getValues();
  return rows
    .filter(r => r[0])
    .map(r => ({
      name:       r[0] || '',
      department: r[1] || '',
      role:       r[2] || '',
      shiftStart: r[3] ? String(r[3]) : '',
      shiftEnd:   r[4] ? String(r[4]) : '',
      notes:      r[5] || '',
    }));
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
    const activeRows  = activeSheet.getDataRange().getValues();
    const existingIdx = findTaskRow(activeRows, taskText, assignee);

    if (isCompleted) {
      if (existingIdx >= 0) activeSheet.deleteRow(existingIdx + 1);
      const doneRow = [now, groupName, assignee, department, taskText,
                       deadline, priority, '完了', now, original];
      doneSheet.getRange(doneSheet.getLastRow() + 1, 1, 1, doneRow.length).setValues([doneRow]);
    } else {
      if (existingIdx >= 0) {
        const existingCreated = activeRows[existingIdx][COL.CREATED] || now;
        const updatedRow = [now, groupName, assignee, department, taskText,
                            deadline, priority, status, existingCreated, original];
        activeSheet.getRange(existingIdx + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
      } else {
        const newRow = [now, groupName, assignee, department, taskText,
                        deadline, priority, status, now, original];
        activeSheet.getRange(activeSheet.getLastRow() + 1, 1, 1, newRow.length).setValues([newRow]);
      }
    }
  });

  applyTaskFormatting(activeSheet);
}

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

function applyTaskFormatting(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const statusCol = COL.STATUS + 1;
  const statuses  = sheet.getRange(2, statusCol, lastRow - 1, 1).getValues();
  statuses.forEach((row, i) => {
    const rowNum = i + 2;
    let color = '#FFFFFF';
    if (row[0] === '対応中') color = '#FFF9C4';
    if (row[0] === '予定')   color = '#E8F5E9';
    if (row[0] === '調整中') color = '#FCE4EC';
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
  const total = sheet.getLastRow() - 1;
  if (total > LINE_LOG_MAX) {
    sheet.deleteRows(2, total - LINE_LOG_MAX);
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
// セットアップ（1回だけ手動実行）
// ─────────────────────────────────────────────

function setupAll() {
  setupSecretToken();
  setupReferenceSheets();
}

function setupSecretToken() {
  const existing = PropertiesService.getScriptProperties().getProperty('GAS_SECRET_TOKEN');
  if (existing) {
    console.log('GAS_SECRET_TOKEN は設定済みです');
    return;
  }
  const token = 'moment2026_' + Math.random().toString(36).slice(2, 10);
  PropertiesService.getScriptProperties().setProperty('GAS_SECRET_TOKEN', token);
  console.log('GAS_SECRET_TOKEN を設定しました:', token);
}

function setupReferenceSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 備品・資材シート
  const equipSheet = getOrCreateSheet(ss, SHEET_EQUIPMENT, EQUIPMENT_HEADERS);
  if (equipSheet.getLastRow() < 2) {
    const samples = [
      ['テント（大）', '設営資材', 3, '張', 'メインステージ裏倉庫', '設営', 'ペグ・ロープ込み'],
      ['発電機', '電源機材', 2, '台', '電源エリアコンテナ', '電源', '燃料は別保管'],
      ['折りたたみテーブル', '什器', 20, '台', '資材置き場A', '全体', ''],
      ['パイプ椅子', '什器', 50, '脚', '資材置き場A', '全体', ''],
      ['延長コード（20m）', '電源機材', 10, '本', '電源エリアコンテナ', '電源', ''],
      ['ゴミ袋（大）', '消耗品', 100, '枚', '清掃用品棚', '清掃', ''],
      ['養生テープ', '消耗品', 30, '巻', '資材置き場B', '設営', ''],
      ['スポットライト', '照明機材', 8, '台', '照明機材ケース', '演出・照明', 'CRACKWORKS管理'],
    ];
    equipSheet.getRange(2, 1, samples.length, EQUIPMENT_HEADERS.length).setValues(samples);
  }

  // スタッフシート
  const staffSheet = getOrCreateSheet(ss, SHEET_STAFF, STAFF_HEADERS);
  if (staffSheet.getLastRow() < 2) {
    const samples = [
      ['妹尾 真行', '全体', '総合責任者', '6/29', '7/6', 'HI-Cとも連携'],
      ['Joshua SW', '舞台監督', '舞台監督', '6/30', '7/6', 'ルウジと連携'],
      ['yusuke ono', '音響', '音響担当', '7/2 朝', '7/6', 'SOL / kan2 / 川島と連携'],
      ['Kunihiko Harada', '電源', '電源責任者', '6/29', '7/6', '原田'],
      ['Shu YAMAWAKI', '演出・照明', '照明担当', '6/30', '7/6', '山脇Shu'],
      ['Haruki Moriguchi', 'VJ・演出', 'VJ担当', '7/1', '7/6', 'CRACKWORKS'],
      ['hajime', '設営', '設営責任者', '6/29', '7/6', ''],
      ['oleoreo', 'ステージ', 'ステージ担当', '7/1', '7/6', '岩城と連携'],
      ['MARIA', '広報', '広報担当', '7/2', '7/6', 'ももこと連携'],
      ['中道大雅', '清掃', '清掃担当', '7/3', '7/6', 'タイガ'],
      ['🌞Hiroto Arai', 'バー', 'バー責任者', '7/2', '7/6', 'ヒロト'],
      ['akinoko', 'キッズ', 'キッズエリア担当', '7/3', '7/5', ''],
      ['南城 祐介', 'ボランティア', 'ボランティアリーダー', '7/2', '7/6', '南ちゃん'],
      ['YUTO', '警備', '警備担当', '7/3', '7/5', '青木 陽平と連携'],
      ['Yuto Saruwatari', 'シャトルバス', 'シャトルバス担当', '7/3', '7/5', '猿ちゃん'],
      ['濵田隆史', '撮影', 'カメラマン', '7/3', '7/5', '池上・井原と連携'],
    ];
    staffSheet.getRange(2, 1, samples.length, STAFF_HEADERS.length).setValues(samples);
  }

  // リンク集シート
  const linksSheet = getOrCreateSheet(ss, SHEET_LINKS, LINKS_HEADERS);
  if (linksSheet.getLastRow() < 2) {
    const links = [
      ['MOMENT 2026 工程表', SCHEDULE_SHEET_URL, 'メインスケジュール・作業工程表'],
      ['タスク管理シート（本体）', 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit', 'このBotが書き込むタスク管理スプレッドシート'],
    ];
    linksSheet.getRange(2, 1, links.length, LINKS_HEADERS.length).setValues(links);
  }

  console.log('参照シートのセットアップ完了');
}
