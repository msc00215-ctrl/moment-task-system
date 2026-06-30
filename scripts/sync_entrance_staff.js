/**
 * MOMENT 2026 — エントランス スタッフ管理表 同期
 * エントランスSS(スタッフ管理表) → 工程表SS(新規シート) に全データ反映
 */

const { google } = require('googleapis');
const path = require('path');
const KEY_FILE = path.join(process.env.USERPROFILE, 'Downloads', 'moment-task-2026-7b2d2abfb7e6.json');
const SS_MAIN = '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY';
const SS_ENT  = '1ncj9sVeOKFhqavsdo4hsjaQ2f5LLeMptBxHSQTgwP0g';
const SCOPES  = ['https://www.googleapis.com/auth/spreadsheets'];
const NEW_SHEET_TITLE = '👤 エントランス スタッフ管理表';

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. エントランスSS スタッフ管理表 全データ取得 ──
  console.log('📥 エントランス スタッフ管理表 読み込み中...');
  const entRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SS_ENT,
    range: "'スタッフ管理表'!A1:P100",
    valueRenderOption: 'FORMATTED_VALUE'
  });
  const entRows = entRes.data.values || [];
  console.log(`✅ ${entRows.length}行 取得完了`);

  // ── 2. 工程表SS のシート確認 ──
  const mainMeta = await sheets.spreadsheets.get({ spreadsheetId: SS_MAIN });
  const sheetTitles = mainMeta.data.sheets.map(s => s.properties.title);
  const existingGid = mainMeta.data.sheets.find(s => s.properties.title === NEW_SHEET_TITLE)?.properties?.sheetId;

  // ── 3. 既存シートがあれば削除、なければ新規作成 ──
  if (existingGid !== undefined) {
    console.log(`🗑️  既存シート "${NEW_SHEET_TITLE}" を削除中...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SS_MAIN,
      requestBody: { requests: [{ deleteSheet: { sheetId: existingGid } }] }
    });
  }

  console.log(`➕ 新規シート "${NEW_SHEET_TITLE}" を作成中...`);
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SS_MAIN,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: NEW_SHEET_TITLE,
            gridProperties: { rowCount: 120, columnCount: 20 },
            tabColor: { red: 0.2, green: 0.6, blue: 0.9 }
          }
        }
      }]
    }
  });
  const newGid = addRes.data.replies[0].addSheet.properties.sheetId;
  console.log(`✅ シート作成完了 (gid=${newGid})`);

  // ── 4. ヘッダーセクション（独自）を先頭に追加 ──
  const headerSection = [
    ['MOMENT 2026 — エントランス スタッフ管理表', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['元データ: エントランス管理SS / スタッフ管理表シート', '', '', '', '', '', '', '', '', '最終更新: 2026-06-29', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ];

  // データ行：空行も含めて取り込み、ヘッダー行(行2,3)とデータ行(行4以降)を整形
  // 元の構造: 行1=空, 行2=列名, 行3=サブ列名, 行4〜=データ
  const cleanRows = entRows.map(row => {
    // 最大15列に揃える
    const padded = [...row];
    while (padded.length < 15) padded.push('');
    return padded.slice(0, 15);
  });

  const allData = [...headerSection, ...cleanRows];

  // ── 5. データ書き込み ──
  await sheets.spreadsheets.values.update({
    spreadsheetId: SS_MAIN,
    range: `'${NEW_SHEET_TITLE}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: allData }
  });
  console.log(`✅ ${allData.length}行 書き込み完了`);

  // ── 6. 書式設定 ──
  const lastRow = allData.length;
  const lastCol = 15;

  const formatRequests = [
    // タイトル行（行1）
    {
      repeatCell: {
        range: { sheetId: newGid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: lastCol },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.1, green: 0.4, blue: 0.8 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 12 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    // サブタイトル行（行2）
    {
      repeatCell: {
        range: { sheetId: newGid, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: lastCol },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.8, green: 0.88, blue: 0.97 },
            textFormat: { fontSize: 9 },
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)'
      }
    },
    // 元データ列名行（行5 = headerSection 3行 + entRows行1(空) + entRows行2(列名) = index4）
    {
      repeatCell: {
        range: { sheetId: newGid, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: lastCol },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.2, green: 0.5, blue: 0.8 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 9 },
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)'
      }
    },
    // データ行全体
    {
      repeatCell: {
        range: { sheetId: newGid, startRowIndex: 5, endRowIndex: lastRow, startColumnIndex: 0, endColumnIndex: lastCol },
        cell: {
          userEnteredFormat: {
            verticalAlignment: 'MIDDLE',
            textFormat: { fontSize: 9 },
            wrapStrategy: 'WRAP'
          }
        },
        fields: 'userEnteredFormat(verticalAlignment,textFormat,wrapStrategy)'
      }
    },
    // 罫線（行5以降のデータ部分）
    {
      updateBorders: {
        range: { sheetId: newGid, startRowIndex: 4, endRowIndex: lastRow, startColumnIndex: 0, endColumnIndex: lastCol },
        top:    { style: 'SOLID', width: 1, color: { red: 0.7, green: 0.7, blue: 0.7 } },
        bottom: { style: 'SOLID', width: 1, color: { red: 0.7, green: 0.7, blue: 0.7 } },
        left:   { style: 'SOLID', width: 1, color: { red: 0.7, green: 0.7, blue: 0.7 } },
        right:  { style: 'SOLID', width: 1, color: { red: 0.7, green: 0.7, blue: 0.7 } },
        innerHorizontal: { style: 'SOLID', width: 1, color: { red: 0.85, green: 0.85, blue: 0.85 } },
        innerVertical:   { style: 'SOLID', width: 1, color: { red: 0.85, green: 0.85, blue: 0.85 } },
      }
    },
    // 列幅
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 30  }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 60  }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 100 }, fields: 'pixelSize' } }, // 担当
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 130 }, fields: 'pixelSize' } }, // 所属
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 130 }, fields: 'pixelSize' } }, // 氏名
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'COLUMNS', startIndex: 5, endIndex: 6 }, properties: { pixelSize: 110 }, fields: 'pixelSize' } }, // 電話
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 }, properties: { pixelSize: 50  }, fields: 'pixelSize' } }, // 人数
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'COLUMNS', startIndex: 7, endIndex: 8 }, properties: { pixelSize: 50  }, fields: 'pixelSize' } }, // 車両
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'COLUMNS', startIndex: 8, endIndex: 9 }, properties: { pixelSize: 90  }, fields: 'pixelSize' } }, // IN
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'COLUMNS', startIndex: 9, endIndex: 10}, properties: { pixelSize: 90  }, fields: 'pixelSize' } }, // OUT
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'COLUMNS', startIndex:10, endIndex: 11}, properties: { pixelSize: 200 }, fields: 'pixelSize' } }, // 備考
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'COLUMNS', startIndex:11, endIndex: 15}, properties: { pixelSize: 70  }, fields: 'pixelSize' } }, // 食事申請列
    // 行高
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 35 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'ROWS', startIndex: 1, endIndex: 4 }, properties: { pixelSize: 20 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: newGid, dimension: 'ROWS', startIndex: 4, endIndex: lastRow }, properties: { pixelSize: 42 }, fields: 'pixelSize' } },
    // 先頭5行固定
    { updateSheetProperties: { properties: { sheetId: newGid, gridProperties: { frozenRowCount: 5 } }, fields: 'gridProperties.frozenRowCount' } },
    // タイトルセル結合（行1, A〜O）
    { mergeCells: { range: { sheetId: newGid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: lastCol }, mergeType: 'MERGE_ALL' } },
    { mergeCells: { range: { sheetId: newGid, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 9 }, mergeType: 'MERGE_ALL' } },
  ];

  // 担当部署別の色分け（C列=index2に値がある行）
  const deptColors = {
    '主催': { red: 1.0, green: 0.9, blue: 0.9 },
    '本部': { red: 1.0, green: 0.95, blue: 0.8 },
    'エントランス': { red: 0.9, green: 1.0, blue: 0.9 },
    '音響': { red: 0.9, green: 0.9, blue: 1.0 },
    '照明': { red: 0.95, green: 0.9, blue: 1.0 },
    '装飾': { red: 1.0, green: 0.95, blue: 1.0 },
    '楽器': { red: 0.9, green: 0.95, blue: 1.0 },
    'カメラ': { red: 0.95, green: 1.0, blue: 0.95 },
  };

  // headerSection(3) + entRows行1(空, index3) + entRows行2(列名, index4) → データ開始はindex5
  allData.forEach((row, i) => {
    if (i < 5) return;
    const dept = row[2] || '';
    let bg = null;
    for (const [key, color] of Object.entries(deptColors)) {
      if (dept.includes(key)) { bg = color; break; }
    }
    if (bg) {
      formatRequests.push({
        repeatCell: {
          range: { sheetId: newGid, startRowIndex: i, endRowIndex: i + 1, startColumnIndex: 0, endColumnIndex: lastCol },
          cell: { userEnteredFormat: { backgroundColor: bg } },
          fields: 'userEnteredFormat.backgroundColor'
        }
      });
    }
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SS_MAIN,
    requestBody: { requests: formatRequests }
  });
  console.log('✅ 書式設定完了');

  // ── 7. サマリー ──
  let totalPax = 0, totalCar = 0;
  entRows.slice(3).forEach(row => {
    totalPax += parseInt(String(row[6] || '').replace(/[^0-9]/g, '')) || 0;
    totalCar += parseInt(String(row[7] || '').replace(/[^0-9]/g, '')) || 0;
  });
  console.log(`\n📊 サマリー:`);
  console.log(`  スタッフ合計: ${totalPax}名`);
  console.log(`  車両合計: ${totalCar}台`);
  console.log('\n🎉 エントランス スタッフ管理表 同期完了！');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
