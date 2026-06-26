/**
 * MOMENT 2026 工程表 ── 完全版
 * ================================================
 * 【シート構成】
 * 1. 「📅 工程表_有給スタッフ」  ─ ギャラ発生スタッフ + ガントチャート
 * 2. 「📋 エントランス用_全チーム入り一覧」 ─ 全チームの日程・人数・車両・到着時刻
 *
 * 【使い方】
 * A) 全シート一括作成: メニュー「🎵 MOMENT 2026」→「全シート一括作成/更新」
 * B) 個別作成も可能
 *
 * 【対象スプレッドシートID】
 * 1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ
 *
 * ⚠️ 既存シートは一切変更・削除しない
 *    このスクリプトが作成したシートのみ再作成OK
 * ================================================
 */

const KOTEI_SS_ID     = '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ';
const KOTEI_SHEET_NAME = '📅 工程表_有給スタッフ';

// カラー定数
const KT = {
  NAVY:  '#0a1628',
  WHITE: '#ffffff',
  DEPT: {
    '設営':           '#fce4ec',
    '機材レンタル':   '#e3f2fd',
    '電源・電気工事': '#fff9c4',
    'BAR':            '#e1f5fe',
    '音響':           '#ede7f6',
  },
  GANTT: {
    '設営':           '#e53935',
    '機材レンタル':   '#1e88e5',
    '電源・電気工事': '#f9a825',
    'BAR':            '#00acc1',
    '音響':           '#8e24aa',
  },
  STATUS: {
    '確定':   '#c8e6c9',
    '確認中': '#fff9c4',
    '調整中': '#ffe0b2',
  },
};

// ── ギャラ発生スタッフデータ ──
// 列順: [部署, チーム/担当者, 役割・内容, 入り日時, アウト日時, 車両・備考, ギャラ条件, ステータス]
const PAID_STAFF_DATA = [
  [
    '設営',
    'Shinovi Creation\nhajime（ハギワラハジメ）\nタニシ（ニシタニショウ）',
    '設営全般・単管/テント製作・機材運搬',
    '6/30(火) 朝IN',
    '7/7(火) 午後OUT',
    '2Tロングアルミバン\n4T平トラック',
    '設営費（見積もり額）',
    '確定',
  ],
  [
    '機材レンタル',
    '西尾レントール\n担当: 妹尾真行あて',
    '機材搬入・管理・返却',
    '7/1(水) 9:00 搬入',
    '7/7(火) 11:00 返却',
    '業者手配車両',
    'レンタル費用（別途）',
    '確定',
  ],
  [
    '電源・電気工事',
    '後藤電気チーム',
    '電気工事全般・会場街灯設置',
    '7/2(木) 朝IN',
    '7/7(火)頃OUT',
    '業者車両',
    '電気工事費（別途）',
    '確定',
  ],
  [
    'BAR（最初の入り）',
    '🌞Hiroto Arai\n（BARマネージャー）\n※BAR一番乗り担当',
    'BAR設営統括・オペレーション管理',
    '7/2(木) 午前中IN\n冷凍車と合わせた入り',
    '7/5(日)以降OUT',
    '冷凍車（業者）と合わせて入り',
    'BAR売上（詳細非公開）',
    '確定',
  ],
  [
    '音響',
    '株式会社VERY\n代表: 田中',
    '音響システム・PA・ステージ電気工事',
    '7/2(木)頃IN\n※詳細確認中',
    '7/7(火)以降OUT',
    '4台 / 8名体制',
    'ギャラ（詳細調整中）',
    '確認中',
  ],
];

// ── ガントチャート: 日程定義 6/29(月)〜7/7(火) ──
const GANTT_DAYS = [
  { label: '6/29\n(月)',       type: 'setup'   },
  { label: '6/30\n(火)',       type: 'setup'   },
  { label: '7/1\n(水)',        type: 'setup'   },
  { label: '7/2\n(木)',        type: 'setup'   },
  { label: '7/3\n(金)\nDAY1', type: 'event'   },
  { label: '7/4\n(土)\nDAY2', type: 'event'   },
  { label: '7/5\n(日)\nDAY3', type: 'event'   },
  { label: '7/6\n(月)\n撤収', type: 'removal' },
  { label: '7/7\n(火)\n撤収', type: 'removal' },
];

// [開始index, 終了index] (GANTT_DAYS の0始まり、両端含む)
const GANTT_RANGES = [
  [1, 8],  // 設営 Shinovi:  6/30〜7/7
  [2, 8],  // 機材 西尾レントール: 7/1〜7/7
  [3, 8],  // 電源 後藤電気:  7/2〜7/7
  [3, 7],  // BAR ヒロト:    7/2〜7/6
  [3, 8],  // 音響 VERY:     7/2〜7/7
];

// ── メイン関数 ──
function setupKoteiHyoSheet() {
  const ss = SpreadsheetApp.openById(KOTEI_SS_ID);

  // 自作シートのみ削除して再作成（既存の他シートは一切触らない）
  const existing = ss.getSheetByName(KOTEI_SHEET_NAME);
  if (existing) ss.deleteSheet(existing);
  const sh = ss.insertSheet(KOTEI_SHEET_NAME);
  sh.setTabColor('#e65100');

  const N_DATA  = 8;                   // データテーブルの列数
  const N_DAYS  = GANTT_DAYS.length;   // 9日間
  const GCOL    = N_DATA + 1;          // ガント日付の開始列 (=9)
  const N_TOTAL = N_DATA + N_DAYS;     // 全列数 (=17)

  // ── タイトル ──
  sh.setRowHeight(1, 52);
  sh.getRange(1, 1, 1, N_TOTAL).merge()
    .setValue('📅 MOMENT 2026 工程表 ── ギャラ発生スタッフ入り情報')
    .setBackground(KT.NAVY).setFontColor(KT.WHITE)
    .setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  sh.setRowHeight(2, 28);
  sh.getRange(2, 1, 1, N_TOTAL).merge()
    .setValue('⚠️ ギャラが発生しているスタッフ・業者のみ記載 ／ BARスタッフは最初の入り担当者（ヒロト）のみ ／ 更新: ' +
      Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'))
    .setBackground('#fbe9e7').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  // ── データテーブル ヘッダー ──
  sh.setRowHeight(3, 36);
  const headers = ['部署', 'チーム / 担当者', '役割・担当内容', '入り日時', 'アウト日時', '車両', 'ギャラ条件', 'ステータス'];
  sh.getRange(3, 1, 1, N_DATA).setValues([headers])
    .setBackground(KT.NAVY).setFontColor(KT.WHITE).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setFrozenRows(3);

  // ── データ行 ──
  PAID_STAFF_DATA.forEach((row, i) => {
    const r = 4 + i;
    sh.setRowHeight(r, 62);
    sh.getRange(r, 1, 1, N_DATA).setValues([row])
      .setVerticalAlignment('middle').setWrap(true);

    const deptKey   = row[0].startsWith('BAR') ? 'BAR' : row[0];
    const deptColor = KT.DEPT[deptKey] || '#f5f5f5';
    sh.getRange(r, 1).setBackground(deptColor).setFontWeight('bold').setHorizontalAlignment('center');

    const statusColor = KT.STATUS[row[7]] || '#f5f5f5';
    sh.getRange(r, 8).setBackground(statusColor).setFontWeight('bold').setHorizontalAlignment('center');

    if (i % 2 === 1) {
      for (let c = 2; c <= 7; c++) sh.getRange(r, c).setBackground('#fafafa');
    }
  });

  sh.getRange(3, 1, 1 + PAID_STAFF_DATA.length, N_DATA)
    .setBorder(true, true, true, true, true, true);

  // ── ガントチャート セクション ──
  const GANTT_TOP = 4 + PAID_STAFF_DATA.length + 2;

  sh.setRowHeight(GANTT_TOP - 1, 14);
  sh.setRowHeight(GANTT_TOP, 32);
  sh.getRange(GANTT_TOP, 1, 1, N_TOTAL).merge()
    .setValue('📊 入退場 ガントチャート ─ 6/29(月)〜7/7(火)（設営〜撤収）')
    .setBackground('#263238').setFontColor(KT.WHITE).setFontWeight('bold').setFontSize(12)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  // ガント ヘッダー行
  const GHR = GANTT_TOP + 1;
  sh.setRowHeight(GHR, 54);
  sh.getRange(GHR, 1, 1, N_DATA).merge()
    .setValue('チーム / 担当者')
    .setBackground(KT.NAVY).setFontColor(KT.WHITE).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  const dayBg = { setup: '#f57f17', event: '#7b1fa2', removal: '#546e7a' };
  GANTT_DAYS.forEach((day, i) => {
    sh.getRange(GHR, GCOL + i)
      .setValue(day.label)
      .setBackground(dayBg[day.type] || '#455a64')
      .setFontColor(KT.WHITE).setFontWeight('bold').setFontSize(9)
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  });

  // ガント チーム行
  const deptKeys  = ['設営', '機材レンタル', '電源・電気工事', 'BAR', '音響'];
  const teamLabels = [
    '設営\nShinovi Creation\n(hajime / タニシ)',
    '機材レンタル\n西尾レントール',
    '電源・電気工事\n後藤電気チーム',
    'BAR（最初の入り）\n🌞Hiroto Arai',
    '音響\n株式会社VERY\n(代表: 田中)',
  ];

  teamLabels.forEach((label, i) => {
    const r = GHR + 1 + i;
    sh.setRowHeight(r, 52);

    const deptColor  = KT.DEPT[deptKeys[i]]  || '#f5f5f5';
    const ganttColor = KT.GANTT[deptKeys[i]] || '#78909c';

    sh.getRange(r, 1, 1, N_DATA).merge()
      .setValue(label)
      .setBackground(deptColor).setFontWeight('bold').setFontSize(10)
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);

    const [si, ei] = GANTT_RANGES[i];
    GANTT_DAYS.forEach((_, j) => {
      const col = GCOL + j;
      if (j >= si && j <= ei) {
        const txt = j === si ? '▶ IN' : (j === ei ? 'OUT ◀' : '━');
        sh.getRange(r, col)
          .setValue(txt)
          .setBackground(ganttColor).setFontColor(KT.WHITE)
          .setFontWeight('bold').setFontSize(j === si || j === ei ? 9 : 14)
          .setHorizontalAlignment('center').setVerticalAlignment('middle');
      } else {
        sh.getRange(r, col).setBackground('#eeeeee');
      }
    });
  });

  sh.getRange(GHR, 1, 1 + teamLabels.length, N_TOTAL)
    .setBorder(true, true, true, true, true, true);

  // ── 注記 ──
  const NOTE_ROW = GHR + teamLabels.length + 2;
  sh.setRowHeight(NOTE_ROW - 1, 12);
  sh.setRowHeight(NOTE_ROW, 54);
  sh.getRange(NOTE_ROW, 1, 1, N_TOTAL).merge()
    .setValue('📝 注記: ① BARスタッフ（テルキ/そうちゃん/はたくん）は時給¥3,000・日給¥18,000のギャラ発生だが、ヒロトの入り後に合流するためこのシートでは省略（ユーザー指示に従いBAR一番乗りのみ記載）。② ボランティアスタッフ（12名）はギャラなしのためこのシートに含まない。③ 株式会社VERY の正確な入り日時は確認中。')
    .setBackground('#fff9c4').setFontSize(9)
    .setHorizontalAlignment('left').setVerticalAlignment('middle').setWrap(true);

  // ── 列幅 ──
  sh.setColumnWidth(1, 160);
  sh.setColumnWidth(2, 180);
  sh.setColumnWidth(3, 200);
  sh.setColumnWidth(4, 140);
  sh.setColumnWidth(5, 130);
  sh.setColumnWidth(6, 150);
  sh.setColumnWidth(7, 140);
  sh.setColumnWidth(8, 80);
  for (let c = GCOL; c < GCOL + N_DAYS; c++) sh.setColumnWidth(c, 66);

  Logger.log('✅ 「' + KOTEI_SHEET_NAME + '」を作成しました: ' + ss.getUrl());
  try {
    SpreadsheetApp.getUi().alert('✅ 「' + KOTEI_SHEET_NAME + '」を作成しました！\n\n' + ss.getUrl());
  } catch (e) { /* スタンドアロン実行時はUIをスキップ */ }
}

// スプレッドシートを開いたときにメニューを追加
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🎵 MOMENT 2026')
      .addItem('📅 工程表_有給スタッフ 作成/更新', 'setupKoteiHyoSheet')
      .addItem('📋 エントランス用_全チーム入り一覧 作成/更新', 'setupEntranceSheet')
      .addItem('📊 当日運営マスター 作成/更新', 'setupMasterSheet')
      .addSeparator()
      .addItem('⚡ 全シート一括作成/更新', 'setupAllSheets')
      .addToUi();
  } catch (e) {}
}

// ── 全シート一括作成ヘルパー ──
function setupAllSheets() {
  setupKoteiHyoSheet();
  setupEntranceSheet();
  setupMasterSheet();
  try {
    SpreadsheetApp.getUi().alert('✅ 全シートを作成/更新しました！');
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
// 📋 エントランス用_全チーム入り一覧
// ═══════════════════════════════════════════════════════════════

const ENTRANCE_SHEET_NAME = '📋 エントランス用_全チーム入り一覧';

// 列順: [日付, チーム名/担当者, 役割・内容, 人数, 車両台数・種類, 到着予定時刻, ステータス, チェック]
// ※ 到着済みチェックはエントランス担当がリアルタイムで記入
const ALL_TEAMS_ARRIVAL = [
  // ── 6/29(月) 設営1日目 ──
  ['6/29(月)\n設営1日目', 'ZIGN\n中村則夫',              '造形・デコレーション全般',           '6名',    '3台',                  '夜 ※要確認',        '確認中', ''],
  ['6/29(月)\n設営1日目', 'Samaya Design\n田中エティエンヌ', 'デコレーション・空間デザイン',       '8名',    '3〜4台',               '夜 または 翌朝',     '確認中', ''],
  // ── 6/30(火) 設営2日目 ──
  ['6/30(火)\n設営2日目', 'Shinovi Creation\nhajime（萩原一）/ タニシ（西谷）', '設営全般・単管/テント製作・機材運搬', '2名',    '2台\n(2Tロングアルミバン + 4T平トラック)', '朝IN',         '確定', ''],
  ['6/30(火)\n設営2日目', 'ストレッチテントC\n岩城',       'ストレッチテント施工',               '3名',    '2台',                  '10:00',              '確定', ''],
  ['6/30(火)\n設営2日目', 'oleoreo',                      'デコレーション・空間演出',            '10名前後', '6台 (3t×1)',         '午前',               '確定', ''],
  // ── 7/1(水) 設営3日目 ──
  ['7/1(水)\n設営3日目',  '西尾レントール\n担当: 妹尾真行', '機材搬入',                          '業者',   '業者手配車両',          '9:00',               '確定', ''],
  ['7/1(水)\n設営3日目',  '音響SOL / yusuke ono\n（沖縄ベース）', '音響システム・PA搬入',          '—',      '4台',                  '午前',               '確定', ''],
  ['7/1(水)\n設営3日目',  'フラワーチーム\n大倉ユウ',      'フラワーデコレーション',             '6〜8名', '3〜4台',               '11:00',              '確定', ''],
  ['7/1(水)\n設営3日目',  '共振異空間住居\n阿波座ハウス / リー', '空間インスタレーション',         '6名',    '3台',                  '昼頃',               '確定', ''],
  ['7/1(水)\n設営3日目',  'Haruka Kanata\n松村貴子',       'アート・インスタレーション',         '6名',    '3台',                  '未定',               '確認中', ''],
  ['7/1(水)\n設営3日目',  'センスオブワンダー\n山脇',      '展示・インスタレーション',           '4名',    '2台',                  '18:00',              '確定', ''],
  ['7/1(水)\n設営3日目',  '舞台監督 ルウジ',               '舞台監督（Joshua SWと共同）',        '—',      '—',                    '7/1〜7/2',           '確定', ''],
  ['7/1(水)\n設営3日目',  'ウタリ\n大池拓磨',              '設営補助・機材運搬',                 '4名',    '2台\n(ハイエース + 4t/3t)', '7/1 PMまたは\n7/2 早朝', '確認中', ''],
  // ── 7/2(木) 設営4日目（最終設営） ──
  ['7/2(木)\n設営4日目',  '後藤電気チーム',                '電気工事全般・会場街灯設置',         '業者',   '業者車両',              '朝IN',               '確定', ''],
  ['7/2(木)\n設営4日目',  'BAR ヒロト Arai\n（BARマネージャー・一番乗り）', 'BAR設営統括・オペレーション管理', '1名', '冷凍車（業者）と合わせて', '午前\n冷凍車と同時', '確定', ''],
  ['7/2(木)\n設営4日目',  '株式会社VERY\n代表: 田中',      '音響システム・PA・ステージ電気工事', '8名',    '4台',                  '頃 ※詳細確認中',    '確認中', ''],
  ['7/2(木)\n設営4日目',  'CRACKWORKS\nモリグチハルキ',    'クラックワークス設営',               '2名',    '1台',                  '16:00',              '確定', ''],
  // ── 7/3(金) ★GATE OPEN 9:00★ ──
  ['7/3(金)★\nGATE OPEN', 'Joshua SW\n（舞台監督）',        '舞台監督・ステージ管理',             '1名',    '—',                    '11:00 IN\n〜7/6 PM13:00 OUT', '確定', ''],
  // ── 撤収 ──
  ['7/6(月)\n撤収1日目',  '全チーム',                     '撤収作業開始',                       '—',      '—',                    '7:00〜',             '確定', ''],
  ['7/7(火)\n撤収2日目',  '西尾レントール',                '機材返却',                           '業者',   '業者手配車両',          '11:00 返却',         '確定', ''],
  ['7/7(火)\n撤収2日目',  'Shinovi Creation\nhajime / タニシ', '最終撤収・機材搬出',              '2名',    '2台',                  '午後OUT',            '確定', ''],
];

// 日付バンドの背景色
const ENTRANCE_DATE_COLORS = {
  '6/29': '#37474f',  // ダークグレー（設営1）
  '6/30': '#4e342e',  // ダークブラウン（設営2）
  '7/1':  '#1a237e',  // ダークネイビー（設営3）
  '7/2':  '#1b5e20',  // ダークグリーン（設営4）
  '7/3':  '#4a148c',  // パープル（本番DAY1）
  '7/6':  '#b71c1c',  // ダークレッド（撤収）
  '7/7':  '#bf360c',  // バーントオレンジ（撤収）
};

const ENTRANCE_STATUS_COLORS = {
  '確定':   '#c8e6c9',
  '確認中': '#fff9c4',
  '調整中': '#ffe0b2',
};

function setupEntranceSheet() {
  const ss = SpreadsheetApp.openById(KOTEI_SS_ID);

  const existing = ss.getSheetByName(ENTRANCE_SHEET_NAME);
  if (existing) ss.deleteSheet(existing);
  const sh = ss.insertSheet(ENTRANCE_SHEET_NAME);
  sh.setTabColor('#7b1fa2');

  const N_COL = 8;  // 列数

  // ── タイトル ──
  sh.setRowHeight(1, 56);
  sh.getRange(1, 1, 1, N_COL).merge()
    .setValue('📋 MOMENT 2026 ── エントランス用 全チーム入り一覧')
    .setBackground(KT.NAVY).setFontColor(KT.WHITE)
    .setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  sh.setRowHeight(2, 26);
  sh.getRange(2, 1, 1, N_COL).merge()
    .setValue('⚠️ 到着したら「チェック」欄に ✓ を記入 ／ ステータス「確認中」は当日最終確認すること ／ 更新: ' +
      Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'))
    .setBackground('#fce4ec').setFontSize(9)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  // ── ヘッダー ──
  sh.setRowHeight(3, 38);
  const hdrs = ['日付・フェーズ', 'チーム / 担当者', '役割・担当内容', '人数', '車両', '到着予定時刻', 'ステータス', '✅ 到着'];
  sh.getRange(3, 1, 1, N_COL).setValues([hdrs])
    .setBackground(KT.NAVY).setFontColor(KT.WHITE).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setFrozenRows(3);

  // ── データ行 ──
  let currentDateKey = '';
  let bandToggle = false;

  ALL_TEAMS_ARRIVAL.forEach((row, i) => {
    const r = 4 + i;
    sh.setRowHeight(r, 60);
    sh.getRange(r, 1, 1, N_COL).setValues([row])
      .setVerticalAlignment('middle').setWrap(true);

    // 日付バンド色
    const dateStr = row[0].split('\n')[0]; // e.g. "6/29(月)"
    const dateKey  = dateStr.replace(/\(.*\).*/, '').trim(); // e.g. "6/29"
    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey;
      bandToggle = !bandToggle;
    }
    const dateBg = ENTRANCE_DATE_COLORS[dateKey] || '#455a64';
    sh.getRange(r, 1).setBackground(dateBg).setFontColor(KT.WHITE).setFontWeight('bold')
      .setHorizontalAlignment('center');

    // ステータス色
    const statusColor = ENTRANCE_STATUS_COLORS[row[6]] || '#f5f5f5';
    sh.getRange(r, 7).setBackground(statusColor).setFontWeight('bold').setHorizontalAlignment('center');

    // チェック欄 (列8) — 空白・編集可能
    sh.getRange(r, 8).setBackground('#ffffff').setHorizontalAlignment('center').setFontSize(14);

    // 交互背景（日付列以外）
    const rowBg = bandToggle ? '#f3e5f5' : '#fce4ec';
    for (let c = 2; c <= 6; c++) sh.getRange(r, c).setBackground(rowBg);
  });

  // ── 罫線 ──
  sh.getRange(3, 1, 1 + ALL_TEAMS_ARRIVAL.length, N_COL)
    .setBorder(true, true, true, true, true, true);

  // ── 日付グループの区切り線（太め） ──
  let prevDate = '';
  ALL_TEAMS_ARRIVAL.forEach((row, i) => {
    const dateStr = row[0].split('\n')[0];
    const dateKey  = dateStr.replace(/\(.*\).*/, '').trim();
    if (i > 0 && dateKey !== prevDate) {
      sh.getRange(3 + i, 1, 1, N_COL)
        .setBorder(true, null, null, null, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_THICK);
    }
    prevDate = dateKey;
  });

  // ── 注記 ──
  const noteRow = 4 + ALL_TEAMS_ARRIVAL.length + 1;
  sh.setRowHeight(noteRow - 1, 12);
  sh.setRowHeight(noteRow, 70);
  sh.getRange(noteRow, 1, 1, N_COL).merge()
    .setValue(
      '📝 注記: ①「確認中」のチームは当日最終確認が必要。②車両台数は目安（当日変更あり）。③ ★付き日付は本番当日。④ 撤収は7/6(月)7:00から全チーム一斉。\n' +
      '⚠️ エントランス担当へ: 到着確認したら即「✅ 到着」欄に ✓ を記入し、スタッフ責任者（石田翔馬）に報告。不審車両・予定外の入場はすぐに責任者に連絡。'
    )
    .setBackground('#fff9c4').setFontSize(9)
    .setHorizontalAlignment('left').setVerticalAlignment('middle').setWrap(true);

  // ── 列幅 ──
  sh.setColumnWidth(1, 120);  // 日付
  sh.setColumnWidth(2, 200);  // チーム
  sh.setColumnWidth(3, 200);  // 役割
  sh.setColumnWidth(4,  70);  // 人数
  sh.setColumnWidth(5, 170);  // 車両
  sh.setColumnWidth(6, 130);  // 到着時刻
  sh.setColumnWidth(7,  80);  // ステータス
  sh.setColumnWidth(8,  70);  // チェック

  Logger.log('✅ 「' + ENTRANCE_SHEET_NAME + '」を作成しました: ' + ss.getUrl());
  try {
    SpreadsheetApp.getUi().alert('✅ 「' + ENTRANCE_SHEET_NAME + '」を作成しました！\n\n' + ss.getUrl());
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
// 📊 当日運営マスターシート — 全工程一元管理
// ═══════════════════════════════════════════════════════════════

const MASTER_SHEET_NAME = '📊 当日運営マスター';

function setupMasterSheet() {
  const ss = SpreadsheetApp.openById(KOTEI_SS_ID);

  const existing = ss.getSheetByName(MASTER_SHEET_NAME);
  if (existing) ss.deleteSheet(existing);
  const sh = ss.insertSheet(MASTER_SHEET_NAME);
  sh.setTabColor('#d32f2f');

  const NC = 10; // 総列数
  let row = 1;

  function title(text, bg, fc, size) {
    bg   = bg   || KT.NAVY;
    fc   = fc   || KT.WHITE;
    size = size || 14;
    sh.setRowHeight(row, 48);
    sh.getRange(row, 1, 1, NC).merge()
      .setValue(text).setBackground(bg).setFontColor(fc)
      .setFontSize(size).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    row++;
  }

  function sectionHead(text, bg) {
    sh.setRowHeight(row - 1, 8);
    sh.setRowHeight(row, 36);
    sh.getRange(row, 1, 1, NC).merge()
      .setValue(text).setBackground(bg || '#263238').setFontColor(KT.WHITE)
      .setFontSize(12).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    row++;
  }

  function dataRow(cells, bg) {
    sh.setRowHeight(row, 28);
    cells.forEach((val, i) => {
      if (i < NC) sh.getRange(row, i + 1).setValue(val).setVerticalAlignment('middle').setWrap(true);
    });
    if (bg) sh.getRange(row, 1, 1, NC).setBackground(bg);
    row++;
  }

  function mergedRow(col, span, val, bg, fc) {
    sh.getRange(row, col, 1, span).merge()
      .setValue(val).setBackground(bg || '#f5f5f5').setFontColor(fc || '#000000')
      .setVerticalAlignment('middle').setWrap(true);
  }

  function blankRow(h) { sh.setRowHeight(row, h || 8); row++; }

  // ── タイトル ──
  title('📊 MOMENT 2026 当日運営マスターシート', KT.NAVY, KT.WHITE, 16);
  sh.setRowHeight(row, 24);
  sh.getRange(row, 1, 1, NC).merge()
    .setValue('更新: ' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm') +
      '　⚠️ このシートは内部スタッフ専用です。外部に共有しないこと。')
    .setBackground('#fbe9e7').setFontSize(9)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  row++;
  sh.setFrozenRows(2);

  // ═══════════════════════════════════════════
  // 【1】 イベント概要
  // ═══════════════════════════════════════════
  blankRow();
  sectionHead('【1】 イベント概要', '#1a237e');

  const overview = [
    ['イベント名', 'MOMENT 2026', '開催日', '2026年7月3日(金)〜7月5日(日)', '撤収', '7/6(月)7:00〜'],
    ['テーマ',     '"深化"',       '会場',   '洞川キャンプ場（奈良県天川村）', '収容', '850名'],
    ['チケット',   '前売り810枚 完売 / 当日券なし', 'ゲートオープン', '7/3(金) 9:00', 'TT開始', '7/3(金) 15:00'],
    ['After終了',  '7/5(日) 23:30', '駐車場', 'A:96台 B:52台 計150台', '出店者P', 'あたらしや体育館'],
  ];
  overview.forEach((r, i) => {
    sh.setRowHeight(row, 26);
    const bg = i % 2 === 0 ? '#e8eaf6' : '#f5f5f5';
    for (let c = 0; c < 6; c++) {
      const isLabel = c % 2 === 0;
      sh.getRange(row, c + 1)
        .setValue(r[c])
        .setBackground(isLabel ? '#283593' : bg)
        .setFontColor(isLabel ? KT.WHITE : '#000000')
        .setFontWeight(isLabel ? 'bold' : 'normal')
        .setVerticalAlignment('middle').setWrap(true);
    }
    // 残り4列を背景合わせ
    if (NC > 6) sh.getRange(row, 7, 1, NC - 6).setBackground(bg);
    row++;
  });

  // ═══════════════════════════════════════════
  // 【2】 日程タイムライン
  // ═══════════════════════════════════════════
  blankRow();
  sectionHead('【2】 日程タイムライン（設営〜撤収）', '#4a148c');

  const timeline = [
    ['6/29(月)', '設営1日目', 'テント設営開始', '10:00 倉庫積み込み → 15:00 会場入り・テント設営', '#f3e5f5'],
    ['6/30(火)', '設営2日目', '備品搬入',        '8:00 備品荷下ろし・資材運搬 / Shinovi Creation入り', '#f3e5f5'],
    ['7/1(水)',  '設営3日目', 'エントランス設営', '8:00 エントランス設営・投光器設置 / 業者各社搬入', '#f3e5f5'],
    ['7/2(木)',  '設営4日目', '最終設営・仕込み',  '8:00 備品清掃 / 14:00 最終確認 / 16:00 ゴミ拾い', '#f3e5f5'],
    ['7/3(金)',  'DAY1 ★',   'ゲートオープン',    '9:00 ゲートオープン / 15:00 TT開始 / 22:00 車入場〆', '#ede7f6'],
    ['7/4(土)',  'DAY2',      '2日目',            '9:00 警備 / 20:00 車入場〆',                         '#ede7f6'],
    ['7/5(日)',  'DAY3',      'After〜撤収準備',   '10:00 警備 / 23:30 After終了',                      '#ede7f6'],
    ['7/6(月)',  '撤収1日目', '全チーム撤収開始',  '7:00〜 全チーム撤収 / Joshua SW OUT PM13:00',       '#e8f5e9'],
    ['7/7(火)',  '撤収2日目', '機材返却・完了',     '11:00 西尾レントール機材返却 / Shinovi Creation OUT', '#e8f5e9'],
  ];

  sh.setRowHeight(row, 26);
  ['日付', 'フェーズ', 'ポイント', '詳細', '', '', '', '', '', ''].forEach((h, c) => {
    sh.getRange(row, c + 1).setValue(h)
      .setBackground(KT.NAVY).setFontColor(KT.WHITE).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  row++;

  timeline.forEach(([date, phase, point, detail, bg]) => {
    sh.setRowHeight(row, 30);
    sh.getRange(row, 1).setValue(date).setBackground(bg).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(row, 2).setValue(phase).setBackground(bg).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(row, 3).setValue(point).setBackground(bg).setVerticalAlignment('middle');
    sh.getRange(row, 4, 1, NC - 3).merge().setValue(detail).setBackground(bg).setWrap(true).setVerticalAlignment('middle');
    row++;
  });

  // ═══════════════════════════════════════════
  // 【3】 部門別担当者一覧
  // ═══════════════════════════════════════════
  blankRow();
  sectionHead('【3】 部門別担当者一覧', '#1b5e20');

  const staffTable = [
    ['部署',          '責任者/リーダー',    '主な担当者',                         '備考'],
    ['全体（主催）',  'HI-C',              '妹尾真行（共同主催・総合統括）',        ''],
    ['運営本部',      '石田翔馬（統括マネ）', 'masato morokuma / 武藤剛亘',          ''],
    ['エントランス',  '＆you⭐︎',           'kazuha tanaka / Shusui Tanaka',      '荷物検査あり'],
    ['場外P',         'Hide',              '',                                    ''],
    ['警備',          'YUTO',              '青木陽平（全日本警備保障）',            ''],
    ['ボランティア',  '南城祐介 / KEITA',  '12名',                                '1人4h×3日'],
    ['舞台監督',      'Joshua SW',         'ルウジ（サポート）',                   '共同担当'],
    ['音響（Main）',  'yusuke ono',        'kan2（BARフロア）',                    '沖縄ベース'],
    ['電源',          '原田邦彦',          '後藤電気チーム',                       '街灯含む'],
    ['設営',          'hajime（Shinovi）',  'タニシ（ニシタニ）',                   '6/30IN'],
    ['BAR',           'Hiroto Arai',       'テルキ / そうちゃん / はたくん',       '時給¥3,000'],
    ['出店管理',      'YMT / ヤマト',      '',                                    ''],
    ['広報/アーティストケア', 'MARIA',    'Momoko',                               ''],
    ['物販',          '愛ちゃん',          '',                                    ''],
    ['キッズ',        'akinoko',           '',                                    ''],
    ['清掃',          'タイガ',            '',                                    ''],
    ['シャトルバス',  'ルウジ',            '',                                    ''],
    ['救護',          '管理棟',            '',                                    ''],
  ];

  staffTable.forEach((r, i) => {
    sh.setRowHeight(row, 26);
    const isHeader = i === 0;
    const bg = isHeader ? KT.NAVY : (i % 2 === 0 ? '#e8f5e9' : '#f5f5f5');
    const fc = isHeader ? KT.WHITE : '#000000';
    r.forEach((val, c) => {
      const span = c === 2 ? 6 : 1; // 担当者列を広く
      if (c < NC) {
        sh.getRange(row, c + 1).setValue(val)
          .setBackground(bg).setFontColor(fc)
          .setFontWeight(isHeader ? 'bold' : 'normal')
          .setVerticalAlignment('middle').setWrap(true);
      }
    });
    // 4列しかないので残りを背景合わせ
    if (!isHeader) sh.getRange(row, 5, 1, NC - 4).setBackground(bg);
    row++;
  });

  // ═══════════════════════════════════════════
  // 【4】 エントランスオペレーション手順
  // ═══════════════════════════════════════════
  blankRow();
  sectionHead('【4】 エントランスオペレーション手順', '#e65100');

  const entranceOps = [
    ['①', '事前準備',    '開場2時間前（7:00〜）にエントランス設営完了・荷物検査機材確認'],
    ['②', 'ゲートオープン', '9:00 ゲートオープン。制服警備員が常時エントランスに常駐'],
    ['③', 'チケット確認', 'チケット（QRコード or 紙）を確認。当日券なし・リストバンド交換'],
    ['④', '荷物検査',    '全来場者のバッグチェック。瓶・ペットボトル・紙パックアルコール没収'],
    ['⑤', '車両入場',    '初日22:00まで / 2・3日目20:00まで。以降は歩行者のみOK'],
    ['⑥', '深夜ゲート',  '23:00〜6:00は徒歩のみ入場可。警備員が対応'],
    ['⑦', '不審者対応',  '不審車両・無断入場 → 即座に石田翔馬（統括）に報告'],
    ['⑧', '緊急時',      '救護 → 管理棟へ誘導。救急要請は警備員 or 石田翔馬に連絡'],
  ];

  entranceOps.forEach(([num, phase, detail], i) => {
    sh.setRowHeight(row, 36);
    const bg = i % 2 === 0 ? '#fff3e0' : '#fff8e1';
    sh.getRange(row, 1).setValue(num).setBackground('#e65100').setFontColor(KT.WHITE)
      .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(row, 2).setValue(phase).setBackground(bg).setFontWeight('bold').setVerticalAlignment('middle');
    sh.getRange(row, 3, 1, NC - 2).merge().setValue(detail).setBackground(bg).setWrap(true).setVerticalAlignment('middle');
    row++;
  });

  // ═══════════════════════════════════════════
  // 【5】 緊急対応フロー（内部用）
  // ═══════════════════════════════════════════
  blankRow();
  sectionHead('【5】 緊急対応フロー（内部スタッフのみ）', '#b71c1c');

  const emergency = [
    ['医療緊急',   '救護場所: 管理棟 / 119番要請後に石田翔馬に連絡'],
    ['火災',       '初期消火 → 全員避難 → 119番 → 石田翔馬 → 来場者アナウンス'],
    ['不審者',     '単独で対応しない / 警備員+石田翔馬に即報告'],
    ['停電',       '後藤電気チーム → 原田邦彦（電源統括）に即連絡'],
    ['音響トラブル', 'yusuke ono（Main）/ kan2（BARフロア）に連絡'],
    ['天候悪化',   '石田翔馬 → HI-C・妹尾に報告 → 判断して全体アナウンス'],
    ['大量入場',   '入場規制 → 警備員 → 石田翔馬に報告・判断仰ぐ'],
  ];

  sh.setRowHeight(row, 26);
  sh.getRange(row, 1).setValue('状況').setBackground(KT.NAVY).setFontColor(KT.WHITE).setFontWeight('bold').setVerticalAlignment('middle');
  sh.getRange(row, 2, 1, NC - 1).merge().setValue('対応手順').setBackground(KT.NAVY).setFontColor(KT.WHITE).setFontWeight('bold').setVerticalAlignment('middle');
  row++;

  emergency.forEach(([situation, action], i) => {
    sh.setRowHeight(row, 32);
    const bg = i % 2 === 0 ? '#ffebee' : '#fff5f5';
    sh.getRange(row, 1).setValue(situation).setBackground('#c62828').setFontColor(KT.WHITE)
      .setFontWeight('bold').setVerticalAlignment('middle').setWrap(true);
    sh.getRange(row, 2, 1, NC - 1).merge().setValue(action).setBackground(bg).setWrap(true).setVerticalAlignment('middle');
    row++;
  });

  // ═══════════════════════════════════════════
  // 【6】 関連スプシリンク
  // ═══════════════════════════════════════════
  blankRow();
  sectionHead('【6】 関連スプレッドシートリンク', '#01579b');

  const links = [
    ['📊 MOMENT 2026 管理マスターシート',           'https://docs.google.com/spreadsheets/d/13uakCf1IbqxuSVRhrcDoiG6cC6xLU333oeXSeQiFemQ/edit'],
    ['🏪 出店管理マスター',                          'https://docs.google.com/spreadsheets/d/1ULD9TcMRJDMF1k-I4CBJEX3M_DT2TRLohTQ-xugZTCA/edit'],
    ['🎤 アーティスト管理【国内回答】',             'https://docs.google.com/spreadsheets/d/1h7HV6ZfnDElblK4nJ_dbtKgAOaNnB1olv2A7946GjYo/edit'],
    ['📋 タスク・スケジュール管理システム（本シート）', 'https://docs.google.com/spreadsheets/d/1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ/edit'],
    ['🙋 ボランティアスタッフ募集（回答）',          'https://docs.google.com/spreadsheets/d/1tVEmUOELKBQTkDGew6jRmWaqqlCLwz61wIvRCKFuF_Q/edit'],
  ];

  links.forEach(([name, url], i) => {
    sh.setRowHeight(row, 30);
    const bg = i % 2 === 0 ? '#e3f2fd' : '#f5f5f5';
    sh.getRange(row, 1, 1, 4).merge().setValue(name).setBackground(bg)
      .setFontWeight('bold').setVerticalAlignment('middle');
    sh.getRange(row, 5, 1, NC - 4).merge().setValue(url).setBackground(bg)
      .setFontColor('#1565c0').setVerticalAlignment('middle').setWrap(true);
    row++;
  });

  // ── 列幅 ──
  sh.setColumnWidth(1, 90);
  sh.setColumnWidth(2, 140);
  sh.setColumnWidth(3, 160);
  sh.setColumnWidth(4, 160);
  sh.setColumnWidth(5, 160);
  sh.setColumnWidth(6, 140);
  sh.setColumnWidth(7, 140);
  sh.setColumnWidth(8, 120);
  sh.setColumnWidth(9, 120);
  sh.setColumnWidth(10, 100);

  Logger.log('✅ 「' + MASTER_SHEET_NAME + '」を作成しました: ' + ss.getUrl());
  try {
    SpreadsheetApp.getUi().alert('✅ 「' + MASTER_SHEET_NAME + '」を作成しました！\n\n' + ss.getUrl());
  } catch (e) {}
}
