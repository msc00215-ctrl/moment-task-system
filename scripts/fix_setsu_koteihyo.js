/**
 * 工程表の誤挿入行を削除して、正しいデータで再挿入
 * シリアル値修正: 6/29=46202, 6/30=46203, 7/1=46204, 7/2=46205
 * (7/3=46206, 7/2=46205 をフォームデータで確認済み)
 */

const { google } = require('googleapis');
const path = require('path');
const KEY_FILE = path.join(process.env.USERPROFILE, 'Downloads', 'moment-task-2026-7b2d2abfb7e6.json');
const SS_MAIN = '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY';
const SS_VOL  = '1tVEmUOELKBQTkDGew6jRmWaqqlCLwz61wIvRCKFuF_Q';
const SCOPES  = ['https://www.googleapis.com/auth/spreadsheets'];

// ── 正しいシリアル値 ──
// 7/3=46206, 7/2=46205, 7/1=46204, 6/30=46203, 6/29=46202, 6/28=46201
const SETUP_STAFF = [
  { name: '中井大輔',       arr: 46202 + 18/24, isCore: true,  note: '摂津積み込みから（14:00発→夜入り）' },
  { name: 'つづきけいすけ', arr: 46202 + 18/24, isCore: false, note: '摂津積み込みから（14:00発→夜入り）' },
  { name: '伊藤楽',         arr: 46203 + 10/24, isCore: false, note: 'ゼインコステロと車 午前中' },
  { name: '阪口愛',         arr: 46203 + 10/24, isCore: true,  note: '南城祐介と車 午前' },
  { name: '赤羽椿',         arr: 46203 + 10/24, isCore: false, note: '公共交通機関 午前' },
  { name: '新田ユウネ',     arr: 46203 + 10/24, isCore: false, note: '車 午前' },
  { name: '仲道たいが',     arr: 46203 + 10/24, isCore: true,  note: '福原ゆうとと車 午前' },
  { name: '福原ゆうと',     arr: 46203 + 10/24, isCore: true,  note: '仲道たいがと車 午前' },
  { name: '南城祐介',       arr: 46203 + 10/24, isCore: true,  note: '阪口愛と車 午前' },
  { name: 'キムマユ',       arr: 46203 + 14/24, isCore: false, note: '溝口良平と車 午後' },
  { name: 'ゼインコステロ', arr: 46203 + 14/24, isCore: false, note: '伊藤楽達と車 午後' },
  { name: 'サトウコウト',   arr: 46203 + 14/24, isCore: false, note: '午後' },
  { name: '溝口良平',       arr: 46203 + 14/24, isCore: false, note: 'キムマユと車 午後' },
  { name: '竹内亮平',       arr: 46203 + 17/24, isCore: false, note: '公共交通機関 夕方' },
  { name: '望月定',         arr: 46203 + 17/24, isCore: false, note: '公共交通機関 夕方' },
  { name: '佐川姫華',       arr: 46203 + 17/24, isCore: false, note: '公共交通機関 夕方' },
  { name: '藤本ゆうま',     arr: 46204 + 12/24, isCore: false, note: '公共交通機関 昼〜夕方' },
  { name: 'ペインジェイミー', arr: 46205 + 4/24, isCore: false, note: 'エデン・セイジ・しおりと車 7/1夜着→7/2早朝' },
];

function serialToMD(s) {
  // 正確な変換: UTCで計算
  const d = new Date(Math.round((s - 25569) * 86400000));
  return `${d.getUTCMonth()+1}/${d.getUTCDate()}`;
}

function hourToStr(h) { return `${h}:00`; }

function groupArrivals() {
  const groups = {};
  SETUP_STAFF.forEach(s => {
    const day  = Math.floor(s.arr);
    const hour = Math.round((s.arr - day) * 24);
    const key  = `${day}_${hour}`;
    if (!groups[key]) groups[key] = { day, hour, members: [], hasCore: false };
    groups[key].members.push(s);
    if (s.isCore) groups[key].hasCore = true;
  });
  return Object.values(groups).sort((a,b) => a.day !== b.day ? a.day - b.day : a.hour - b.hour);
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SS_MAIN });
  const sheetMap = {};
  meta.data.sheets.forEach(s => { sheetMap[s.properties.title] = s.properties.sheetId; });
  const title = '🟢 MOMENT設営 工程表';
  const gid   = sheetMap[title];

  // ── ① 既存の👥行を削除（下から削除してインデックスずれを防ぐ）──
  console.log('🗑️  既存の誤挿入行を確認中...');
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: SS_MAIN,
    range: `'${title}'!A1:F60`,
    valueRenderOption: 'FORMATTED_VALUE'
  });
  const rows = cur.data.values || [];

  const deleteIdxs = [];
  rows.forEach((row, i) => {
    if (row.join(' ').includes('👥〈スタッフ入り〉')) deleteIdxs.push(i);
  });
  console.log(`  削除対象行: ${deleteIdxs.map(i => i+1).join(', ')} (${deleteIdxs.length}件)`);

  // 下から順に削除
  for (const idx of [...deleteIdxs].reverse()) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SS_MAIN,
      requestBody: { requests: [{
        deleteDimension: {
          range: { sheetId: gid, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 }
        }
      }]}
    });
  }
  console.log(`✅ ${deleteIdxs.length}行削除完了`);

  // ── ② ボランティア設営日到着数を集計 ──
  const volRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SS_VOL,
    range: "'シート3'!R2:U",
    valueRenderOption: 'UNFORMATTED_VALUE'
  });
  const volRows = volRes.data.values || [];
  // 6/29=46202, 6/30=46203, 7/1=46204, 7/2=46205
  const volByDay = { 46202: 0, 46203: 0, 46204: 0, 46205: 0 };
  volRows.forEach(row => {
    const arrDate = row[0];
    if (typeof arrDate !== 'number') return;
    const d = Math.floor(arrDate);
    if (volByDay.hasOwnProperty(d)) volByDay[d]++;
  });
  console.log('\n📊 ボランティア設営日到着数:');
  Object.entries(volByDay).forEach(([s, c]) => console.log(`  ${serialToMD(parseInt(s))}: ${c}名`));

  // ── ③ 到着グループ作成 ──
  const groups = groupArrivals();
  let cum = 0;
  console.log('\n👥 到着グループ（修正済み）:');
  groups.forEach(g => {
    cum += g.members.length;
    console.log(`  ${serialToMD(g.day)} ${hourToStr(g.hour)}: +${g.members.length}名 (累計${cum}名) → ${g.members.map(m=>m.name).join('・')}`);
  });

  // ── ④ 日付ヘッダー位置を再取得（削除後）──
  const fresh = await sheets.spreadsheets.values.get({
    spreadsheetId: SS_MAIN,
    range: `'${title}'!A1:F40`,
    valueRenderOption: 'FORMATTED_VALUE'
  });
  const freshRows = fresh.data.values || [];

  const dayHeaders = {};
  freshRows.forEach((row, i) => {
    const t = row.join(' ');
    if (t.includes('6/29') && (t.includes('Day 1') || t.includes('設営'))) dayHeaders['6/29'] = i;
    if (t.includes('6/30') && t.includes('Day 2')) dayHeaders['6/30'] = i;
    if (t.includes('7/1')  && t.includes('Day 3')) dayHeaders['7/1']  = i;
    if (t.includes('7/2')  && t.includes('Day 4')) dayHeaders['7/2']  = i;
  });
  console.log('\n📍 日付ヘッダー行 (0-indexed):', dayHeaders);

  // ── ⑤ 挿入計画作成 ──
  let runCum = 0;
  let runVol = 0;
  const insertPlan = {}; // dayKey → [{hour, data[]}]

  groups.forEach(g => {
    runCum += g.members.length;
    const dayKey = serialToMD(g.day);
    const d = g.day;

    // 当日のボランティア在場数（その日の朝時点までの累計）
    if (d === 46203) runVol += volByDay[46202] || 0; // 6/30の作業時には6/29到着分も含む
    if (d === 46204) runVol += volByDay[46203] || 0;
    if (d === 46205) runVol += volByDay[46204] || 0;

    const coreNames   = g.members.filter(m => m.isCore).map(m => `⭐${m.name}`);
    const normalNames = g.members.filter(m => !m.isCore).map(m => m.name);
    const allNames    = [...coreNames, ...normalNames].join('・');
    const volNote     = runVol > 0 ? ` ／ ボランティア: ${runVol}名` : '';
    const noteDetail  = g.members.map(m => `${m.name}(${m.note})`).join(' ／ ');

    const row = [
      hourToStr(g.hour),
      `👥〈スタッフ入り〉 ${allNames}（${g.members.length}名）`,
      `在場計: ${runCum}名${volNote}`,
      noteDetail,
      g.hasCore ? '🔴 高' : '🟢 低'
    ];

    if (!insertPlan[dayKey]) insertPlan[dayKey] = [];
    insertPlan[dayKey].push({ hour: g.hour, data: row });
  });

  // ── ⑥ 下から順に挿入 ──
  const dayOrder = ['7/2', '7/1', '6/30', '6/29'];
  let totalIns = 0;

  for (const dayKey of dayOrder) {
    const plan = insertPlan[dayKey];
    if (!plan || !dayHeaders[dayKey]) {
      if (plan) console.log(`⚠️  ${dayKey}: ヘッダー行なし → スキップ`);
      continue;
    }

    const headerIdx  = dayHeaders[dayKey]; // 0-indexed
    const insertAt   = headerIdx + 1;      // ヘッダー直後
    const count      = plan.length;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SS_MAIN,
      requestBody: { requests: [{
        insertDimension: {
          range: { sheetId: gid, dimension: 'ROWS', startIndex: insertAt, endIndex: insertAt + count },
          inheritFromBefore: false
        }
      }]}
    });

    const writeData = plan.sort((a,b) => a.hour - b.hour).map(p => p.data);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SS_MAIN,
      range: `'${title}'!A${insertAt+1}:E${insertAt+count}`,
      valueInputOption: 'RAW',
      requestBody: { values: writeData }
    });

    console.log(`✅ ${dayKey}: ${count}行挿入 → 行${insertAt+1}〜${insertAt+count}`);
    writeData.forEach(r => console.log(`   ${r[0]} | ${r[1]} | ${r[2]}`));
    totalIns += count;
  }

  // ── ⑦ 在場人数サマリー ──
  console.log('\n📊 各作業時点での在場スタッフ数:');
  const volCum6_29 = volByDay[46202] || 0;
  const volCum6_30 = volCum6_29 + (volByDay[46203] || 0);
  const volCum7_1  = volCum6_30 + (volByDay[46204] || 0);
  const volCum7_2  = volCum7_1  + (volByDay[46205] || 0);

  const summary = [
    { time: '6/29 14:00 摂津積み込み', setup: 2,  vol: volCum6_29 },
    { time: '6/30 08:00 MMT備品荷下ろし', setup: 2,  vol: volCum6_29 },
    { time: '6/30 10:00〜 午前組到着後', setup: 9,  vol: volCum6_29 },
    { time: '6/30 13:00  焚き火テント作業', setup: 9,  vol: volCum6_29 },
    { time: '6/30 14:00〜 午後組到着後', setup: 13, vol: volCum6_29 },
    { time: '6/30 17:00〜 夕方組到着・全16名', setup: 16, vol: volCum6_30 },
    { time: '7/1  08:00 エントランス設営', setup: 16, vol: volCum6_30 },
    { time: '7/1  13:00 区画整理', setup: 17, vol: volCum7_1 },
    { time: '7/2  04:00〜 ペインJ到着・全18名', setup: 18, vol: volCum7_1 },
    { time: '7/2  08:00 清掃・倉庫収納', setup: 18, vol: volCum7_2 },
    { time: '7/2  14:00 全体再確認', setup: 18, vol: volCum7_2 },
  ];

  summary.forEach(s => {
    const total = s.setup + s.vol;
    console.log(`  ${s.time}: 設営${s.setup}名 + ボランティア${s.vol}名 = 計${total}名`);
  });

  console.log(`\n🎉 計${totalIns}行挿入完了！`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
