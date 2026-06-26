/**
 * MOMENT 2026 工程表 ── ギャラ発生スタッフのみ
 * ================================================
 * 【使い方】
 * 1. 工程表スプシのスクリプトエディタに貼り付け
 *    (タスク・スケジュール管理システム)
 * 2. 「setupKoteiHyoSheet」を選択して ▶ 実行
 *
 * 【対象スプレッドシートID】
 * 1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ
 *
 * ⚠️ 既存シートは一切変更・削除しない
 *    「📅 工程表_有給スタッフ」は自作シートなので再作成OK
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
      .addToUi();
  } catch (e) {}
}
