/**
 * MOMENT 2026 — 自動通知スクリプト
 *
 * ─────────────────────────────────────────────────
 * 機能一覧:
 *   1. morningTaskReport()   毎朝9時 — 期限超過・本日〆切タスクをLINEに送信
 *   2. hourlyEventCheck()    毎時0分 — 7/3〜7/5の12:00・18:00に賄い人数を送信
 *   3. dayBeforeReminder()   毎晩21時 — 翌日がイベント日なら段取りリマインダー
 *
 * ─────────────────────────────────────────────────
 * セットアップ（GASエディタで setupAllTriggers() を1回だけ実行）:
 *   スクリプトプロパティに以下を設定:
 *   ・LINE_CHANNEL_ACCESS_TOKEN  (既存値)
 *   ・LINE_NOTIFY_GROUP_ID       (通知先グループID — LINEリアルタイムシートで確認)
 */

// ─── 設定 ─────────────────────────────────────────
const NOTIF_SS_ID    = '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ';
const NOTIF_TOKEN    = () => PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '';
const NOTIF_GROUP_ID = () => PropertiesService.getScriptProperties().getProperty('LINE_NOTIFY_GROUP_ID') || '';

// イベント日程（JST）
const EVENT_DAYS = [
  { date: '2026/07/03', label: '7/3（金）搬入・設営日', isSetup: true },
  { date: '2026/07/04', label: '7/4（土）本番Day1',    isSetup: false },
  { date: '2026/07/05', label: '7/5（日）本番Day2・撤収', isSetup: false },
];

// 賄い人数データ
const MEAL_DATA = {
  '2026/07/03': {
    '12:00': { moment: 6, staff: 27, vol: 103 },
    '18:00': { moment: 6, staff: 27, vol: 103 },
  },
  '2026/07/04': {
    '12:00': { moment: 6, staff: 27, vol: 97 },
    '18:00': { moment: 6, staff: 27, vol: 97 },
  },
  '2026/07/05': {
    '12:00': { moment: 6, staff: 27, vol: 97 },
    '18:00': { moment: 6, staff: 13, vol: 97, note: '※デコ班撤収済み（公式13名）' },
  },
};

// タスクシート列インデックス（webhook_receiver.gs の COL と同一）
const T = {
  LAST_UPDATED: 0, GROUP: 1, ASSIGNEE: 2, DEPARTMENT: 3, TASK: 4,
  DEADLINE: 5, PRIORITY: 6, STATUS: 7, CREATED: 8,
};

// ─────────────────────────────────────────────────
// 1. 毎朝9時: タスクリマインダー
// ─────────────────────────────────────────────────
function morningTaskReport() {
  const token   = NOTIF_TOKEN();
  const groupId = NOTIF_GROUP_ID();
  if (!token || !groupId) { Logger.log('トークン/グループID未設定'); return; }

  const ss = SpreadsheetApp.openById(NOTIF_SS_ID);
  const sh = ss.getSheetByName('📋 タスク（現役）');
  if (!sh) return;

  const rows = sh.getDataRange().getValues();
  if (rows.length <= 1) return; // ヘッダーのみ

  const today    = _jstDate();
  const todayStr = _fmtDate(today);
  const overdue  = [];
  const dueToday = [];
  const highPri  = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[T.TASK]) continue;

    const status   = String(r[T.STATUS] || '').trim();
    if (status === '完了' || status === 'done') continue;

    const deadline = r[T.DEADLINE] ? new Date(r[T.DEADLINE]) : null;
    const priority = String(r[T.PRIORITY] || '').trim();
    const assignee = r[T.ASSIGNEE] || '未定';
    const task     = r[T.TASK];

    if (deadline) {
      const dl = _fmtDate(deadline);
      if (dl < todayStr) {
        overdue.push({ task, assignee, deadline: dl, priority });
      } else if (dl === todayStr) {
        dueToday.push({ task, assignee, priority });
      }
    }

    if (priority === '高' || priority === 'high') {
      highPri.push({ task, assignee, deadline: deadline ? _fmtDate(deadline) : '未設定' });
    }
  }

  if (overdue.length === 0 && dueToday.length === 0 && highPri.length === 0) {
    // 問題なしの日は軽く報告
    _notifyText(token, groupId,
      `☀️ おはよう！MOMENT 2026\n${todayStr} 現在、期限切れ・本日〆切タスクはゼロやで✨`);
    return;
  }

  const lines = [`☀️ おはよう！ ${todayStr} のタスク状況やで\n`];

  if (overdue.length > 0) {
    lines.push(`🚨 期限超過 (${overdue.length}件)`);
    overdue.forEach(t => {
      lines.push(`  ・${t.task}\n    担当: ${t.assignee} ／ 〆切: ${t.deadline}`);
    });
    lines.push('');
  }

  if (dueToday.length > 0) {
    lines.push(`⚡ 本日〆切 (${dueToday.length}件)`);
    dueToday.forEach(t => {
      lines.push(`  ・${t.task}\n    担当: ${t.assignee}`);
    });
    lines.push('');
  }

  if (highPri.length > 0 && highPri.length <= 5) {
    lines.push(`🔴 優先度【高】タスク (${highPri.length}件)`);
    highPri.forEach(t => {
      lines.push(`  ・${t.task} → 〆切: ${t.deadline}`);
    });
  }

  lines.push(`\n📋 詳細はスプシで確認してな`);
  _notifyText(token, groupId, lines.join('\n'));
}

// ─────────────────────────────────────────────────
// 1b. 朝9時: 昼の賄い確認リクエスト（イベント当日のみ）
// ─────────────────────────────────────────────────
function morningMealConfirmRequest() {
  const token   = NOTIF_TOKEN();
  const groupId = NOTIF_GROUP_ID();
  if (!token || !groupId) return;

  const now     = _nowJST();
  const dateKey = _fmtSlash(now);
  if (!MEAL_DATA[dateKey]) return; // イベント日以外はスルー

  const planned = MEAL_DATA[dateKey]['12:00'];
  const total   = planned.moment + planned.staff + planned.vol;

  _notifyText(token, groupId, [
    `🍱 12時の賄い確認！`,
    `━━━━━━━━━━━━━━━`,
    `各チームリーダーは↓の形式で教えてな`,
    ``,
    `「昼 MOMENT (人数)」`,
    `「昼 公式スタッフ (人数)」`,
    `「昼 ボランティア (人数)」`,
    ``,
    `📊 予定人数（変更なければ返信不要）`,
    `  MOMENTメンバー: ${planned.moment}名`,
    `  公式スタッフ:   ${planned.staff}名`,
    `  ボランティア:   ${planned.vol}名`,
    `  ━━ 予定合計: ${total}名`,
    ``,
    `※アーティスト分は別途カウントして！`,
  ].join('\n'));
}

// ─────────────────────────────────────────────────
// 1c. 11:30: 昼の賄い確認サマリー
// ─────────────────────────────────────────────────
function mealSummaryLunch() {
  _sendMealSummary('昼', '12:00');
}

// ─────────────────────────────────────────────────
// 1d. 15:00: 夜の賄い確認リクエスト（イベント当日のみ）
// ─────────────────────────────────────────────────
function afternoonMealConfirmRequest() {
  const token   = NOTIF_TOKEN();
  const groupId = NOTIF_GROUP_ID();
  if (!token || !groupId) return;

  const now     = _nowJST();
  const dateKey = _fmtSlash(now);
  if (!MEAL_DATA[dateKey]) return;

  const planned = MEAL_DATA[dateKey]['18:00'];
  const total   = planned.moment + planned.staff + planned.vol;

  _notifyText(token, groupId, [
    `🍱 18時の賄い確認！`,
    `━━━━━━━━━━━━━━━`,
    `各チームリーダーは↓の形式で教えてな`,
    ``,
    `「夜 MOMENT (人数)」`,
    `「夜 公式スタッフ (人数)」`,
    `「夜 ボランティア (人数)」`,
    ``,
    `📊 予定人数（変更なければ返信不要）`,
    `  MOMENTメンバー: ${planned.moment}名`,
    `  公式スタッフ:   ${planned.staff}名`,
    `  ボランティア:   ${planned.vol}名`,
    `  ━━ 予定合計: ${total}名`,
    planned.note ? `\n⚠️ ${planned.note}` : '',
  ].filter(Boolean).join('\n'));
}

// ─────────────────────────────────────────────────
// 1e. 17:30: 夜の賄い確認サマリー
// ─────────────────────────────────────────────────
function mealSummaryDinner() {
  _sendMealSummary('夜', '18:00');
}

// ── 賄い確認サマリー共通処理 ─────────────────────
function _sendMealSummary(mealLabel, plannedKey) {
  const token   = NOTIF_TOKEN();
  const groupId = NOTIF_GROUP_ID();
  if (!token || !groupId) return;

  const now     = _nowJST();
  const dateKey = _fmtSlash(now);
  if (!MEAL_DATA[dateKey]) return;

  const planned  = MEAL_DATA[dateKey][plannedKey];
  const ss       = SpreadsheetApp.openById(NOTIF_SS_ID);
  const confirms = _readMealConfirmations(ss, dateKey, mealLabel);

  // 確認済みがなければ予定数で送信
  const moment = confirms['MOMENT']         ?? planned.moment;
  const staff  = confirms['公式スタッフ']   ?? planned.staff;
  const vol    = confirms['ボランティア']   ?? planned.vol;
  const total  = moment + staff + vol;

  const momentTag = confirms['MOMENT']       ? '✅' : '📋予定';
  const staffTag  = confirms['公式スタッフ'] ? '✅' : '📋予定';
  const volTag    = confirms['ボランティア'] ? '✅' : '📋予定';

  const emoji = mealLabel === '昼' ? '🌞 昼 12:00' : '🌙 夜 18:00';
  _notifyText(token, groupId, [
    `🍱 賄い確定人数 — ${dateKey} ${emoji}`,
    `━━━━━━━━━━━━━━━`,
    `${momentTag} MOMENTメンバー: ${moment}名`,
    `${staffTag}  公式スタッフ:   ${staff}名`,
    `${volTag}  ボランティア:   ${vol}名`,
    `━━━━━━━━━━━━━━━`,
    `🔢 合計: ${total}名`,
    ``,
    `※アーティスト分（約20〜35名）は別途！`,
    total !== (planned.moment + planned.staff + planned.vol)
      ? `⚠️ 予定(${planned.moment + planned.staff + planned.vol}名)から変更あり`
      : `（予定通り）`,
  ].join('\n'));
}

function _readMealConfirmations(ss, dateStr, mealTime) {
  const sh = ss.getSheetByName('🍱 賄い確認');
  if (!sh) return {};
  const rows   = sh.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === dateStr && rows[i][2] === mealTime) {
      result[rows[i][3]] = Number(rows[i][4]);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────
// 2. 毎時チェック: 12:00・18:00に賄い通知（イベント当日のみ）
// ─────────────────────────────────────────────────
function hourlyEventCheck() {
  const token   = NOTIF_TOKEN();
  const groupId = NOTIF_GROUP_ID();
  if (!token || !groupId) return;

  const now     = _nowJST();
  const dateKey = _fmtSlash(now);
  const hour    = now.getHours();
  const min     = now.getMinutes();

  // 正時 ±5分以内のみ実行（トリガーのズレ対策）
  if (min > 5 && min < 55) return;

  const timeKey = hour === 12 ? '12:00' : hour === 18 ? '18:00' : null;
  if (!timeKey) return;

  const meal = MEAL_DATA[dateKey] && MEAL_DATA[dateKey][timeKey];
  if (!meal) return; // イベント日以外はスルー

  const total = meal.moment + meal.staff + meal.vol;
  const note  = meal.note ? `\n${meal.note}` : '';
  const emoji = timeKey === '12:00' ? '🌞 昼' : '🌙 18時';

  const msg = [
    `🍱 賄い時間やで！`,
    `━━━━━━━━━━━━━━━`,
    `${dateKey} ${timeKey} ${emoji}`,
    ``,
    `👑 MOMENTメンバー: ${meal.moment}名`,
    `🎧 公式スタッフ:   ${meal.staff}名`,
    `🙌 ボランティア:   ${meal.vol}名`,
    `━━━━━━━━━━━━━━━`,
    `合計: ${total}名${note}`,
    ``,
    `※アーティスト分（約20〜35名）は別途！`,
  ].join('\n');

  _notifyText(token, groupId, msg);
}

// ─────────────────────────────────────────────────
// 3. 毎晩21時: 翌日リマインダー
// ─────────────────────────────────────────────────
function dayBeforeReminder() {
  const token   = NOTIF_TOKEN();
  const groupId = NOTIF_GROUP_ID();
  if (!token || !groupId) return;

  const now      = _nowJST();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = _fmtSlash(tomorrow);

  const eventDay = EVENT_DAYS.find(d => d.date === tomorrowKey);
  if (!eventDay) return;

  const meal12 = MEAL_DATA[tomorrowKey]['12:00'];
  const meal18 = MEAL_DATA[tomorrowKey]['18:00'];
  const total12 = meal12.moment + meal12.staff + meal12.vol;
  const total18 = meal18.moment + meal18.staff + meal18.vol;

  const setupLines = eventDay.isSetup ? [
    ``,
    `🔧 搬入・設営日です！`,
    `  ✔ 機材搬入ルート確認`,
    `  ✔ 電源・発電機チェック`,
    `  ✔ 各エリア担当者の入り時刻確認`,
  ] : [
    ``,
    `🎪 本番日です！`,
    `  ✔ スタッフ全員の入り時刻確認`,
    `  ✔ アーティストケア担当確認`,
    `  ✔ エントランス・チケット確認`,
  ];

  const msg = [
    `🌙 明日の準備チェックやで！`,
    `━━━━━━━━━━━━━━━`,
    `明日: ${eventDay.label}`,
    ...setupLines,
    ``,
    `🍱 賄い予定人数:`,
    `  12:00（昼）: ${total12}名`,
    `  18:00:       ${total18}名`,
    `  ※アーティスト分は別途！`,
    ``,
    `📋 タスク確認はスプシで！`,
  ].join('\n');

  _notifyText(token, groupId, msg);
}

// ─────────────────────────────────────────────────
// 4. 定期実行: 完了タスクを自動アーカイブ（30分ごと）
// ─────────────────────────────────────────────────
function archiveCompletedTasks() {
  const ss      = SpreadsheetApp.openById(NOTIF_SS_ID);
  const active  = ss.getSheetByName('📋 タスク（現役）');
  const done    = ss.getSheetByName('✅ 完了タスク');
  if (!active || !done) return;

  const data = active.getDataRange().getValues();
  if (data.length <= 1) return; // ヘッダーのみ

  const header    = data[0];
  const toArchive = [];
  const toKeep    = [header];

  for (let i = 1; i < data.length; i++) {
    const row    = data[i];
    const status = String(row[T.STATUS] || '').trim();
    if (status === '完了' || status === 'done' || status === 'Done') {
      toArchive.push(row);
    } else {
      toKeep.push(row);
    }
  }

  if (toArchive.length === 0) return;

  // ✅ 完了タスクシートに追記
  const doneLastRow = done.getLastRow();
  if (doneLastRow === 0) {
    // 空シートならヘッダーも書く
    done.getRange(1, 1, 1, header.length).setValues([header]);
  }
  done.getRange(done.getLastRow() + 1, 1, toArchive.length, toArchive[0].length)
    .setValues(toArchive);

  // 📋 タスク（現役）シートを更新（完了行を除く）
  active.clearContents();
  active.getRange(1, 1, toKeep.length, toKeep[0].length).setValues(toKeep);

  Logger.log(`タスクアーカイブ: ${toArchive.length}件を完了タスクに移動`);

  // LINE通知（アーカイブ件数を報告）
  const token   = NOTIF_TOKEN();
  const groupId = NOTIF_GROUP_ID();
  if (token && groupId && toArchive.length > 0) {
    const names = toArchive.map(r => `  ✅ ${r[T.TASK]}`).join('\n');
    _notifyText(token, groupId,
      `📦 完了タスクを自動アーカイブしたで！\n${names}`);
  }
}

// ─────────────────────────────────────────────────
// トリガー一括セットアップ（手動で1回だけ実行）
// ─────────────────────────────────────────────────
function setupAllTriggers() {
  const MANAGED = [
    'morningTaskReport', 'morningMealConfirmRequest',
    'mealSummaryLunch', 'afternoonMealConfirmRequest', 'mealSummaryDinner',
    'hourlyEventCheck', 'dayBeforeReminder', 'archiveCompletedTasks',
  ];

  // 既存の管理対象トリガーを全削除してから再登録
  ScriptApp.getProjectTriggers().forEach(t => {
    if (MANAGED.includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });

  // 1a. 毎朝9時: タスクリマインダー
  ScriptApp.newTrigger('morningTaskReport')
    .timeBased().everyDays(1).atHour(9).create();

  // 1b. 毎朝9時: 昼の賄い確認リクエスト（atHour+nearMinute で9:05頃）
  ScriptApp.newTrigger('morningMealConfirmRequest')
    .timeBased().everyDays(1).atHour(9).nearMinute(5).create();

  // 1c. 11:30: 昼の賄い確認サマリー
  ScriptApp.newTrigger('mealSummaryLunch')
    .timeBased().everyDays(1).atHour(11).nearMinute(30).create();

  // 1d. 15:00: 夜の賄い確認リクエスト
  ScriptApp.newTrigger('afternoonMealConfirmRequest')
    .timeBased().everyDays(1).atHour(15).create();

  // 1e. 17:30: 夜の賄い確認サマリー
  ScriptApp.newTrigger('mealSummaryDinner')
    .timeBased().everyDays(1).atHour(17).nearMinute(30).create();

  // 2. 毎時: 12:00・18:00の賄い開始通知
  ScriptApp.newTrigger('hourlyEventCheck')
    .timeBased().everyHours(1).create();

  // 3. 毎晩21時: 翌日リマインダー
  ScriptApp.newTrigger('dayBeforeReminder')
    .timeBased().everyDays(1).atHour(21).create();

  // 4. 30分ごと: 完了タスクのアーカイブ
  ScriptApp.newTrigger('archiveCompletedTasks')
    .timeBased().everyMinutes(30).create();

  Logger.log('✅ トリガー登録完了:\n' + MANAGED.join('\n'));
}

// ─────────────────────────────────────────────────
// LINE Push
// ─────────────────────────────────────────────────
function _notifyText(token, groupId, text) {
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method:             'POST',
    contentType:        'application/json',
    headers:            { Authorization: `Bearer ${token}` },
    payload:            JSON.stringify({ to: groupId, messages: [{ type: 'text', text }] }),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200) Logger.log(`LINE Push 失敗 [${code}]: ${res.getContentText()}`);
}

// ─────────────────────────────────────────────────
// 日時ユーティリティ
// ─────────────────────────────────────────────────
function _nowJST() {
  return new Date(new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
}

function _jstDate() {
  const now = _nowJST();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function _fmtDate(d) {
  // "2026/07/04" 形式
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function _fmtSlash(d) { return _fmtDate(d); }

// ─────────────────────────────────────────────────
// テスト用（GASエディタから手動実行して確認）
// ─────────────────────────────────────────────────
function testMorningReport()    { morningTaskReport(); }
function testMealNotification() {
  // 12:00のダミー通知を強制送信
  const token   = NOTIF_TOKEN();
  const groupId = NOTIF_GROUP_ID();
  if (!token || !groupId) { Logger.log('設定未完了'); return; }
  _notifyText(token, groupId,
    '🧪 テスト: 自動通知スクリプト起動確認やで！\n' +
    'morningTaskReport / hourlyEventCheck / dayBeforeReminder\nの3つが登録されてるで✅');
}
