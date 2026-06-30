/**
 * MOMENT 2026 — 工程表 抜け作業 一括追加
 * 確定情報から漏れていた業者入り・撮影・オペレーション・撤収等を追加
 */

const { google } = require('googleapis');
const path = require('path');
const KEY_FILE = path.join(process.env.USERPROFILE, 'Downloads', 'moment-task-2026-7b2d2abfb7e6.json');
const SS_MAIN = '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY';
const SCOPES  = ['https://www.googleapis.com/auth/spreadsheets'];

// ── 追加する行データ（日付キー別）──
// [時刻, 作業内容, 必要人数, 備考, 重要度]
const NEW_ROWS = {
  '6/29': [
    ['14:00〜', '🚛 コテラナオキ 摂津倉庫 MOMENT備品 搬入', '', '4t冷凍+軽冷凍 / 倉庫備品を会場へ搬送', '🔴 高'],
    ['夜', '🎨 ZIGN / 中村則夫（デコ）搬入・会場入り', '8名・3台', '月曜夜入り → 翌日から設置作業', '🟡 中'],
  ],
  '6/30': [
    ['5:00', '💡 細野瑠璃子（電飾演出）搬入・設置開始', '3名・1台', '早朝入り', '🟡 中'],
    ['9:00頃', '🎨 oleoreo（デコ）搬入・設置', '約10名・5台', '3tトラック1台あり', '🟡 中'],
    ['9:00頃', '🎨 Samaya Design / 田中エティエンヌ（デコ）搬入・設置', '8名・3〜4台', '', '🟡 中'],
    ['10:00', '⛺ STRETCH TENT 設置（岩城真人）', '3名・2台', '', '🟡 中'],
  ],
  '7/1': [
    ['9:00頃', '🔊 S.O.L / 小野ユウスケ（音響）搬入・設置', '5名・2tワイド+軽トラ', '', '🔴 高'],
    ['13:00頃', '🚛 TIP ウタリ / たくま（搬入）', '4名・ハイエース+4t', '', '🟡 中'],
    ['18:00', '💡 SENCE OF WONDER / ヤマワキシュウヘイ（照明・レーザー）搬入', '4名・2台', '', '🔴 高'],
    ['20:00', '⚡ 株式会社VERY / 田中（電気設備）搬入', '8名・4台', '設営8名 / イベント中待機3〜4名 / 撤去5名', '🔴 高'],
    ['夜', '💡 後藤拓己 / KAMADEN（街灯照明）搬入・設置', '5名・2台', '', '🟡 中'],
  ],
  '7/2': [
    ['12:00', '📷 濵田隆史（カメラマン）入り', '1名', '', '🟢 低'],
    ['16:00', '📷 Maya Saito / MAYADESU（カメラマン）入り', '1名・1台', '', '🟢 低'],
    ['16:00', '🎬 CRACKWORKS / モリグチハルキ（VJ）入り', '2名・1台', '', '🟡 中'],
  ],
  '7/3': [
    ['0:00〜6:00', '🚫 アルコール販売禁止時間（奈良県警指導）', '全スタッフ周知', '7/3〜7/5 毎日 0:00〜6:00 販売禁止 / 全出店・販売担当に徹底', '🔴 高'],
    ['8:30', '🛡️ 青木陽平（全日本警備保障）集合・警備配置', '警備5名', '', '🔴 高'],
    ['11:00', '🎙️ Joshua SW（舞台監督）集合', '1名', '〜7/6 13:00まで', '🔴 高'],
  ],
  '7/4': [
    ['9:00', '🚪 ゲートオープン', '3名', 'エントランス担当', '🔴 高'],
    ['11:00', '🎶 タイムテーブル スタート！', '全体', '', '🔴 高'],
  ],
  '7/5': [
    ['9:00', '🚪 ゲートオープン', '3名', 'エントランス担当', '🔴 高'],
    ['10:00', '🎶 タイムテーブル スタート！', '全体', '', '🔴 高'],
    ['18:00', '🎵 音楽終了 → After パーティー スタート（〜24:00）', '全体', '', '🟡 中'],
  ],
  '7/6': [
    ['13:00', '🛍️ 出店 撤収開始', '', '各出店者が自主撤収', '🟡 中'],
    ['13:00', '🎙️ Joshua SW（舞台監督）出発', '1名', '', '🟢 低'],
  ],
};

// 7/7・7/8 の新規日付ブロック（最後に append）
const NEW_DAY_BLOCKS = [
  {
    header: '  7/7（火）  📦撤収  撤収 Day 2',
    rows: [
      ['終日', '📦 撤収作業 継続（音響・照明・テント等）', '在場スタッフ全員', '', '🔴 高'],
    ]
  },
  {
    header: '  7/8（水）  📦撤収  撤収 Day 3（最終）',
    rows: [
      ['午前中', '📦 撤収完了・最終清掃・退場', '在場スタッフ全員', '〜午前中に完了', '🔴 高'],
    ]
  },
];

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── シートメタ取得 ──
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SS_MAIN });
  const sheetTitle = meta.data.sheets.map(s => s.properties.title).find(t => t.includes('MOMENT設営') && t.includes('工程'));
  const gid = meta.data.sheets.find(s => s.properties.title === sheetTitle).properties.sheetId;
  console.log('対象シート:', sheetTitle, '(gid=' + gid + ')');

  // ── 現在の全行読み込み ──
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: SS_MAIN,
    range: "'" + sheetTitle + "'!A1:F120",
    valueRenderOption: 'FORMATTED_VALUE'
  });
  let rows = cur.data.values || [];
  console.log('現在の行数:', rows.length);

  // ── ① 7/3 の 15:00 → 14:00 修正 ──
  const fixIdx = rows.findIndex(r => r.join(' ').includes('15:00') && r.join(' ').includes('タイムテーブル'));
  if (fixIdx >= 0) {
    console.log('\n🔧 7/3 タイムテーブル開始時刻を 15:00 → 14:00 に修正...');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SS_MAIN,
      range: "'" + sheetTitle + "'!A" + (fixIdx + 1),
      valueInputOption: 'RAW',
      requestBody: { values: [['14:00']] }
    });
    console.log('  ✅ 行' + (fixIdx + 1) + ' 修正完了');
    await delay(300);
  } else {
    console.log('\n⚠️ タイムテーブル行(15:00)が見つかりませんでした');
  }

  // ── ② 日付ヘッダー行インデックスを取得（再読み込み）──
  const fresh = await sheets.spreadsheets.values.get({
    spreadsheetId: SS_MAIN,
    range: "'" + sheetTitle + "'!A1:F120",
    valueRenderOption: 'FORMATTED_VALUE'
  });
  rows = fresh.data.values || [];

  // 各日のヘッダー行(0-indexed)と、その日のセクション終端(次の日ヘッダーの手前の空行か次の日ヘッダー直前)を特定
  const dayPattern = {
    '6/29': null, '6/30': null, '7/1': null, '7/2': null,
    '7/3': null,  '7/4': null,  '7/5': null,  '7/6': null
  };
  rows.forEach((row, i) => {
    const t = row.join(' ');
    if (t.includes('6/29') && t.includes('Day 1')) dayPattern['6/29'] = i;
    if (t.includes('6/30') && t.includes('Day 2')) dayPattern['6/30'] = i;
    if (t.includes('7/1')  && t.includes('Day 3')) dayPattern['7/1']  = i;
    if (t.includes('7/2')  && t.includes('Day 4')) dayPattern['7/2']  = i;
    if (t.includes('7/3')  && t.includes('本番')  && t.includes('Day 1')) dayPattern['7/3'] = i;
    if (t.includes('7/4')  && t.includes('本番')  && t.includes('Day 2')) dayPattern['7/4'] = i;
    if (t.includes('7/5')  && t.includes('本番')  && t.includes('Day 3')) dayPattern['7/5'] = i;
    if (t.includes('7/6')  && t.includes('撤収'))  dayPattern['7/6']  = i;
  });
  console.log('\n📍 日付ヘッダー行 (0-indexed):', dayPattern);

  // 各日の「挿入先」= 次の日ヘッダーの1行前（空行）か、なければ次の日ヘッダー直前
  function getSectionEnd(dayKey) {
    const keys = Object.keys(dayPattern);
    const idx = keys.indexOf(dayKey);
    const headerRow = dayPattern[dayKey];
    if (headerRow === null) return null;
    // 次のヘッダー行を探す
    const nextDays = keys.slice(idx + 1).map(k => dayPattern[k]).filter(v => v !== null);
    const nextHeader = nextDays.length > 0 ? Math.min(...nextDays) : rows.length;
    // ヘッダーとnextHeaderの間で、後ろから空行を探す
    for (let i = nextHeader - 1; i > headerRow; i--) {
      if (!rows[i] || !rows[i].some(c => c && c.trim())) return i; // 空行の直前に挿入
    }
    return nextHeader - 1;
  }

  // ── ③ 各日に行を挿入（下から順に）──
  const dayOrder = ['7/6', '7/5', '7/4', '7/3', '7/2', '7/1', '6/30', '6/29'];
  let totalAdded = 0;

  for (const dayKey of dayOrder) {
    const newRows = NEW_ROWS[dayKey];
    if (!newRows || newRows.length === 0) continue;
    const endIdx = getSectionEnd(dayKey);
    if (endIdx === null) {
      console.log('⚠️  ' + dayKey + ': ヘッダー行なし → スキップ');
      continue;
    }
    const insertAt = endIdx; // 0-indexed, 空行の位置に挿入（空行を後ろにずらす）

    // 行を挿入
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SS_MAIN,
      requestBody: { requests: [{
        insertDimension: {
          range: { sheetId: gid, dimension: 'ROWS', startIndex: insertAt, endIndex: insertAt + newRows.length },
          inheritFromBefore: true
        }
      }]}
    });
    await delay(300);

    // データ書き込み
    await sheets.spreadsheets.values.update({
      spreadsheetId: SS_MAIN,
      range: "'" + sheetTitle + "'!A" + (insertAt + 1) + ':E' + (insertAt + newRows.length),
      valueInputOption: 'RAW',
      requestBody: { values: newRows }
    });
    await delay(300);

    console.log('✅ ' + dayKey + ': ' + newRows.length + '行 追加 → 行' + (insertAt + 1) + '〜' + (insertAt + newRows.length));
    newRows.forEach(r => console.log('   ' + r[0] + ' | ' + r[1]));
    totalAdded += newRows.length;
  }

  // ── ④ 7/7・7/8 を末尾に追加 ──
  console.log('\n➕ 7/7・7/8 撤収日を末尾に追加中...');
  const freshRows2 = (await sheets.spreadsheets.values.get({
    spreadsheetId: SS_MAIN,
    range: "'" + sheetTitle + "'!A1:F150",
    valueRenderOption: 'FORMATTED_VALUE'
  })).data.values || [];

  let appendAt = freshRows2.length; // 末尾に追加

  for (const block of NEW_DAY_BLOCKS) {
    const blockRows = [
      ['', '', '', '', ''], // 空行
      [block.header, '', '', '', ''], // 日付ヘッダー
      ...block.rows
    ];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SS_MAIN,
      requestBody: { requests: [{
        insertDimension: {
          range: { sheetId: gid, dimension: 'ROWS', startIndex: appendAt, endIndex: appendAt + blockRows.length },
          inheritFromBefore: false
        }
      }]}
    });
    await delay(300);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SS_MAIN,
      range: "'" + sheetTitle + "'!A" + (appendAt + 1) + ':E' + (appendAt + blockRows.length),
      valueInputOption: 'RAW',
      requestBody: { values: blockRows }
    });
    await delay(300);

    // ヘッダー行に書式（グレー背景）
    const headerRowIdx = appendAt + 1; // 空行の次
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SS_MAIN,
      requestBody: { requests: [{
        repeatCell: {
          range: { sheetId: gid, startRowIndex: headerRowIdx, endRowIndex: headerRowIdx + 1, startColumnIndex: 0, endColumnIndex: 6 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.4, green: 0.4, blue: 0.4 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)'
        }
      }]}
    });
    await delay(300);

    console.log('✅ ' + block.header.trim() + ': ' + block.rows.length + '行追加');
    appendAt += blockRows.length;
    totalAdded += block.rows.length;
  }

  console.log('\n🎉 完了！合計 ' + totalAdded + '行 追加、タイムテーブル時刻修正1件');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
