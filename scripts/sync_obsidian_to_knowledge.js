/**
 * Obsidian → 📚 確定知識ベース 同期スクリプト
 *
 * 実行方法: node scripts/sync_obsidian_to_knowledge.js
 *
 * ObsidianのMOMENT関連ノートを読み込んで📚確定知識ベースシートに反映。
 * Renderはクラウドなのでローカル実行後に手動でシートに反映する形。
 *
 * 対象フォルダ: C:\Users\momose-o-25sf\Documents\Obsidian Vault\MOMENT\
 * （60_Projects/MOMENT_2026/ジュニア知識ベース があればそちらも対象）
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(process.env.USERPROFILE, 'Downloads', 'moment-task-2026-7b2d2abfb7e6.json');
const SS_MAIN = '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY';
const SHEET = '📚 確定知識ベース';

// Obsidian Vaultのパス（複数候補をチェック）
const VAULT_CANDIDATES = [
  path.join(process.env.USERPROFILE, 'Documents', 'Obsidian Vault'),
  path.join(process.env.USERPROFILE, 'Documents', 'ObsidianVault'),
  path.join(process.env.USERPROFILE, 'Obsidian'),
];

// 読み込む対象フォルダ（Vault内の相対パス）
const TARGET_FOLDERS = [
  'MOMENT',
  '60_Projects/MOMENT_2026',
  '60_Projects/MOMENT_2026/ジュニア知識ベース',
  'MOMENT/LINEグループ',
];

// スキップするファイル名パターン
const SKIP_PATTERNS = [
  'Gemini_', 'Gemini用_', 'Google Drive',
  'セッションログ', 'プロンプト',
];

function findVault() {
  for (const candidate of VAULT_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function shouldSkip(filename) {
  return SKIP_PATTERNS.some(p => filename.includes(p));
}

function extractKeyFacts(content, filename) {
  const facts = [];
  const lines = content.split('\n');

  // ヘッダー（#）の後に続く重要情報を抽出
  let currentSection = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      currentSection = trimmed.replace(/^#+\s*/, '');
      continue;
    }
    // 箇条書きの重要情報
    if ((trimmed.startsWith('-') || trimmed.startsWith('・') || trimmed.startsWith('*')) && trimmed.length > 5) {
      const fact = trimmed.replace(/^[-・*]\s*/, '').trim();
      if (fact.length > 10 && fact.length < 200) {
        facts.push({ section: currentSection, fact });
      }
    }
    // テーブル行
    if (trimmed.startsWith('|') && !trimmed.startsWith('|---') && trimmed.includes('|')) {
      const cols = trimmed.split('|').filter(c => c.trim());
      if (cols.length >= 2 && cols[0].trim().length > 0) {
        const fact = cols.join(' | ').trim();
        if (fact.length > 5) facts.push({ section: currentSection, fact });
      }
    }
  }
  return facts;
}

async function main() {
  const vaultPath = findVault();
  if (!vaultPath) {
    console.error('❌ Obsidian Vaultが見つかりません');
    console.log('候補パス:', VAULT_CANDIDATES);
    process.exit(1);
  }
  console.log('📂 Vault:', vaultPath);

  // 対象ファイル収集
  const mdFiles = [];
  for (const folder of TARGET_FOLDERS) {
    const folderPath = path.join(vaultPath, folder);
    if (!fs.existsSync(folderPath)) {
      console.log('⏭️  フォルダなし:', folder);
      continue;
    }
    const files = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.md') && !shouldSkip(f))
      .map(f => ({ file: path.join(folderPath, f), folder }));
    mdFiles.push(...files);
    console.log(`📁 ${folder}: ${files.length}ファイル`);
  }

  if (mdFiles.length === 0) {
    console.log('⚠️  対象ファイルが見つかりませんでした');
    return;
  }

  // ファイルから事実抽出
  const allFacts = [];
  for (const { file, folder } of mdFiles) {
    const filename = path.basename(file);
    const content = fs.readFileSync(file, 'utf8');
    const facts = extractKeyFacts(content, filename);
    console.log(`  ${filename}: ${facts.length}件の事実を抽出`);
    for (const { section, fact } of facts) {
      allFacts.push({
        timestamp: new Date().toISOString(),
        category: section || path.basename(folder),
        content: fact,
        source: `Obsidian: ${filename}`,
      });
    }
  }

  console.log(`\n合計 ${allFacts.length}件の事実を抽出`);

  if (allFacts.length === 0) {
    console.log('⚠️  書き込むデータなし');
    return;
  }

  // シートに既存データ取得（重複チェック）
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: SS_MAIN, range: `'${SHEET}'!C:C`,
    valueRenderOption: 'FORMATTED_VALUE'
  });
  const existingContents = new Set((cur.data.values || []).map(r => r[0] || ''));

  const newFacts = allFacts.filter(f => !existingContents.has(f.content));
  console.log(`新規: ${newFacts.length}件 / 既存: ${allFacts.length - newFacts.length}件スキップ`);

  if (newFacts.length === 0) {
    console.log('✅ 追加する新規データなし');
    return;
  }

  // バッチ書き込み
  const rows = newFacts.map(f => [f.timestamp, f.category, f.content, f.source]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SS_MAIN,
    range: `'${SHEET}'!A:D`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows }
  });

  console.log(`✅ ${newFacts.length}件 📚 確定知識ベース に追加完了`);
  console.log('\n💡 次回以降: Obsidianでノートを更新したらこのスクリプトを再実行すると同期されます');
  console.log('   node scripts/sync_obsidian_to_knowledge.js');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
