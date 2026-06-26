/**
 * MOMENT 2026 LINE Bot Webhook レシーバー
 *
 * シート構成:
 *   📋 タスク（現役）  ← 常に最新状態のみ。同じタスクは上書き更新
 *   ✅ 完了タスク      ← 完了したタスクを自動アーカイブ
 *   📱 LINEリアルタイム ← 直近500件のみ保持（古いものは自動削除）
 *   📦 備品・資材      ← 備品の保管場所・数量管理
 *   👥 スタッフ        ← スタッフ名・部署・シフト管理
 *   🛍️ 出店リスト      ← 飲食・物販の出店情報（エントランスで活用）
 *   🔗 リンク集        ← 関連スプレッドシートへのリンク
 *
 * デプロイ手順:
 * 1. GASエディタ → デプロイ → 新しいデプロイ（または既存を更新）
 * 2. 種類: ウェブアプリ / 実行ユーザー: 自分 / アクセス: 全員
 * 3. URL を Render の GAS_WEBHOOK_URL 環境変数に設定
 */

const SPREADSHEET_ID   = '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ';
const ARTIST_SS_ID     = '1h7HV6ZfnDElblK4nJ_dbtKgAOaNnB1olv2A7946GjYo'; // Antigravity アーティストケア
const SCHEDULE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY/edit';
const SECRET_TOKEN     = PropertiesService.getScriptProperties().getProperty('GAS_SECRET_TOKEN') || '';

const SHEET_TASKS      = '📋 タスク（現役）';
const SHEET_DONE       = '✅ 完了タスク';
const SHEET_LINE_LOG   = '📱 LINEリアルタイム';
const SHEET_EQUIPMENT  = '📦 備品・資材';
const SHEET_STAFF      = '👥 スタッフ';
const SHEET_VENDORS    = '🛍️ 出店リスト';
const SHEET_LINKS      = '🔗 リンク集';
const LINE_LOG_MAX     = 500;

const TASK_HEADERS = [
  '最終更新', 'グループ名', '担当者', '部署', 'タスク内容',
  '期限', '優先度', 'ステータス', '初回登録', '元メッセージ'
];
const LINE_HEADERS = ['タイムスタンプ', 'グループ名', 'ユーザーID', 'メッセージ'];
const EQUIPMENT_HEADERS = ['アイテム名', 'カテゴリ', '数量', '単位', '保管場所', '担当部署', '備考'];
const STAFF_HEADERS     = ['名前', '部署', '役割', '入り日時', '退場日時', '備考'];
const VENDOR_HEADERS    = ['店名', 'カテゴリ', '場所', '営業時間', 'メニュー・商品', '担当者', '備考'];
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
    } else if (data.type === 'equipment') {
      upsertEquipment(ss, data);
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
    if (type === 'vendor') {
      return jsonResponse({ ok: true, data: getVendorData(ss) });
    }
    if (type === 'artist') {
      return jsonResponse({ ok: true, data: getArtistData() });
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

/**
 * Antigravityスプシからアーティスト出演・宿泊情報を取得（読み取り専用）
 * 個人連絡先（電話・メール）は除外してジュニアに渡す
 */
function getArtistData() {
  try {
    const ss    = SpreadsheetApp.openById(ARTIST_SS_ID);
    const sheet = ss.getSheetByName('アーティスト管理');
    if (!sheet || sheet.getLastRow() < 2) return [];

    const allData = sheet.getDataRange().getValues();

    // ヘッダー行を特定
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, allData.length); i++) {
      if (allData[i].some(c => String(c).trim() === 'アーティスト名')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx < 0) return [];

    const headers = allData[headerIdx];
    const col = name => headers.findIndex(h => String(h).includes(name));

    const cols = {
      name:        col('アーティスト名'),
      perfTime:    col('出演時間'),
      stage:       col('ステージ'),
      stayType:    col('宿泊タイプ'),
      hotel:       col('宿名'),
      checkIn:     col('チェックイン'),
      checkOut:    col('チェックアウト'),
      arrivalSpot: col('迎え場所'),
      arrivalTime: col('迎え日時'),
      careStaff:   col('ケア担当'),
      notes:       col('備考・特記事項'),
    };

    return allData.slice(headerIdx + 1)
      .filter(r => cols.name >= 0 && r[cols.name] && String(r[cols.name]).trim())
      .map(r => ({
        name:        String(r[cols.name]        || '').trim(),
        stage:       String(r[cols.stage]       || '').trim(),
        perfTime:    String(r[cols.perfTime]    || '').trim(),
        stayType:    String(r[cols.stayType]    || '').trim(),
        hotel:       String(r[cols.hotel]       || '').trim(),
        checkIn:     String(r[cols.checkIn]     || '').trim(),
        checkOut:    String(r[cols.checkOut]    || '').trim(),
        arrivalTime: String(r[cols.arrivalTime] || '').trim(),
        careStaff:   String(r[cols.careStaff]   || '').trim(),
        notes:       String(r[cols.notes]       || '').trim(),
      }));
  } catch (err) {
    console.error('getArtistData エラー:', err.message);
    return [];
  }
}

function getVendorData(ss) {
  const sheet = ss.getSheetByName(SHEET_VENDORS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, VENDOR_HEADERS.length).getValues();
  return rows
    .filter(r => r[0])
    .map(r => ({
      name:     r[0] || '',
      category: r[1] || '',
      location: r[2] || '',
      hours:    r[3] || '',
      menu:     r[4] || '',
      contact:  r[5] || '',
      notes:    r[6] || '',
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

// ─────────────────────────────────────────────
// 備品: ジュニアが会話から学習して upsert
// ─────────────────────────────────────────────

function upsertEquipment(ss, data) {
  const sheet    = getOrCreateSheet(ss, SHEET_EQUIPMENT, EQUIPMENT_HEADERS);
  const item     = (data.item     || '').trim();
  const location = (data.location || '').trim();
  if (!item || !location) return;

  const rows = sheet.getDataRange().getValues();
  let existingIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').trim() === item) { existingIdx = i; break; }
  }

  const row = [item, data.category||'', data.quantity||'', data.unit||'',
               location, data.department||'', data.notes||''];

  if (existingIdx >= 0) {
    sheet.getRange(existingIdx + 1, 1, 1, row.length).setValues([row]);
  } else {
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  }
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

  // 出店リストシート（2026/06確定分）
  const vendorSheet = getOrCreateSheet(ss, SHEET_VENDORS, VENDOR_HEADERS);
  if (vendorSheet.getLastRow() < 2) {
    const samples = [
      // キッチンカーエリア
      ['cuci',                'フード',     'キッチンカーエリア', '', '', '', 'キッチンカー'],
      ['munchies',            'フード',     'キッチンカーエリア', '', '', '', 'キッチンカー'],
      ['chachamaru kitchen',  'フード',     'キッチンカーエリア', '', '', '', 'キッチンカー'],
      ['pizza minority',      'フード',     'キッチンカーエリア', '', '', '', 'キッチンカー / ピザ'],
      ['retoxworks',          'フード',     'キッチンカーエリア', '', '', '', 'キッチンカー'],
      ['min-min',             'フード',     'キッチンカーエリア', '', '', '', 'キッチンカー'],
      // 川沿いフロア
      ['the sauna 天川',      'サウナ',     '川沿いエリア（高床）', '7/3-7/5 全日', '三日券¥7,000 / 一日券¥3,000', '', 'バレルサウナ＆テントサウナ2タイプ。水着必須。飲酒後は入場不可'],
      ['整体ヤシュネ',         'マッサージ', '川沿いエリア（高床）', '', '', '', '整体・マッサージ'],
      ['HANAPEUPEU CACAO',    'フード',     '川沿いエリア', '', '', '', 'カカオ系フード'],
      ['瘉舎飛草',             'フード',     '川沿いエリア', '', '', '', ''],
      ['ゆらぎ道',             'マッサージ', '川沿いエリア（高床）', '', '', '', ''],
      ['MKKR',                'フード',     '川沿いエリア', '', '', '', ''],
      ['slow',                'フード',     '川沿いエリア', '', '', '', ''],
      ['kan.psy',             'フード',     '川沿いエリア', '', '', '', ''],
      ['cacao magic',         'フード',     '川沿いエリア', '', '', '', 'カカオ'],
      ['玉田農園',             '物販',      '川沿いエリア', '', '', '', '農産物'],
      // 六角堂エリア
      ['モハマヤバード',        'フード',     '六角堂エリア', '', '', '', ''],
      ['最幸飯店',             'フード',     '六角堂エリア', '', '', '', '出店料後払い'],
      ['prana',               'フード',     '六角堂エリア', '', '', '', 'ローチョコレート系'],
      ['マカ堂',               'フード',     '六角堂エリア', '', '', '', ''],
      ['exodus',              'フード',     '六角堂エリア', '', '', '', ''],
    ];
    vendorSheet.getRange(2, 1, samples.length, VENDOR_HEADERS.length).setValues(samples);
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

// ─────────────────────────────────────────────
// 工程表スプシとの統合セットアップ（1回だけ実行）
// 既存シートは一切変更しない。新シートのみ追加。
// ─────────────────────────────────────────────

const SCHEDULE_SPREADSHEET_ID = '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY';
const TASK_SS_URL = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit';

function setupScheduleIntegration() {
  const ss = SpreadsheetApp.openById(SCHEDULE_SPREADSHEET_ID);
  setupTaskImportSheet(ss);
  setupHubSheet(ss);
  console.log('工程表統合セットアップ完了！');
}

// ① タスク連携シート（IMPORTRANGE で自動同期）
function setupTaskImportSheet(ss) {
  const name = '📊 タスク連携';
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  else sheet.clear();

  const headers = ['最終更新','グループ名','担当者','部署','タスク内容','期限','優先度','ステータス','初回登録','元メッセージ'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1A237E').setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, headers.length, 150);

  // IMPORTRANGE — 初回は工程表側でアクセス許可のクリックが必要
  sheet.getRange('A2').setFormula(
    '=IFERROR(IMPORTRANGE("' + SPREADSHEET_ID + '","📋 タスク（現役）!A2:J"),"⚠️ アクセス許可が必要です — このセルをクリック → 許可する")'
  );

  // 条件付き書式（ステータス色分け）
  const statusRange = sheet.getRange('H2:H500');
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('対応中').setBackground('#FFF9C4').build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('完了').setBackground('#C8E6C9').build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('調整中').setBackground('#FCE4EC').build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('未着手').setBackground('#FFFFFF').build(),
  ];
  sheet.setConditionalFormatRules(rules);
  console.log('📊 タスク連携シート作成完了');
}

// ② HUBシート（表紙） — 工程表の一番左に配置
function setupHubSheet(ss) {
  const name = '🏠 HUB';
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  } else {
    sheet.clear();
  }
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1); // 一番左へ
  sheet.setTabColor('#2E7D32');

  // 列幅設定
  sheet.setColumnWidth(1, 20);
  [2,3,4,5,6,7,8,9,10,11].forEach(c => sheet.setColumnWidth(c, 120));
  sheet.setColumnWidth(12, 20);

  // ── タイトル ──────────────────────
  sheet.setRowHeight(1, 20);
  sheet.setRowHeight(2, 65);
  sheet.getRange('B2:K2').merge()
    .setValue('🌿  MOMENT 2026  運営管理HUB')
    .setFontSize(26).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBackground('#1A237E').setFontColor('#FFFFFF');

  sheet.setRowHeight(3, 30);
  sheet.getRange('B3:K3').merge()
    .setValue('2026.7.3(FRI) – 7.5(SUN)  |  洞川キャンプ場  |  奈良県天川村')
    .setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBackground('#283593').setFontColor('#B3BCF5');

  // ── タスク管理リンクボタン ────────────
  sheet.setRowHeight(4, 15);
  sheet.setRowHeight(5, 50);
  sheet.getRange('B5:K5').merge()
    .setFormula('=HYPERLINK("' + TASK_SS_URL + '","📋  タスク管理を開く  →  ジュニアが自動記録中")')
    .setFontSize(15).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBackground('#E65100').setFontColor('#FFFFFF');

  // ── エリア別タスク状況 ───────────────
  sheet.setRowHeight(6, 15);
  sheet.setRowHeight(7, 32);
  sheet.getRange('B7:K7').merge()
    .setValue('📍  エリア別タスク状況（自動更新）')
    .setFontSize(13).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBackground('#E3F2FD').setFontColor('#0D47A1');

  const areas = [
    { icon:'🎪', name:'メインステージ', dept:'舞台監督' },
    { icon:'🚪', name:'エントランス',   dept:'エントランス' },
    { icon:'🔊', name:'音響',          dept:'音響' },
    { icon:'⚡', name:'電源',          dept:'電源' },
    { icon:'💡', name:'照明',          dept:'演出・照明' },
    { icon:'🍺', name:'バー',          dept:'バー' },
    { icon:'🎠', name:'キッズ',        dept:'キッズ' },
    { icon:'🔨', name:'設営',          dept:'設営' },
    { icon:'🛡', name:'警備',          dept:'警備' },
    { icon:'🧹', name:'清掃',          dept:'清掃' },
  ];

  const areaRows = [
    { row: 8,  items: areas.slice(0, 5) },
    { row: 12, items: areas.slice(5, 10) },
  ];

  areaRows.forEach(({ row, items }) => {
    sheet.setRowHeight(row,     38);
    sheet.setRowHeight(row + 1, 42);
    sheet.setRowHeight(row + 2, 24);
    sheet.setRowHeight(row + 3, 8);

    items.forEach((area, i) => {
      const col = 2 + i * 2; // B,D,F,H,J

      // エリア名
      sheet.getRange(row, col, 1, 2).merge()
        .setValue(area.icon + '  ' + area.name)
        .setFontSize(11).setFontWeight('bold')
        .setHorizontalAlignment('center').setVerticalAlignment('middle')
        .setBackground('#1565C0').setFontColor('#FFFFFF');

      // タスク件数
      const countFormula = '=IFERROR(COUNTIF(\'📊 タスク連携\'!D:D,"' + area.dept + '"),"–")';
      sheet.getRange(row + 1, col, 1, 2).merge()
        .setFormula(countFormula)
        .setFontSize(28).setFontWeight('bold')
        .setHorizontalAlignment('center').setVerticalAlignment('middle')
        .setBackground('#E3F2FD').setFontColor('#0D47A1');

      // 「件のタスク」
      sheet.getRange(row + 2, col, 1, 2).merge()
        .setValue('件のタスク')
        .setFontSize(10).setHorizontalAlignment('center')
        .setBackground('#BBDEFB').setFontColor('#0D47A1');
    });
  });

  // ── 目次 ────────────────────────────
  sheet.setRowHeight(17, 15);
  sheet.setRowHeight(18, 32);
  sheet.getRange('B18:K18').merge()
    .setValue('📚  目次 — シートへのリンク')
    .setFontSize(13).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBackground('#E8F5E9').setFontColor('#1B5E20');

  const tocLinks = [
    { label: '📋 タスク（現役）',    url: TASK_SS_URL + '#gid=0' },
    { label: '✅ 完了タスク',        url: TASK_SS_URL },
    { label: '📦 備品・資材',        url: TASK_SS_URL },
    { label: '👥 スタッフ',          url: TASK_SS_URL },
    { label: '📊 タスク連携（本スプシ）', url: SCHEDULE_SHEET_URL },
    { label: '🔗 リンク集',          url: TASK_SS_URL },
  ];

  sheet.setRowHeight(19, 36);
  tocLinks.forEach((item, i) => {
    const col = 2 + (i % 5) * 2;
    const row = i < 5 ? 19 : 20;
    sheet.setRowHeight(row, 36);
    sheet.getRange(row, col, 1, 2).merge()
      .setFormula('=HYPERLINK("' + item.url + '","' + item.label + '")')
      .setFontSize(10).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBackground('#F1F8E9').setFontColor('#2E7D32')
      .setBorder(true,true,true,true,false,false,'#A5D6A7', SpreadsheetApp.BorderStyle.SOLID);
  });

  // ── ジュニア自己紹介 ─────────────────
  sheet.setRowHeight(21, 15);
  sheet.setRowHeight(22, 32);
  sheet.getRange('B22:K22').merge()
    .setValue('🤖  ジュニアより')
    .setFontSize(13).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBackground('#FFF8E1').setFontColor('#E65100');

  const juniorText =
    'やあ！MOMENT 2026の現場バディ、ジュニアやで！\n' +
    'まだまだ未熟者やけど、みんなと一緒に育っていきたいねん🌱\n\n' +
    '【使い方】「ジュニア」って呼んだ時だけ返事するで。呼ばれてない時は黙って全部メモしてる👂\n\n' +
    '質問例: 「ジュニア、テントどこ？」「ジュニア、音響の担当誰？」\n' +
    '教える: 「ジュニア、発電機は電源エリアに2台あるよ」→ 覚えてスプシに登録するで！\n\n' +
    'みんなの声でジュニアは成長します。一緒に最高のMOMENT作ろう！';

  sheet.setRowHeight(23, 150);
  sheet.getRange('B23:K23').merge()
    .setValue(juniorText)
    .setFontSize(11).setVerticalAlignment('middle')
    .setWrap(true)
    .setBackground('#FFFDE7').setFontColor('#4E342E');

  sheet.setRowHeight(24, 20);
  console.log('🏠 HUBシート作成完了');
}
