/**
 * MOMENT 2026 — ボランティア+設営スタッフ 全日程 賄い食数集計
 * ================================================================
 * ① ボランティア回答SS(シート3) から全回答者の在場期間を取得
 * ② 設営・撤収コアスタッフ（LINEで収集）を手動追加
 * ③ 6/29〜7/7 の全食事のボランティア在場数を集計
 * ④ 工程表SS 🍽️ 賄い 食数管理 のD列に書き込む
 */

const { google } = require('googleapis');
const path = require('path');

const KEY_FILE  = path.join(process.env.USERPROFILE, 'Downloads', 'moment-task-2026-7b2d2abfb7e6.json');
const SS_MAIN   = '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY'; // 工程表
const SS_VOL    = '1tVEmUOELKBQTkDGew6jRmWaqqlCLwz61wIvRCKFuF_Q'; // ボランティア回答
const SCOPES    = ['https://www.googleapis.com/auth/spreadsheets'];

// ──────────────────────────────────────────────────
// Google Sheets シリアル値早見表（2026年）
//   46201=6/29, 46202=6/30, 46203=7/1, 46204=7/2
//   46206=7/3,  46207=7/4,  46208=7/5, 46209=7/6, 46210=7/7
// 時刻小数: 0.333=8:00, 0.5=12:00, 0.583=14:00, 0.708=17:00, 0.75=18:00
// ──────────────────────────────────────────────────

// 各食事の定義 [シリアル(食事時刻), ラベル, 賄いシート行マッチキー]
const MEAL_DEFS = [
  // 設営期間
  { s: 46201 + 12/24, label: '6/29 昼食', keys: ['6/29', '昼食'] },
  { s: 46201 + 18/24, label: '6/29 夕食', keys: ['6/29', '夕食'] },
  { s: 46202 +  8/24, label: '6/30 朝食', keys: ['6/30', '朝食'] },
  { s: 46202 + 12/24, label: '6/30 昼食', keys: ['6/30', '昼食'] },
  { s: 46202 + 18/24, label: '6/30 夕食', keys: ['6/30', '夕食'] },
  { s: 46203 +  8/24, label: '7/1 朝食',  keys: ['7/1',  '朝食'] },
  { s: 46203 + 12/24, label: '7/1 昼食',  keys: ['7/1',  '昼食'] },
  { s: 46203 + 18/24, label: '7/1 夕食',  keys: ['7/1',  '夕食'] },
  { s: 46204 +  8/24, label: '7/2 朝食',  keys: ['7/2',  '朝食'] },
  { s: 46204 + 12/24, label: '7/2 昼食',  keys: ['7/2',  '昼食'] },
  { s: 46204 + 18/24, label: '7/2 夕食',  keys: ['7/2',  '夕食'] },
  // 本番
  { s: 46206 + 12/24, label: '7/3 昼食',  keys: ['7/3',  '昼食'] },
  { s: 46206 + 18/24, label: '7/3 夕食',  keys: ['7/3',  '夕食'] },
  { s: 46207 +  8/24, label: '7/4 朝食',  keys: ['7/4',  '朝食'] },
  { s: 46207 + 12/24, label: '7/4 昼食',  keys: ['7/4',  '昼食'] },
  { s: 46207 + 18/24, label: '7/4 夕食',  keys: ['7/4',  '夕食'] },
  { s: 46208 +  8/24, label: '7/5 朝食',  keys: ['7/5',  '朝食'] },
  { s: 46208 + 12/24, label: '7/5 昼食',  keys: ['7/5',  '昼食'] },
  { s: 46208 + 18/24, label: '7/5 夕食',  keys: ['7/5',  '夕食'] },
  { s: 46209 +  8/24, label: '7/6 朝食',  keys: ['7/6',  '朝食'] },
  { s: 46209 + 12/24, label: '7/6 昼食',  keys: ['7/6',  '昼食'] },
  { s: 46210 +  8/24, label: '7/7 朝食',  keys: ['7/7',  '朝食'] },
];

// ──────────────────────────────────────────────────
// 設営・撤収 コアスタッフ（LINEから手動入力）
// [arrivalSerial, departureSerial]
// 時刻: 午前=10:00(0.417), 昼=12:00(0.5), 午後=14:00(0.583),
//       夕方=17:00(0.708), 夜=21:00(0.875)
// 撤収終了: 7/7 18:00 = 46210.75 で統一（不明な場合）
// ──────────────────────────────────────────────────
const SETUP_STAFF = [
  // 名前,               到着シリアル,              出発シリアル
  { name: '伊藤楽',        arr: 46202 + 10/24,  dep: 46210 + 18/24 }, // 6/30 午前〜7/7夜
  { name: '藤本ゆうま',    arr: 46203 + 12/24,  dep: 46210 + 18/24 }, // 7/1 昼〜
  { name: '竹内亮平',      arr: 46202 + 17/24,  dep: 46210 + 18/24 }, // 6/30 夕方〜
  { name: '中井大輔',      arr: 46201 + 18/24,  dep: 46210 + 18/24 }, // 6/29 夕方〜(摂津積み込み後)
  { name: '阪口愛',        arr: 46202 + 10/24,  dep: 46210 + 18/24 }, // 6/30 午前〜
  { name: 'ペインジェイミー', arr: 46204 + 4/24, dep: 46210 + 18/24 }, // 7/2 早朝〜(7/1夜到着)
  { name: '赤羽椿',        arr: 46202 + 10/24,  dep: 46210 + 18/24 }, // 6/30 午前〜
  { name: 'キムマユ',      arr: 46202 + 14/24,  dep: 46210 + 18/24 }, // 6/30 午後〜
  { name: 'ゼインコステロ', arr: 46202 + 14/24, dep: 46210 + 18/24 }, // 6/30 午後〜
  { name: '新田ユウネ',    arr: 46202 + 10/24,  dep: 46210 + 18/24 }, // 6/30 午前〜
  { name: 'つづきけいすけ', arr: 46201 + 18/24, dep: 46210 + 18/24 }, // 6/29 夕方〜(摂津積み込み後)
  { name: 'サトウコウト',  arr: 46202 + 14/24,  dep: 46210 + 18/24 }, // 6/30 午後〜
  { name: '仲道たいが',    arr: 46202 + 10/24,  dep: 46210 + 18/24 }, // 6/30 午前〜
  { name: '福原ゆうと',    arr: 46202 + 10/24,  dep: 46210 + 18/24 }, // 6/30 午前〜
  { name: '望月定',        arr: 46202 + 17/24,  dep: 46210 + 18/24 }, // 6/30 夕方〜
  { name: '佐川姫華',      arr: 46202 + 17/24,  dep: 46210 + 18/24 }, // 6/30 夕方〜
  { name: '南城祐介',      arr: 46202 + 10/24,  dep: 46210 + 18/24 }, // 6/30 午前〜
  { name: '溝口良平',      arr: 46202 + 14/24,  dep: 46210 + 18/24 }, // 6/30 午後〜
];

// 時刻文字列 → 小数
function timeStrToFrac(val) {
  if (typeof val === 'number') return val;
  if (!val || val === '?' || val === '') return null;
  const s = String(val).trim();
  const m = s.match(/(\d{1,2})[:\時](\d{0,2})/);
  if (m) return (parseInt(m[1]) * 60 + parseInt(m[2] || '0')) / 1440;
  return null;
}

// 日付文字列 → シリアル（"2026/07/03" → 46206）
// ※ 実際はUNFORMATTED取得なので数値で来るはず
function parseDateSerial(val) {
  if (typeof val === 'number') return val;
  return null;
}

async function main() {
  console.log('🔑 認証中...');
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. ボランティア回答SS シート3 から R〜U列取得 ──
  const volRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SS_VOL,
    range: "'シート3'!R2:U",
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const volRows = volRes.data.values || [];
  console.log(`📝 ボランティア回答数: ${volRows.length}件`);

  // ── 2. 全在場者リストを構築（ボランティア + 設営スタッフ）──
  const attendees = [];

  // ボランティアフォーム回答（R=到着日serial, S=到着時間frac, T=出発日serial, U=出発時間frac/str）
  let skipped = 0;
  volRows.forEach((row, idx) => {
    const arrDateS = row[0];
    const arrTimeV = row[1];
    const depDateS = row[2];
    const depTimeV = row[3];

    if (typeof arrDateS !== 'number' || typeof depDateS !== 'number') { skipped++; return; }
    // 有効範囲: 6/20(46193)〜7/15(46218) — 期間外は入力ミスとして除外
    if (arrDateS < 46193 || depDateS > 46218) { skipped++; return; }

    const arrTimeFrac = timeStrToFrac(arrTimeV);
    const depTimeFrac = timeStrToFrac(depTimeV);

    attendees.push({
      arr: arrDateS + (arrTimeFrac !== null ? arrTimeFrac : 0),
      dep: depDateS + (depTimeFrac !== null ? depTimeFrac : 23.9 / 24),
    });
  });
  console.log(`  → 有効: ${attendees.length}名, スキップ: ${skipped}件`);

  // 設営コアスタッフを追加
  SETUP_STAFF.forEach(s => attendees.push({ arr: s.arr, dep: s.dep, name: s.name }));
  console.log(`  → 設営スタッフ${SETUP_STAFF.length}名追加 / 合計: ${attendees.length}名`);

  // ── 3. 各食事の在場者数を集計 ──
  console.log('\n🍽️  食数集計:');
  const results = MEAL_DEFS.map(meal => {
    const count = attendees.filter(a => a.arr <= meal.s && meal.s <= a.dep).length;
    console.log(`  ${meal.label}: ${count}名`);
    return { ...meal, count };
  });

  // ── 4. 賄いシートの行構造を取得 ──
  const mainMeta = await sheets.spreadsheets.get({ spreadsheetId: SS_MAIN });
  const mealSheetInfo = mainMeta.data.sheets
    .map(s => ({ id: s.properties.sheetId, title: s.properties.title }))
    .find(s => s.title.includes('賄い') && s.title.includes('食数'));

  if (!mealSheetInfo) { console.error('❌ 賄い食数管理シートが見つかりません'); process.exit(1); }
  console.log(`\n✅ 賄いシート: "${mealSheetInfo.title}"`);

  const mealRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SS_MAIN,
    range: `'${mealSheetInfo.title}'!A1:F80`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const mealRows = mealRes.data.values || [];

  // ── 5. D列の更新対象を特定して書き込み ──
  const updates = [];
  const notFound = [];

  results.forEach(meal => {
    let found = false;
    for (let i = 0; i < mealRows.length; i++) {
      const rowText = mealRows[i].join(' ');
      const hasDate = rowText.includes(meal.keys[0]);
      const hasType = rowText.includes(meal.keys[1]);
      if (hasDate && hasType) {
        updates.push({ range: `'${mealSheetInfo.title}'!D${i + 1}`, values: [[meal.count]] });
        console.log(`  ✏️  行${i+1} ${meal.label} → ${meal.count}名`);
        found = true;
        break;
      }
    }
    if (!found) notFound.push(meal.label);
  });

  if (notFound.length > 0) {
    console.log('\n⚠️  賄いシートに対応行なし:', notFound.join(', '));
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SS_MAIN,
      requestBody: { valueInputOption: 'RAW', data: updates },
    });
    console.log(`\n🎉 ${updates.length}セル更新完了！`);
  }

  // ── 6. 設営スタッフ 日別在場確認（デバッグ用） ──
  console.log('\n📅 設営スタッフ日別在場確認:');
  const checkDays = [
    { label: '6/29夕食', s: 46201 + 18/24 },
    { label: '6/30昼食', s: 46202 + 12/24 },
    { label: '6/30夕食', s: 46202 + 18/24 },
    { label: '7/1昼食',  s: 46203 + 12/24 },
    { label: '7/2昼食',  s: 46204 + 12/24 },
  ];
  checkDays.forEach(d => {
    const present = SETUP_STAFF.filter(s => s.arr <= d.s && d.s <= s.dep).map(s => s.name);
    console.log(`  ${d.label} (${present.length}名): ${present.join(', ')}`);
  });
}

main().catch(e => { console.error('❌ エラー:', e.message); process.exit(1); });
