/**
 * MOMENT 2026 — 🛍️ 出店リスト 連携
 * 出店管理SS(出店管理表) → 工程表SS(🛍️ 出店リスト) に全データ反映
 * 列マッピング:
 *   出店管理表: No, MAP No, 出店名, 代表者名, 電話番号, 出展内容, 参加人数, 総車両台数, 販売内容, メール, ...
 *   工程表出店リスト: 店名 | カテゴリ | MAPNo | 担当者 | 電話番号 | 参加人数 | 車両台数 | メニュー・商品 | メール | 入金確認 | メモ
 */

const { google } = require('googleapis');
const path = require('path');
const KEY_FILE = path.join(process.env.USERPROFILE, 'Downloads', 'moment-task-2026-7b2d2abfb7e6.json');
const SS_MAIN = '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY';
const SS_SHOP = '1ULD9TcMRJDMF1k-I4CBJEX3M_DT2TRLohTQ-xugZTCA';
const SCOPES  = ['https://www.googleapis.com/auth/spreadsheets'];

// カテゴリ色分け
const CAT_COLORS = {
  '飲食': '#fff9c4',      // 黄
  'フード': '#fff9c4',
  '物販': '#e3f2fd',      // 青
  'クラフト': '#e8f5e9',  // 緑
  'アート': '#fce4ec',    // ピンク
  'その他': '#f5f5f5',
};

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. 出店管理表 全データ取得 ──
  console.log('📥 出店管理表 読み込み中...');
  const shopRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SS_SHOP,
    range: "'出店管理表'!A1:Z200",
    valueRenderOption: 'FORMATTED_VALUE'
  });
  const shopRows = shopRes.data.values || [];
  const header = shopRows[0];
  console.log('ヘッダー:', header.slice(0, 12).join(' | '));

  // ヘッダー列インデックス取得
  const col = (name) => header.findIndex(h => h.includes(name));
  const iNo       = col('No');
  const iMapNo    = col('MAP');
  const iName     = col('出店名');
  const iOwner    = col('代表者名');
  const iPhone    = col('電話');
  const iCat      = col('出展内容');
  const iPax      = col('参加人数');
  const iCar      = col('車両');
  const iMenu     = col('販売内容');
  const iMail     = col('メール');
  const iNyukin   = col('入金確認');
  const iMemo     = col('メモ');

  console.log(`列位置: No=${iNo} MAP=${iMapNo} 店名=${iName} 代表=${iOwner} 電話=${iPhone} カテゴリ=${iCat} 人数=${iPax} 車両=${iCar} 販売=${iMenu} mail=${iMail} 入金=${iNyukin} memo=${iMemo}`);

  // データ行（2行目以降）
  const dataRows = shopRows.slice(1).filter(r => r[iNo] && r[iName]);
  console.log(`\n📊 出店数: ${dataRows.length}件`);
  dataRows.slice(0, 3).forEach(r => console.log(`  ${r[iNo]}. [MAP${r[iMapNo]}] ${r[iName]} - ${r[iCat]} / ${r[iPax]}名 / ${r[iCar]}台`));
  console.log('  ...');

  // ── 2. 工程表SS の 🛍️ 出店リストシートを作成/更新 ──
  const mainMeta = await sheets.spreadsheets.get({ spreadsheetId: SS_MAIN });
  const sheetMap = {};
  mainMeta.data.sheets.forEach(s => { sheetMap[s.properties.title] = s.properties.sheetId; });

  const shopListTitle = Object.keys(sheetMap).find(t => t.includes('出店リスト'));
  if (!shopListTitle) { console.error('❌ 出店リストシートが見つかりません'); process.exit(1); }
  const shopListGid = sheetMap[shopListTitle];
  console.log(`\n✅ 書き込み先: "${shopListTitle}" (gid=${shopListGid})`);

  // ── 3. シートを全クリア → 新規書き込み ──
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SS_MAIN,
    range: `'${shopListTitle}'!A1:Z300`
  });

  // ── 4. ヘッダー行を作成 ──
  const newHeader = [
    'No', 'MAP No', '出店名', 'カテゴリ', '代表者名', '電話番号',
    '参加人数', '車両台数', '販売内容・メニュー', 'メール',
    '入金確認', 'メモ'
  ];

  // ── 5. データ行を作成 ──
  const newRows = dataRows.map(r => [
    r[iNo]    || '',
    r[iMapNo] || '',
    r[iName]  || '',
    r[iCat]   || '',
    r[iOwner] || '',
    r[iPhone] || '',
    r[iPax]   || '',
    r[iCar]   || '',
    r[iMenu]  || '',
    r[iMail]  || '',
    iNyukin >= 0 ? (r[iNyukin] || '') : '',
    iMemo    >= 0 ? (r[iMemo]   || '') : '',
  ]);

  const allData = [newHeader, ...newRows];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SS_MAIN,
    range: `'${shopListTitle}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: allData }
  });
  console.log(`✅ ${newRows.length}件 書き込み完了`);

  // ── 6. 書式設定（ヘッダー色、カテゴリ色、罫線）──
  const lastRow = allData.length;
  const lastCol = newHeader.length;

  const formatRequests = [
    // ヘッダー行: 濃い青背景・白文字・太字
    {
      repeatCell: {
        range: { sheetId: shopListGid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: lastCol },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.106, green: 0.369, blue: 0.702 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    // 全データ行: 縦方向中央揃え
    {
      repeatCell: {
        range: { sheetId: shopListGid, startRowIndex: 1, endRowIndex: lastRow, startColumnIndex: 0, endColumnIndex: lastCol },
        cell: {
          userEnteredFormat: {
            verticalAlignment: 'MIDDLE',
            textFormat: { fontSize: 9 }
          }
        },
        fields: 'userEnteredFormat(verticalAlignment,textFormat)'
      }
    },
    // 罫線（全範囲）
    {
      updateBorders: {
        range: { sheetId: shopListGid, startRowIndex: 0, endRowIndex: lastRow, startColumnIndex: 0, endColumnIndex: lastCol },
        top:    { style: 'SOLID', width: 1, color: { red: 0.7, green: 0.7, blue: 0.7 } },
        bottom: { style: 'SOLID', width: 1, color: { red: 0.7, green: 0.7, blue: 0.7 } },
        left:   { style: 'SOLID', width: 1, color: { red: 0.7, green: 0.7, blue: 0.7 } },
        right:  { style: 'SOLID', width: 1, color: { red: 0.7, green: 0.7, blue: 0.7 } },
        innerHorizontal: { style: 'SOLID', width: 1, color: { red: 0.85, green: 0.85, blue: 0.85 } },
        innerVertical:   { style: 'SOLID', width: 1, color: { red: 0.85, green: 0.85, blue: 0.85 } },
      }
    },
    // 列幅調整
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 40  }, fields: 'pixelSize' } }, // No
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 60  }, fields: 'pixelSize' } }, // MAP
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 160 }, fields: 'pixelSize' } }, // 出店名
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 70  }, fields: 'pixelSize' } }, // カテゴリ
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 120 }, fields: 'pixelSize' } }, // 代表者
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'COLUMNS', startIndex: 5, endIndex: 6 }, properties: { pixelSize: 110 }, fields: 'pixelSize' } }, // 電話
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 }, properties: { pixelSize: 60  }, fields: 'pixelSize' } }, // 人数
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'COLUMNS', startIndex: 7, endIndex: 8 }, properties: { pixelSize: 60  }, fields: 'pixelSize' } }, // 車両
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'COLUMNS', startIndex: 8, endIndex: 9 }, properties: { pixelSize: 220 }, fields: 'pixelSize' } }, // 販売内容
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'COLUMNS', startIndex: 9, endIndex: 10}, properties: { pixelSize: 180 }, fields: 'pixelSize' } }, // メール
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'COLUMNS', startIndex:10, endIndex: 11}, properties: { pixelSize: 80  }, fields: 'pixelSize' } }, // 入金
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'COLUMNS', startIndex:11, endIndex: 12}, properties: { pixelSize: 160 }, fields: 'pixelSize' } }, // メモ
    // 行高
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 30 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: shopListGid, dimension: 'ROWS', startIndex: 1, endIndex: lastRow }, properties: { pixelSize: 22 }, fields: 'pixelSize' } },
    // 先頭行固定
    { updateSheetProperties: { properties: { sheetId: shopListGid, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
  ];

  // カテゴリ別の背景色
  newRows.forEach((row, i) => {
    const cat = row[3] || '';
    let bg = null;
    if (cat.includes('飲食') || cat.includes('フード') || cat.includes('食')) bg = { red: 1.0, green: 0.98, blue: 0.8 };
    else if (cat.includes('物販') || cat.includes('ショップ')) bg = { red: 0.89, green: 0.95, blue: 1.0 };
    else if (cat.includes('クラフト') || cat.includes('アクセサリー') || cat.includes('アート')) bg = { red: 0.91, green: 0.97, blue: 0.91 };
    if (bg) {
      formatRequests.push({
        repeatCell: {
          range: { sheetId: shopListGid, startRowIndex: i + 1, endRowIndex: i + 2, startColumnIndex: 0, endColumnIndex: lastCol },
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

  // ── 7. 集計サマリー ──
  const catCount = {};
  let totalPax = 0, totalCar = 0;
  newRows.forEach(r => {
    const cat = r[3] || 'その他';
    catCount[cat] = (catCount[cat] || 0) + 1;
    totalPax += parseInt(String(r[6]).replace(/[^0-9]/g, '')) || 0;
    totalCar += parseInt(String(r[7]).replace(/[^0-9]/g, '')) || 0;
  });

  console.log('\n📊 出店集計:');
  console.log(`  総出店数: ${newRows.length}店`);
  Object.entries(catCount).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}店`));
  console.log(`  総参加人数: ${totalPax}名`);
  console.log(`  総車両台数: ${totalCar}台`);
  console.log('\n🎉 出店リスト連携完了！');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
