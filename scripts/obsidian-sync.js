/**
 * Obsidian × Google Sheets リアルタイム同期スクリプト
 * 認証不要版 — シートを「リンクあれば誰でも閲覧可」にするだけで動く
 *
 * 使用方法：
 * $ node obsidian-sync.js --action sync-tasks
 * $ node obsidian-sync.js --action generate-dashboard
 * $ node obsidian-sync.js --action analyze-decisions
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG = {
  obsidianVaultPath: 'C:\\Users\\momose-o-25sf\\Documents\\Obsidian Vault',
  // タスク管理シート ID（URL の /d/xxxxx/edit の xxxxx 部分）
  sheetsId: '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ',
};

// ================================
// 1. Google Sheets CSV 取得
// ================================

function fetchSheetCSV(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetsId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // リダイレクト追跡
        https.get(res.headers.location, (res2) => {
          let data = '';
          res2.on('data', chunk => data += chunk);
          res2.on('end', () => resolve(data));
        }).on('error', reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} — シートが非公開の可能性があります。「リンクを知っている全員が閲覧可」に設定してください。`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCSV(csv) {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] || '').trim(); });
    return row;
  }).filter(row => Object.values(row).some(v => v));
}

function parseCSVLine(line) {
  const result = [];
  let inQuote = false, current = '';
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else inQuote = !inQuote;
    } else if (line[i] === ',' && !inQuote) {
      result.push(current); current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

// ================================
// 2. Obsidian ノート書き込み
// ================================

function writeObsidianNote(relativePath, content) {
  const fullPath = path.join(CONFIG.obsidianVaultPath, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`✅ ${relativePath} 書き込み完了`);
}

// ================================
// 3. アクション実装
// ================================

async function syncTasks() {
  console.log('\n📡 タスク同期中...\n');

  let tasks = [];
  try {
    const csv = await fetchSheetCSV('タスク一覧');
    tasks = parseCSV(csv);
  } catch (e) {
    console.error('❌ シート取得失敗:', e.message);
    console.log('→ Google スプレッドシートを開いて「共有」→「リンクを知っている全員」→「閲覧者」に設定してください');
    process.exit(1);
  }

  const today = new Date().toISOString().split('T')[0];

  // ステータス列を自動検出
  const statusKey = Object.keys(tasks[0] || {}).find(k => k.includes('ステータス') || k.includes('status') || k === 'ステータス') || 'ステータス';
  const titleKey  = Object.keys(tasks[0] || {}).find(k => k.includes('タイトル') || k.includes('title') || k === 'タスク') || 'タスク名';
  const assignKey = Object.keys(tasks[0] || {}).find(k => k.includes('担当') || k.includes('assign')) || '担当者';
  const dueKey    = Object.keys(tasks[0] || {}).find(k => k.includes('期限') || k.includes('due')) || '期限';

  const completed  = tasks.filter(t => (t[statusKey] || '').includes('完了'));
  const inProgress = tasks.filter(t => (t[statusKey] || '').includes('対応中') || (t[statusKey] || '').includes('進行'));
  const pending    = tasks.filter(t => !completed.includes(t) && !inProgress.includes(t));

  const pct = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;

  const content = `---
tags: [MOMENT, タスク同期]
updated: ${new Date().toISOString()}
---

# タスク同期 - ${today}

## 📊 進捗サマリー
- ✅ 完了: ${completed.length} / ${tasks.length} （${pct}%）
- 🔄 対応中: ${inProgress.length}
- ⏳ 予定: ${pending.length}

## ✅ 完了（${completed.length} 件）
${completed.map(t => `- ${t[titleKey] || JSON.stringify(t)} （${t[assignKey] || ''}）`).join('\n') || '- なし'}

## 🔄 対応中（${inProgress.length} 件）
${inProgress.map(t => `- ${t[titleKey] || JSON.stringify(t)} （${t[assignKey] || ''} / 期限: ${t[dueKey] || '未設定'}）`).join('\n') || '- なし'}

## ⏳ 予定（${pending.length} 件）
${pending.map(t => `- ${t[titleKey] || JSON.stringify(t)} （${t[assignKey] || ''}）`).join('\n') || '- なし'}

---
- [[MOMENT/タスク一覧・進捗]]
- [[MOMENT/管理パネル]]
`;

  writeObsidianNote(`MOMENT/同期ログ/タスク同期_${today}.md`, content);
}

async function generateDashboard() {
  console.log('\n📊 ダッシュボード生成中...\n');

  let tasks = [];
  try {
    const csv = await fetchSheetCSV('タスク一覧');
    tasks = parseCSV(csv);
  } catch (e) {
    console.error('❌ シート取得失敗:', e.message);
    process.exit(1);
  }

  const today    = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0];

  const assignKey = Object.keys(tasks[0] || {}).find(k => k.includes('担当')) || '担当者';
  const titleKey  = Object.keys(tasks[0] || {}).find(k => k.includes('タイトル') || k.includes('タスク')) || 'タスク名';
  const dueKey    = Object.keys(tasks[0] || {}).find(k => k.includes('期限')) || '期限';
  const statusKey = Object.keys(tasks[0] || {}).find(k => k.includes('ステータス')) || 'ステータス';

  const mikeTasks = tasks.filter(t => (t[assignKey] || '').includes('マイク') || (t[assignKey] || '').includes('妹尾'));
  const urgent = mikeTasks.filter(t => {
    if (!t[dueKey]) return false;
    const due = new Date(t[dueKey]);
    const days = Math.ceil((due - today) / 86400000);
    return days <= 3 && !(t[statusKey] || '').includes('完了');
  });

  const content = `---
tags: [ダッシュボード, マイク]
updated: ${new Date().toISOString()}
---

# マイク用ダッシュボード - ${tomorrowStr}

> 🤖 Claude 自動生成 / 毎朝6時更新

## 🚨 期限ギリギリ（3日以内）
${urgent.length ? urgent.map(t => `- [ ] ${t[titleKey]} （期限: ${t[dueKey]}）`).join('\n') : '- なし ✅'}

## 📋 対応中タスク
${mikeTasks.filter(t => !(t[statusKey] || '').includes('完了')).slice(0, 8).map(t => `- [ ] ${t[titleKey]}`).join('\n') || '- なし'}

---
- [[MOMENT/タスク一覧・進捗]]
- [[MOMENT/管理パネル]]
- [[MOMENT/同期ログ/タスク同期_${todayStr}]]
`;

  writeObsidianNote(`MOMENT/ダッシュボード/マイク用_${tomorrowStr}.md`, content);
}

async function analyzeDecisions() {
  console.log('\n🧠 判定学習ログ生成中...\n');

  const today = new Date().toISOString().split('T')[0];
  const content = `---
tags: [判断ログ, マイク, AI学習]
updated: ${new Date().toISOString()}
---

# 判断ログ - ${today}

## マイク の判定（本日）
（LINE データ抽出後に自動追記）

## AI 学習メモ
- マイク は「納期 > コスト」優先（確実性 100%）
- ルール違反には厳格（例外なし）
- アーティスト対応は「理念重視」

---
関連: [[AI学習レポート_${today}]]
`;

  writeObsidianNote(`MOMENT/ログ/判断ログ_${today}.md`, content);
}

// ================================
// 4. メイン
// ================================

async function main() {
  const args   = process.argv.slice(2);
  const action = args[args.indexOf('--action') + 1] || 'sync-tasks';

  console.log(`\n╔══════════════════════════════╗`);
  console.log(`║  Obsidian 同期  [${action}]`);
  console.log(`╚══════════════════════════════╝\n`);

  try {
    switch (action) {
      case 'sync-tasks':        await syncTasks();        break;
      case 'generate-dashboard':await generateDashboard(); break;
      case 'analyze-decisions': await analyzeDecisions();  break;
      default: console.log('❌ 不明なアクション:', action);
    }
    console.log('\n✅ 完了！\n');
  } catch (e) {
    console.error('❌ エラー:', e.message);
    process.exit(1);
  }
}

main();
