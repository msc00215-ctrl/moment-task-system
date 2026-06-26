/**
 * MOMENT 2026 アーティストケア管理 — Antigravityユーティリティ
 *
 * 使い方:
 * 1. アーティストケアスプシ（Antigravity）のスクリプトエディタに貼り付け
 * 2. onOpen() を実行 or スプシを再読み込みするとメニューに「🌱 MOMENT Tools」が出る
 * 3. メニューから各処理を実行
 *
 * 機能:
 * A. アーティスト管理を「迎え日時」順にソート
 * B. タイムテーブル行をMAIN/BAR/AFTER別にカラーコーディング
 * C. MOMENTカラースキームをヘッダーに適用
 */

// ─── MOMENT 2026 カラースキーム ───────────────
const C = {
  // ヘッダー（ダークネイビー）
  HDR_BG: '#0D1F3C',
  HDR_FG: '#FFFFFF',

  // MAIN フロア（ネイビーブルー）
  MAIN_BG: '#1B3A5C',
  MAIN_FG: '#FFFFFF',

  // BAR フロア（ダークアンバー）
  BAR_BG: '#7B3F00',
  BAR_FG: '#FFFFFF',

  // AFTER（ダークパープル）
  AFTER_BG: '#4A235A',
  AFTER_FG: '#FFFFFF',

  // WORKSHOP（ダークティール）
  WORKSHOP_BG: '#1A4D3E',
  WORKSHOP_FG: '#FFFFFF',

  // OPENING（ダークオリーブ）
  OPENING_BG: '#2C3E00',
  OPENING_FG: '#FFFFFF',

  // アーティスト一覧 交互行
  ROW_A: '#EEF2FA',
  ROW_B: '#FFFFFF',
};

// ─── カスタムメニュー ──────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌱 MOMENT Tools')
    .addItem('📅 アーティストを入り日時順にソート', 'sortArtistsByArrival')
    .addItem('🎨 タイムテーブルをMAIN/BARカラーコーディング', 'colorCodeAllTimetables')
    .addItem('🖌️ MOMENTカラーをヘッダーに適用', 'applyMomentHeaders')
    .addSeparator()
    .addItem('🔄 全て一括実行', 'formatAll')
    .addToUi();
}

// ─── A. アーティスト管理を迎え日時順にソート ──────

function sortArtistsByArrival() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('アーティスト管理');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('「アーティスト管理」シートが見つかりません');
    return;
  }

  const allData = sheet.getDataRange().getValues();

  // ヘッダー行と「迎え日時」列を特定
  let headerRowIdx = -1;
  let arrivalColIdx = -1;
  for (let i = 0; i < Math.min(10, allData.length); i++) {
    const idx = allData[i].findIndex(c => String(c).includes('迎え日時'));
    if (idx >= 0) {
      headerRowIdx  = i;
      arrivalColIdx = idx;
      break;
    }
  }
  if (headerRowIdx < 0) {
    SpreadsheetApp.getUi().alert('「迎え日時」列が見つかりません');
    return;
  }

  // ヘッダー行の次の行からデータ開始（空行1行挟む場合も考慮）
  let dataStart = headerRowIdx + 2;
  if (dataStart <= allData.length && !allData[headerRowIdx + 1]?.some(c => c)) {
    dataStart = headerRowIdx + 2;
  } else {
    dataStart = headerRowIdx + 1;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (dataStart > lastRow || lastCol === 0) return;

  const numRows = lastRow - dataStart + 1;
  const range   = sheet.getRange(dataStart, 1, numRows, lastCol);
  const values  = range.getValues();
  const bgs     = range.getBackgrounds();
  const fgc     = range.getFontColors();
  const fwt     = range.getFontWeights();

  // "7/3(金) 14:30" → "07/03 14:30" 形式のソートキーに変換
  function arrivalKey(val) {
    const s = String(val || '').trim();
    if (!s) return '99/99 99:99';
    const m = s.match(/(\d{1,2})\/(\d{1,2})(?:[^\d]*(\d{1,2}:\d{2}))?/);
    if (!m) return '99/99 99:99';
    const mo   = m[1].padStart(2, '0');
    const da   = m[2].padStart(2, '0');
    const time = m[3] || '23:59';
    return `${mo}/${da} ${time}`;
  }

  const rows = values.map((row, i) => ({
    values: row,
    bg:     bgs[i],
    fg:     fgc[i],
    fw:     fwt[i],
    key:    arrivalKey(row[arrivalColIdx]),
  }));

  rows.sort((a, b) => a.key.localeCompare(b.key));

  range.setValues(rows.map(r => r.values));
  range.setFontColors(rows.map(r => r.fg));
  range.setFontWeights(rows.map(r => r.fw));

  // 交互色を再適用
  rows.forEach((_, i) => {
    const bg = i % 2 === 0 ? C.ROW_A : C.ROW_B;
    sheet.getRange(dataStart + i, 1, 1, lastCol).setBackground(bg);
  });

  SpreadsheetApp.getUi().alert(
    `✅ ${rows.length} 件のアーティストを迎え日時順にソートしました\n\n` +
    `先頭: ${rows[0]?.key || '—'}　末尾: ${rows[rows.length - 1]?.key || '—'}`
  );
}

// ─── B. タイムテーブルのステージ別カラーコーディング ──

function colorCodeAllTimetables() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let total = 0;

  ss.getSheets().forEach(sheet => {
    total += _colorCodeSheet(sheet);
  });

  SpreadsheetApp.getUi().alert(`✅ タイムテーブルのカラーコーディング完了\n（${total} 行に色を適用しました）`);
}

function _colorCodeSheet(sheet) {
  const data    = sheet.getDataRange().getValues();
  const lastCol = sheet.getLastColumn();
  let count     = 0;

  for (let hi = 0; hi < data.length; hi++) {
    const headerRow   = data[hi];
    const stageColIdx = headerRow.findIndex(c => String(c).trim() === 'ステージ');
    if (stageColIdx < 0) continue;

    // このヘッダーに対応するデータ行を処理
    for (let r = hi + 1; r < data.length; r++) {
      const row = data[r];

      // 空行 or 次の「ステージ」ヘッダーでストップ
      if (!row || row.every(c => !c)) break;
      if (row.findIndex(c => String(c).trim() === 'ステージ') >= 0) break;

      const stage = String(row[stageColIdx] || '').toUpperCase().trim();
      let bg = null, fg = null;

      if (stage === 'MAIN')        { bg = C.MAIN_BG;     fg = C.MAIN_FG; }
      else if (stage === 'BAR')    { bg = C.BAR_BG;      fg = C.BAR_FG; }
      else if (stage === 'AFTER')  { bg = C.AFTER_BG;    fg = C.AFTER_FG; }
      else if (stage === 'WORKSHOP') { bg = C.WORKSHOP_BG; fg = C.WORKSHOP_FG; }
      else if (stage.includes('OPEN')) { bg = C.OPENING_BG; fg = C.OPENING_FG; }

      if (bg) {
        sheet.getRange(r + 1, 1, 1, lastCol)
          .setBackground(bg)
          .setFontColor(fg);
        count++;
      }
    }
  }
  return count;
}

// ─── C. MOMENTカラーをヘッダー行に適用 ────────────

function applyMomentHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ss.getSheets().forEach(sheet => {
    const data    = sheet.getDataRange().getValues();
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return;

    data.forEach((row, i) => {
      const rowStr  = row.map(c => String(c)).join('|');
      const isHeader =
        /アーティスト名|ケア担当/.test(rowStr) ||
        (/ステージ/.test(rowStr) && /時間|タイプ/.test(rowStr));

      if (!isHeader) return;
      if (row.filter(c => String(c).trim()).length < 3) return;

      sheet.getRange(i + 1, 1, 1, lastCol)
        .setBackground(C.HDR_BG)
        .setFontColor(C.HDR_FG)
        .setFontWeight('bold');
    });
  });

  SpreadsheetApp.getUi().alert('✅ MOMENTカラースキームをヘッダーに適用しました');
}

// ─── 一括実行 ──────────────────────────────────

function formatAll() {
  applyMomentHeaders();
  colorCodeAllTimetables();
  sortArtistsByArrival();
}
