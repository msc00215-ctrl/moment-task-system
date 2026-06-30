/**
 * MOMENT 2026 — 賄い時間・食数を工程表と全体スケジュールに追加
 * 賄いシートから食数を動的に取得して挿入
 * 昼食 11:00 / 夕食 18:00
 */

const { google } = require('googleapis');
const path = require('path');
const KEY_FILE = path.join(process.env.USERPROFILE, 'Downloads', 'moment-task-2026-7b2d2abfb7e6.json');
const SS_MAIN = '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY';
const SCOPES  = ['https://www.googleapis.com/auth/spreadsheets'];

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── メタ取得 ──
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SS_MAIN });
  const allSheets = meta.data.sheets;
  const getGid   = (t) => allSheets.find(s => s.properties.title === t)?.properties?.sheetId;
  const getTitle = (fn) => allSheets.map(s => s.properties.title).find(fn);

  const mealTitle   = getTitle(t => t.includes('賄い') && t.includes('食数'));
  const setsuTitle  = getTitle(t => t.includes('MOMENT設営') && t.includes('工程'));
  const schedTitle  = getTitle(t => t.includes('全体スケジュール'));

  const setsuGid = getGid(setsuTitle);
  const schedGid = getGid(schedTitle);

  console.log('賄いシート:', mealTitle);
  console.log('工程表:', setsuTitle);
  console.log('全体スケジュール:', schedTitle);

  // ── ① 賄いシートから食数を取得 ──
  const mealRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SS_MAIN,
    range: "'" + mealTitle + "'!A1:H40",
    valueRenderOption: 'FORMATTED_VALUE'
  });
  const mealRows = mealRes.data.values || [];

  // 食数マップ: { '6/29': { lunch: '2食', dinner: '9食' }, ... }
  const mealMap = {};
  mealRows.forEach(row => {
    const dateCell = row[0] || '';
    const mealCell = row[1] || '';
    const totalCell = row[2] || '';
    const match = dateCell.match(/(\d+\/\d+)/);
    if (!match) return;
    const dayKey = match[1];
    if (!mealMap[dayKey]) mealMap[dayKey] = {};
    if (mealCell.includes('昼食')) mealMap[dayKey].lunch  = totalCell;
    if (mealCell.includes('夕食')) mealMap[dayKey].dinner = totalCell;
  });

  console.log('\n📊 食数マップ:');
  Object.entries(mealMap).forEach(([d, v]) => console.log('  ' + d + ' 昼:' + (v.lunch||'-') + ' 夕:' + (v.dinner||'-')));

  // ── ② シート読み込み・日付ヘッダー位置特定 ──
  async function readSheet(title) {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SS_MAIN,
      range: "'" + title + "'!A1:G150",
      valueRenderOption: 'FORMATTED_VALUE'
    });
    return r.data.values || [];
  }

  function findDayHeaders(rows) {
    const pattern = {
      '6/29': null, '6/30': null, '7/1': null, '7/2': null,
      '7/3': null,  '7/4': null,  '7/5': null,  '7/6': null
    };
    rows.forEach((row, i) => {
      const t = row.join(' ');
      if (t.includes('6/29') && (t.includes('Day 1') || t.includes('設営'))) pattern['6/29'] = i;
      if (t.includes('6/30') && t.includes('Day 2')) pattern['6/30'] = i;
      if (t.includes('7/1')  && t.includes('Day 3')) pattern['7/1']  = i;
      if (t.includes('7/2')  && t.includes('Day 4')) pattern['7/2']  = i;
      if (t.includes('7/3')  && t.includes('Day 1') && t.includes('本番')) pattern['7/3'] = i;
      if (t.includes('7/4')  && t.includes('Day 2') && t.includes('本番')) pattern['7/4'] = i;
      if (t.includes('7/5')  && t.includes('Day 3') && t.includes('本番')) pattern['7/5'] = i;
      if (t.includes('7/6')  && t.includes('撤収'))  pattern['7/6']  = i;
    });
    return pattern;
  }

  // 各日セクションの挿入先（末尾の空行位置）を返す
  function getSectionEnd(rows, dayHeaders, dayKey) {
    const keys = Object.keys(dayHeaders);
    const idx = keys.indexOf(dayKey);
    const headerRow = dayHeaders[dayKey];
    if (headerRow === null) return null;
    const nextDays = keys.slice(idx + 1).map(k => dayHeaders[k]).filter(v => v !== null);
    const nextHeader = nextDays.length > 0 ? Math.min(...nextDays) : rows.length;
    for (let i = nextHeader - 1; i > headerRow; i--) {
      if (!rows[i] || !rows[i].some(c => c && c.trim())) return i;
    }
    return nextHeader - 1;
  }

  // ── ③ 工程表に賄い行を挿入 ──
  console.log('\n\n━━━ 工程表 に追加 ━━━');
  {
    let setsuRows = await readSheet(setsuTitle);
    let dayHeaders = findDayHeaders(setsuRows);
    console.log('日付ヘッダー:', JSON.stringify(dayHeaders));

    const days = ['6/29','6/30','7/1','7/2','7/3','7/4','7/5','7/6'];
    // 下から順に挿入（インデックスがずれないように）
    for (const dayKey of [...days].reverse()) {
      const m = mealMap[dayKey];
      if (!m) continue;

      // 現状を再読み込み
      setsuRows = await readSheet(setsuTitle);
      dayHeaders = findDayHeaders(setsuRows);
      const endIdx = getSectionEnd(setsuRows, dayHeaders, dayKey);
      if (endIdx === null) { console.log('⚠️  ' + dayKey + ': ヘッダーなし'); continue; }

      // 既に「賄い」行があればスキップ
      const sectionContent = setsuRows.slice(dayHeaders[dayKey], endIdx + 2);
      if (sectionContent.some(r => r.join(' ').includes('賄い'))) {
        console.log('⏭️  ' + dayKey + ': 賄い行すでに存在 → スキップ');
        continue;
      }

      const newRows = [
        ['11:00', '🍽️ 賄い 昼食', m.lunch || '-', '賄いチーム / 欠食・アレルギー要確認', '🟡 中'],
        ['18:00', '🍽️ 賄い 夕食', m.dinner || '-', '賄いチーム / 欠食・アレルギー要確認', '🟡 中'],
      ];

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SS_MAIN,
        requestBody: { requests: [{ insertDimension: {
          range: { sheetId: setsuGid, dimension: 'ROWS', startIndex: endIdx, endIndex: endIdx + 2 },
          inheritFromBefore: true
        }}]}
      });
      await delay(300);

      await sheets.spreadsheets.values.update({
        spreadsheetId: SS_MAIN,
        range: "'" + setsuTitle + "'!A" + (endIdx + 1) + ':E' + (endIdx + 2),
        valueInputOption: 'RAW',
        requestBody: { values: newRows }
      });
      await delay(300);

      // 薄いオレンジ色で書式
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SS_MAIN,
        requestBody: { requests: [{
          repeatCell: {
            range: { sheetId: setsuGid, startRowIndex: endIdx, endRowIndex: endIdx + 2, startColumnIndex: 0, endColumnIndex: 6 },
            cell: { userEnteredFormat: { backgroundColor: { red: 1.0, green: 0.94, blue: 0.8 } } },
            fields: 'userEnteredFormat.backgroundColor'
          }
        }]}
      });
      await delay(200);

      console.log('✅ ' + dayKey + ': 昼' + (m.lunch||'-') + ' / 夕' + (m.dinner||'-') + ' → 行' + (endIdx+1) + '〜' + (endIdx+2));
    }
  }

  // ── ④ 全体スケジュールに賄い行を挿入 ──
  console.log('\n\n━━━ 全体スケジュール に追加 ━━━');
  {
    let schedRows = await readSheet(schedTitle);
    let dayHeaders = findDayHeaders(schedRows);
    console.log('日付ヘッダー:', JSON.stringify(dayHeaders));

    const days = ['6/29','6/30','7/1','7/2','7/3','7/4','7/5','7/6'];
    for (const dayKey of [...days].reverse()) {
      const m = mealMap[dayKey];
      if (!m) continue;

      schedRows = await readSheet(schedTitle);
      dayHeaders = findDayHeaders(schedRows);
      const endIdx = getSectionEnd(schedRows, dayHeaders, dayKey);
      if (endIdx === null) { console.log('⚠️  ' + dayKey + ': ヘッダーなし'); continue; }

      const sectionContent = schedRows.slice(dayHeaders[dayKey], endIdx + 2);
      if (sectionContent.some(r => r.join(' ').includes('賄い'))) {
        console.log('⏭️  ' + dayKey + ': 賄い行すでに存在 → スキップ');
        continue;
      }

      const newRows = [
        ['11:00', '賄い', '賄いチーム', '🍽️ 賄い 昼食（' + (m.lunch||'-') + '）', '', '', '欠食・アレルギー要確認'],
        ['18:00', '賄い', '賄いチーム', '🍽️ 賄い 夕食（' + (m.dinner||'-') + '）', '', '', '欠食・アレルギー要確認'],
      ];

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SS_MAIN,
        requestBody: { requests: [{ insertDimension: {
          range: { sheetId: schedGid, dimension: 'ROWS', startIndex: endIdx, endIndex: endIdx + 2 },
          inheritFromBefore: true
        }}]}
      });
      await delay(300);

      await sheets.spreadsheets.values.update({
        spreadsheetId: SS_MAIN,
        range: "'" + schedTitle + "'!A" + (endIdx + 1) + ':G' + (endIdx + 2),
        valueInputOption: 'RAW',
        requestBody: { values: newRows }
      });
      await delay(300);

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SS_MAIN,
        requestBody: { requests: [{
          repeatCell: {
            range: { sheetId: schedGid, startRowIndex: endIdx, endRowIndex: endIdx + 2, startColumnIndex: 0, endColumnIndex: 7 },
            cell: { userEnteredFormat: { backgroundColor: { red: 1.0, green: 0.94, blue: 0.8 } } },
            fields: 'userEnteredFormat.backgroundColor'
          }
        }]}
      });
      await delay(200);

      console.log('✅ ' + dayKey + ': 昼' + (m.lunch||'-') + ' / 夕' + (m.dinner||'-') + ' → 行' + (endIdx+1) + '〜' + (endIdx+2));
    }
  }

  console.log('\n🎉 完了！工程表・全体スケジュール 両方に賄い時間・食数を追加しました');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
