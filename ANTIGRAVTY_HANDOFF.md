# MOMENT 2026 タスク管理システム — Antigravty ハンドオフ資料

> 作成日: 2026-06-25  
> 目的: このドキュメントを Antigravty に渡して最終仕上げ・実装を依頼するため  
> 状態: コア実装済み・GAS統合コード済み・テスト未実施・リリース前

---

## 1. プロジェクト概要

**MOMENT 2026**（奈良県天川村・洞川キャンプ場）の音楽フェス設営・運営をサポートするシステム。

- 開催日: 2026年7月3日(金) 〜 7月5日(日)
- スタッフ数: 約300人（LINE グループで連絡）
- 目標: LINEの会話からタスクを自動抽出・記録し、スタッフの質問にジュニアが答える

**全体パイプライン:**
```
LINE グループ → Render (Node.js) → OpenAI → Google Apps Script → Google Sheets
```

---

## 2. システム構成

### 2-1. デプロイ環境

| サービス | 役割 | URL / ID |
|---|---|---|
| Render | Node.js Express サーバー（LINE Webhook 受信） | `https://moment-task-system.onrender.com` |
| Google Apps Script | Sheets への書き込み・読み取りプロキシ | `https://script.google.com/macros/s/AKfycbzNyPrqg4QjUoSQgC6HKStUHhKcRiMymKqEKZXZ82AWKT_9EqLhzyBUhyhiif-F7uuW/exec` |
| タスク管理スプシ | ジュニアが書き込む本体スプレッドシート | ID: `1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ` |
| 工程表スプシ | 既存のスケジュール管理シート（ベース） | ID: `1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY` |

### 2-2. Render 環境変数（設定済み）

```
LINE_CHANNEL_SECRET=      # LINE Developers から取得
LINE_CHANNEL_ACCESS_TOKEN= # LINE Developers から取得
OPENAI_API_KEY=           # OpenAI から取得
GAS_WEBHOOK_URL=https://script.google.com/macros/s/AKfycbzNyPrqg4QjUoSQgC6HKStUHhKcRiMymKqEKZXZ82AWKT_9EqLhzyBUhyhiif-F7uuW/exec
GAS_SECRET_TOKEN=         # GAS の setupSecretToken() で生成したもの
```

### 2-3. Git リポジトリ

```
リポジトリ: msc00215-ctrl/moment-task-system
開発ブランチ: claude/2026-schedule-moment25-fujs9b
Render が監視するブランチ: claude/2026-schedule-moment25-fujs9b (mainではない！)
```

---

## 3. ディレクトリ構成

```
moment-task-system/
├── src/
│   ├── handlers/
│   │   └── lineWebhook.js       # LINE Webhook メインハンドラ
│   ├── services/
│   │   ├── openaiService.js     # OpenAI 呼び出し（タスク抽出・ジュニア応答・備品抽出）
│   │   ├── gasService.js        # GAS への書き込み・読み取り
│   │   └── lineService.js       # LINE reply API
│   ├── middleware/
│   │   └── lineSignature.js     # HMAC-SHA256 署名検証
│   ├── utils/
│   │   ├── security.js          # PII マスク・レート制限・isJuniorMention
│   │   ├── logger.js            # Pino ロガー
│   │   ├── retry.js             # OpenAI 呼び出しリトライ
│   │   └── validator.js         # タスクデータ正規化
│   └── config.js                # 環境変数
├── gas/
│   └── MOMENT2026_webhook_receiver.gs  # GAS スクリプト全体
├── tests/                       # Jest テスト
├── package.json
└── CLAUDE.md                    # エージェント設定
```

---

## 4. 実装済みコード

### 4-1. `src/handlers/lineWebhook.js`（全文）

```javascript
/**
 * LINE Webhook ハンドラ
 *
 * 動作フロー:
 * 1. 全メッセージ → ログ記録 + タスク自動抽出（無言）
 * 2. 「ジュニア」と呼ばれた時だけ → ジュニアが返答
 *    - 備品情報を教えてもらった → シートに保存して確認返信
 *    - 質問 → スタッフ/備品/スケジュール情報をもとに回答
 */
const { verifyLineSignature } = require('../middleware/lineSignature');
const { extractTasks, generateJuniorResponse, extractEquipmentInfo } = require('../services/openaiService');
const { reply } = require('../services/lineService');
const { postToGas, getSheetData } = require('../services/gasService');
const { assertRequired } = require('../config');
const { logger } = require('../utils/logger');
const { maskPII, checkRateLimit, isJuniorMention } = require('../utils/security');

const groupNameCache = new Map();

async function handleWebhook(req, res) {
  try {
    assertRequired();
  } catch (err) {
    logger.error({ err: err.message }, '設定不足 — Webhook 停止');
    res.status(500).send('Configuration error');
    return;
  }

  const valid = await verifyLineSignature(req);
  if (!valid) {
    logger.warn({ ip: req.ip }, 'LINE 署名検証失敗');
    res.status(401).send('Invalid signature');
    return;
  }

  res.status(200).send('OK');

  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  if (events.length === 0) return;

  const results = await Promise.allSettled(events.map(handleSingleEvent));
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      logger.error({ err: r.reason?.message, eventIndex: i }, 'イベント処理失敗');
    }
  });
}

async function handleSingleEvent(event) {
  if (!event || event.type !== 'message') return;
  if (!event.message || event.message.type !== 'text') return;

  const text = (event.message.text || '').trim();
  if (!text) return;

  const replyToken = event.replyToken;
  const userId     = event.source?.userId || 'unknown';
  const sourceType = event.source?.type   || 'unknown';
  const groupId    = event.source?.groupId || event.source?.roomId || null;
  const timestamp  = new Date(event.timestamp || Date.now()).toISOString();
  const groupName  = groupId ? await fetchGroupName(groupId) : 'DM';

  logger.info({ sourceType, groupName, textLen: text.length }, 'メッセージ受信');

  // ① レート制限
  if (!checkRateLimit(userId)) {
    logger.warn({ userId }, 'レート制限超過');
    return;
  }

  // ② 全メッセージをログ保存（PII マスク済み）
  const maskedText = maskPII(text);
  postToGas({
    type: 'lineLog',
    messages: [{ timestamp, groupId: groupId || 'direct', groupName, userId, text: maskedText }],
  }).catch(err => logger.error({ err: err.message }, 'GAS ログ送信失敗'));

  // ③ タスク抽出（常に・無言）
  let tasks;
  try {
    tasks = await extractTasks(text, groupName);
  } catch (err) {
    logger.error({ err: err.message }, 'extractTasks 失敗');
  }

  if (tasks && tasks.length > 0) {
    postToGas({
      type: 'task',
      groupName,
      groupId: groupId || 'direct',
      userId,
      originalText: maskedText,
      timestamp,
      tasks,
    }).catch(err => logger.error({ err: err.message }, 'GAS タスク送信失敗'));
  }

  // ④ 「ジュニア」が呼ばれていない → 終了（返答なし）
  if (!isJuniorMention(text) || !replyToken) return;

  // ⑤ 備品情報を教えてもらったか確認
  let equipInfo;
  try {
    equipInfo = await extractEquipmentInfo(text);
  } catch {
    equipInfo = { found: false };
  }

  if (equipInfo?.found && equipInfo.item && equipInfo.location) {
    postToGas({
      type: 'equipment',
      item:       equipInfo.item,
      category:   equipInfo.category   || '',
      quantity:   equipInfo.quantity   ?? '',
      unit:       equipInfo.unit       || '',
      location:   equipInfo.location,
      department: equipInfo.department || '',
      notes:      equipInfo.notes      || '',
    }).catch(err => logger.error({ err: err.message }, 'GAS 備品登録失敗'));

    const qty = equipInfo.quantity ? `${equipInfo.quantity}${equipInfo.unit || ''}` : '';
    await safeReply(replyToken, userId,
      `覚えたで！${equipInfo.item}${qty ? `（${qty}）` : ''} → ${equipInfo.location}やな🌱`);
    return;
  }

  // ⑥ ジュニア Q&A
  try {
    const [equipment, staff] = await Promise.all([
      getSheetData('equipment'),
      getSheetData('staff'),
    ]);
    const response = await generateJuniorResponse(text, groupName, { equipment, staff });
    if (response) await safeReply(replyToken, userId, response);
  } catch (err) {
    logger.error({ err: err.message }, 'Junior応答失敗');
  }
}

async function fetchGroupName(groupId) {
  if (groupNameCache.has(groupId)) return groupNameCache.get(groupId);
  try {
    const { getClient } = require('../services/lineService');
    const client = await getClient();
    const summary = await client.getGroupSummary(groupId);
    const name = summary?.groupName || groupId;
    groupNameCache.set(groupId, name);
    return name;
  } catch {
    return groupId;
  }
}

async function safeReply(replyToken, userId, text) {
  try {
    await reply(replyToken, text, userId);
  } catch (err) {
    logger.error({ err: err.message }, 'reply 失敗');
  }
}

module.exports = { handleWebhook };
```

### 4-2. `src/utils/security.js` の追加関数

```javascript
// ─── ジュニア呼び出し検出 ─────────────────────────────
function isJuniorMention(text) {
  if (!text) return false;
  return /ジュニア|junior/i.test(text);
}

module.exports = { maskPII, isDataQuery, checkRateLimit, isJuniorMention };
```

### 4-3. `src/services/openaiService.js` — 主要追加部分

#### ジュニアのキャラクタープロンプト

```javascript
const JUNIOR_BASE_PROMPT = `あなたはMOMENT 2026の現場バディ「ジュニア」です。

【キャラクター】
まだ生まれたてのAIバディ。みんなに育ててもらいながら成長していく存在。
親しみやすく温かいタメ口。関西弁ベースやけどきつくない。
「横にいる頼れるツレ」のスタンス。誰一人置いてきぼりにしない。

【返答ルール】
- 3〜4文以内で簡潔に
- 知らないことは「それはまだわからんわ！誰か教えてくれへん？」と素直に言う
- 個人の連絡先・財務情報は絶対に答えない
- 絵文字は1〜2個まで
- タメ口・フレンドリーに`;
```

#### ジュニア応答生成（gpt-4o, temp 0.6）

```javascript
async function generateJuniorResponse(text, groupName = null, context = {}) {
  // buildJuniorSystemPrompt() で備品・スタッフデータを注入
  // model: 'gpt-4o', max_tokens: 200, temperature: 0.6
}
```

#### 備品情報抽出（gpt-4o-mini, temp 0）

```javascript
const EQUIPMENT_EXTRACT_PROMPT = `JSONのみを返してください。
メッセージから備品・資材の保管場所情報を抽出します。
情報が不十分または含まれていない場合は {"found": false} を返してください。
場所が曖昧な場合（「あそこ」「ここ」等）も {"found": false} を返してください。

出力形式:
{"found":true,"item":"アイテム名","category":"設営資材|電源機材|什器|消耗品|照明機材|音響機材|その他","quantity":数値またはnull,"unit":"単位またはnull","location":"具体的な保管場所","department":"担当部署またはnull","notes":"備考またはnull"}`;

async function extractEquipmentInfo(text) {
  // model: 'gpt-4o-mini', response_format: json_object, max_tokens: 200
  // 返値: { found: true, item, location, ... } または { found: false }
}
```

#### モデル選定方針

| 処理 | モデル | 理由 |
|---|---|---|
| タスク抽出 | `gpt-4o-mini` | スタッフには見えない処理・コスト最優先 |
| 備品情報抽出 | `gpt-4o-mini` | 構造化JSONのみ・精度より速度 |
| ジュニア Q&A | `gpt-4o` | スタッフ対面の返答・品質優先 |

---

## 5. GAS スクリプト全文（`gas/MOMENT2026_webhook_receiver.gs`）

```javascript
/**
 * MOMENT 2026 LINE Bot Webhook レシーバー
 *
 * シート構成（タスク管理スプシ）:
 *   📋 タスク（現役）  ← 常に最新状態のみ。同じタスクは上書き更新
 *   ✅ 完了タスク      ← 完了したタスクを自動アーカイブ
 *   📱 LINEリアルタイム ← 直近500件のみ保持
 *   📦 備品・資材      ← 備品の保管場所・数量管理
 *   👥 スタッフ        ← スタッフ名・部署・シフト管理
 *   🔗 リンク集        ← 関連スプレッドシートへのリンク
 *
 * シート構成（工程表スプシ — 追加のみ）:
 *   🏠 HUB            ← 表紙。リンクボタン・エリアマップ・目次・ジュニア自己紹介
 *   📊 タスク連携      ← IMPORTRANGE でタスクシートをリアルタイム反映
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
const LINE_HEADERS      = ['タイムスタンプ', 'グループ名', 'ユーザーID', 'メッセージ'];
const EQUIPMENT_HEADERS = ['アイテム名', 'カテゴリ', '数量', '単位', '保管場所', '担当部署', '備考'];
const STAFF_HEADERS     = ['名前', '部署', '役割', '入り日時', '退場日時', '備考'];
const LINKS_HEADERS     = ['タイトル', 'URL', '説明'];

const COL = {
  LAST_UPDATED: 0, GROUP: 1, ASSIGNEE: 2, DEPARTMENT: 3, TASK: 4,
  DEADLINE: 5, PRIORITY: 6, STATUS: 7, CREATED: 8, ORIGINAL: 9,
};

// ─── doPost（書き込み）───────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (SECRET_TOKEN && data.secret !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (data.type === 'lineLog')   writeLineLog(ss, data.messages || []);
    else if (data.type === 'task') upsertTasks(ss, data);
    else if (data.type === 'equipment') upsertEquipment(ss, data);
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('doPost エラー:', err.message);
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ─── doGet（読み取り）────────────────────────────────────
function doGet(e) {
  try {
    const type   = (e.parameter && e.parameter.type)   || '';
    const secret = (e.parameter && e.parameter.secret) || '';
    if (SECRET_TOKEN && secret !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (type === 'equipment') return jsonResponse({ ok: true, data: getEquipmentData(ss) });
    if (type === 'staff')     return jsonResponse({ ok: true, data: getStaffData(ss) });
    return jsonResponse({ ok: false, error: 'unknown type' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function getEquipmentData(ss) {
  const sheet = ss.getSheetByName(SHEET_EQUIPMENT);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, EQUIPMENT_HEADERS.length).getValues();
  return rows.filter(r => r[0]).map(r => ({
    item: r[0]||'', category: r[1]||'', quantity: r[2]||'', unit: r[3]||'',
    location: r[4]||'', department: r[5]||'', notes: r[6]||'',
  }));
}

function getStaffData(ss) {
  const sheet = ss.getSheetByName(SHEET_STAFF);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, STAFF_HEADERS.length).getValues();
  return rows.filter(r => r[0]).map(r => ({
    name: r[0]||'', department: r[1]||'', role: r[2]||'',
    shiftStart: r[3] ? String(r[3]) : '', shiftEnd: r[4] ? String(r[4]) : '', notes: r[5]||'',
  }));
}

// ─── タスク upsert ────────────────────────────────────────
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
      const doneRow = [now, groupName, assignee, department, taskText, deadline, priority, '完了', now, original];
      doneSheet.getRange(doneSheet.getLastRow() + 1, 1, 1, doneRow.length).setValues([doneRow]);
    } else {
      if (existingIdx >= 0) {
        const existingCreated = activeRows[existingIdx][COL.CREATED] || now;
        const updatedRow = [now, groupName, assignee, department, taskText, deadline, priority, status, existingCreated, original];
        activeSheet.getRange(existingIdx + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
      } else {
        const newRow = [now, groupName, assignee, department, taskText, deadline, priority, status, now, original];
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

// ─── LINE ログ ────────────────────────────────────────────
function writeLineLog(ss, messages) {
  if (!messages.length) return;
  const sheet = getOrCreateSheet(ss, SHEET_LINE_LOG, LINE_HEADERS);
  const rows = messages.map(m => [m.timestamp||new Date().toISOString(), m.groupName||'', m.userId||'', m.text||'']);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  const total = sheet.getLastRow() - 1;
  if (total > LINE_LOG_MAX) sheet.deleteRows(2, total - LINE_LOG_MAX);
}

// ─── 備品 upsert（ジュニアが会話から学習）─────────────────
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
  const row = [item, data.category||'', data.quantity||'', data.unit||'', location, data.department||'', data.notes||''];
  if (existingIdx >= 0) {
    sheet.getRange(existingIdx + 1, 1, 1, row.length).setValues([row]);
  } else {
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  }
}

// ─── ユーティリティ ───────────────────────────────────────
function getOrCreateSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold').setBackground('#1A237E').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, headers.length, 140);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ─── セットアップ（1回だけ手動実行）──────────────────────
function setupAll() {
  setupSecretToken();
  setupReferenceSheets();
}

function setupSecretToken() {
  const existing = PropertiesService.getScriptProperties().getProperty('GAS_SECRET_TOKEN');
  if (existing) { console.log('GAS_SECRET_TOKEN は設定済みです'); return; }
  const token = 'moment2026_' + Math.random().toString(36).slice(2, 10);
  PropertiesService.getScriptProperties().setProperty('GAS_SECRET_TOKEN', token);
  console.log('GAS_SECRET_TOKEN を設定しました:', token);
}

function setupReferenceSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  // 備品・資材シート（サンプルデータ入り）
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
  // スタッフシート（実名入り）
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
    linksSheet.getRange(2, 1, 2, LINKS_HEADERS.length).setValues([
      ['MOMENT 2026 工程表', SCHEDULE_SHEET_URL, 'メインスケジュール・作業工程表'],
      ['タスク管理シート', 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit', 'BotがタスクをWriteするシート'],
    ]);
  }
  console.log('参照シートのセットアップ完了');
}

// ─── 工程表スプシとの統合セットアップ（1回だけ手動実行）──
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
  sheet.getRange('A2').setFormula(
    '=IFERROR(IMPORTRANGE("' + SPREADSHEET_ID + '","📋 タスク（現役）!A2:J"),"⚠️ アクセス許可が必要です — このセルをクリック → 許可する")'
  );
  const rules = [
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('対応中').setBackground('#FFF9C4').build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('完了').setBackground('#C8E6C9').build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('調整中').setBackground('#FCE4EC').build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('未着手').setBackground('#FFFFFF').build(),
  ];
  sheet.setConditionalFormatRules(rules);
}

// ② HUBシート（表紙）— 既存シートはそのまま、新シートを一番左に追加
function setupHubSheet(ss) {
  const name = '🏠 HUB';
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  else sheet.clear();
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);
  sheet.setTabColor('#2E7D32');
  sheet.setColumnWidth(1, 20);
  [2,3,4,5,6,7,8,9,10,11].forEach(c => sheet.setColumnWidth(c, 120));
  sheet.setColumnWidth(12, 20);

  // タイトル
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

  // タスク管理リンクボタン（オレンジ・目立つ）
  sheet.setRowHeight(5, 50);
  sheet.getRange('B5:K5').merge()
    .setFormula('=HYPERLINK("' + TASK_SS_URL + '","📋  タスク管理を開く  →  ジュニアが自動記録中")')
    .setFontSize(15).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBackground('#E65100').setFontColor('#FFFFFF');

  // エリア別タスク状況
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
  [{ row: 8, items: areas.slice(0, 5) }, { row: 12, items: areas.slice(5, 10) }].forEach(({ row, items }) => {
    items.forEach((area, i) => {
      const col = 2 + i * 2;
      sheet.getRange(row, col, 1, 2).merge()
        .setValue(area.icon + '  ' + area.name)
        .setFontSize(11).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle')
        .setBackground('#1565C0').setFontColor('#FFFFFF');
      sheet.getRange(row + 1, col, 1, 2).merge()
        .setFormula('=IFERROR(COUNTIF(\'📊 タスク連携\'!D:D,"' + area.dept + '"),"–")')
        .setFontSize(28).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle')
        .setBackground('#E3F2FD').setFontColor('#0D47A1');
      sheet.getRange(row + 2, col, 1, 2).merge()
        .setValue('件のタスク').setFontSize(10).setHorizontalAlignment('center')
        .setBackground('#BBDEFB').setFontColor('#0D47A1');
    });
  });

  // 目次
  sheet.setRowHeight(18, 32);
  sheet.getRange('B18:K18').merge()
    .setValue('📚  目次 — シートへのリンク')
    .setFontSize(13).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBackground('#E8F5E9').setFontColor('#1B5E20');
  const tocLinks = [
    { label: '📋 タスク（現役）', url: TASK_SS_URL },
    { label: '✅ 完了タスク',     url: TASK_SS_URL },
    { label: '📦 備品・資材',     url: TASK_SS_URL },
    { label: '👥 スタッフ',       url: TASK_SS_URL },
    { label: '📊 タスク連携',     url: SCHEDULE_SHEET_URL },
    { label: '🔗 リンク集',       url: TASK_SS_URL },
  ];
  tocLinks.forEach((item, i) => {
    const col = 2 + (i % 5) * 2;
    const row = i < 5 ? 19 : 20;
    sheet.setRowHeight(row, 36);
    sheet.getRange(row, col, 1, 2).merge()
      .setFormula('=HYPERLINK("' + item.url + '","' + item.label + '")')
      .setFontSize(10).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBackground('#F1F8E9').setFontColor('#2E7D32')
      .setBorder(true,true,true,true,false,false,'#A5D6A7', SpreadsheetApp.BorderStyle.SOLID);
  });

  // ジュニア自己紹介
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
    .setValue(juniorText).setFontSize(11).setVerticalAlignment('middle').setWrap(true)
    .setBackground('#FFFDE7').setFontColor('#4E342E');
}
```

---

## 6. タスク抽出プロンプト（OpenAI SYSTEM_PROMPT）

スタッフ名の正規化・タスク判定条件・日付解釈・ステータス判定・優先度判定・個人情報除去のルールを含む完全版は `src/services/openaiService.js` の `SYSTEM_PROMPT` 定数を参照。

**主要スタッフ名マッピング（抜粋）:**
```
HI-C / hi-c → 全体
妹尾 真行 / 妹尾 / Masayuki Senoo → 全体
Joshua SW / ジョシュア → 舞台監督
yusuke ono / 小野裕介 / レオ / SOL → 音響
Kunihiko Harada / 原田 → 電源
Shu YAMAWAKI / 山脇Shu → 演出・照明
hajime / 忍 → 設営
🌞Hiroto Arai / ヒロト → バー
南城 祐介 / 南ちゃん → ボランティア
```

---

## 7. 未実施タスク（Antigravty へのお願い）

### 7-1. GAS 更新作業（人間が手動でやる）

以下は Antigravty ではなく **ユーザー本人が GAS エディタで実行する** 手順:

1. GASエディタ を開く（`script.google.com`）
2. プロジェクト `MOMENT2026_webhook_receiver` を開く
3. 上記セクション5のコードを全選択して上書きペースト → 保存
4. 「デプロイ」→「デプロイを管理」→ 既存のデプロイを「新しいバージョン」で更新
5. 関数選択で `setupScheduleIntegration` を選択 → ▶「実行」（権限を許可）
6. 工程表スプシを開き `📊 タスク連携` シートの A2 をクリック →「アクセスを許可」

### 7-2. テスト（リリース前に実施）

| # | LINEに送るメッセージ | 期待する Bot の動作 |
|---|---|---|
| 1 | 「明日9時集合やで」 | **無反応**（ログとタスク記録のみ） |
| 2 | 「テント設営を田中さんよろしく」 | **無反応**（タスク自動登録のみ） |
| 3 | 「ジュニア、音響の担当誰？」 | 関西弁で「yusuke onoさんやで！音響担当🎵」など |
| 4 | 「ジュニア、発電機はエントランス倉庫にあるで」 | 「覚えたで！発電機 → エントランス倉庫やな🌱」|
| 5 | 「ジュニア、発電機どこ？」（テスト4の後） | 「エントランス倉庫やで！」 |

### 7-3. 本番前に必要な作業（ユーザー判断）

| 作業 | 期限 | 理由 |
|---|---|---|
| Render Starter プラン ($7/月) に変更 | 7/2 まで | Free プランはスリープあり → LINE メッセージを取りこぼす |
| OpenAI クレジット残高確認 | 7/2 まで | 300人×4日 ≈ $20-25 の見込み |
| LINE Webhook URL 確認 | 随時 | `https://moment-task-system.onrender.com/webhook` |

---

## 8. 制約・やってはいけないこと

- **リリースは「よし」の一言があるまで絶対に公開しない（水面下作業）**
- スタッフ全員の LINE グループへの告知は禁止（バレると困る）
- ボットが「ジュニア」と呼ばれていない時に自発的に返事するのは禁止
- 個人の電話番号・メールアドレス・財務情報を返答するのは禁止
- 工程表スプシの **既存シートは絶対に変更・削除しない**（新シートのみ追加）
- `main` ブランチへのプッシュ禁止（Render は `claude/2026-schedule-moment25-fujs9b` を監視）

---

## 9. スプシ構成まとめ

### タスク管理スプシ（Bot が書き込む本体）
ID: `1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ`

| シート名 | 役割 |
|---|---|
| 📋 タスク（現役） | 現在有効なタスク。同一タスクは上書き更新 |
| ✅ 完了タスク | 完了したタスクの履歴 |
| 📱 LINEリアルタイム | 直近500件のログ |
| 📦 備品・資材 | ジュニアが学習・人間が手動入力する備品リスト |
| 👥 スタッフ | シフト・部署・役割情報 |
| 🔗 リンク集 | 関連シートへのリンク |

### 工程表スプシ（既存 + 新規追加のみ）
ID: `1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY`

| シート名 | 役割 | 状態 |
|---|---|---|
| 🏠 HUB | 表紙。ナビゲーション + ジュニア紹介 | **新規追加（実装済み）** |
| 📊 タスク連携 | IMPORTRANGE でタスクデータをリアルタイム反映 | **新規追加（実装済み）** |
| （その他の既存シート） | 既存の工程表データ | **変更なし** |

---

*以上が現在のシステムの全状態。テスト → 「よし」でリリース。*
