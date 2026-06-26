/**
 * MOMENT 2026 — スプレッドシート シート再構築スクリプト
 *
 * 対象スプシ: 1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ
 * 目的: ボット連携シートを一切触らずに、運営用6シートを新規追加/再構築する
 *
 * 実行方法: setupAllNewSheets() を Apps Script エディタから手動実行
 *
 * ⚠️ 下記 BOT_PROTECTED のシートは絶対に変更・削除しない
 */

// ───────────────────────────────────────────
// 定数
// ───────────────────────────────────────────

const SPREADSHEET_ID = '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ';

const BOT_PROTECTED = [
  '📱 LINEリアルタイム',
  '📋 タスク（現役）',
  '✅ 完了タスク',
  '📚 確定知識ベース',
  '📦 備品・資材',
  '👥 スタッフ',
  '🛍️ 出店リスト',
];

// 関連スプシリンク
const LINKS = {
  schedule:    '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY',
  tasks:       '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ',
  volunteer:   '1tVEmUOELKBQTkDGew6jRmWaqqlCLwz61wIvRCKFuF_Q',
  artist:      '1h7HV6ZfnDElblK4nJ_dbtKgAOaNnB1olv2A7946GjYo',
  vendor:      '1ULD9TcMRJDMF1k-i4CBJEX3M_DT2TRLohTQ-xugZTCA',
  entrance:    '1ncj9sVeOKFhqavsdo4hsjaQ2f5LLeMptBxHSQTgwP0g',
};

// ───────────────────────────────────────────
// カラーパレット（アーティストケア管理シート準拠）
// ───────────────────────────────────────────

const C = {
  // 背景
  H1_BG:        '#0D0D1A',  // 最上位ヘッダー（ほぼ黒の濃紺）
  H2_BG:        '#1C1C3C',  // サブヘッダー（濃紺）
  COL_HDR_BG:   '#2D2D6B',  // 列見出し（インディゴ）
  ROW_A_BG:     '#FFFFFF',  // データ行A
  ROW_B_BG:     '#F2F2FA',  // データ行B（淡ラベンダー）

  // テキスト
  WHITE:        '#FFFFFF',
  DARK:         '#0D0D1A',
  GOLD:         '#C9A84C',  // アクセントゴールド

  // ケアスタッフ行
  MARIA_BG:     '#FCEEF5', MARIA_FG:  '#7B1B5E',
  TUI_BG:       '#EEF5FC', TUI_FG:    '#1B4D7B',
  LOE_BG:       '#EFFCF0', LOE_FG:    '#1B7B2C',
  BUNDO_BG:     '#FFF5EE', BUNDO_FG:  '#7B3B1B',

  // 工程表カテゴリ
  CAT_MOMENT_BG: '#E8F5E9', CAT_MOMENT_FG: '#1E4D2B',
  CAT_SOUND_BG:  '#DDEEFF', CAT_SOUND_FG:  '#1A3B6B',
  CAT_LIGHT_BG:  '#FFF8DC', CAT_LIGHT_FG:  '#7B5A00',
  CAT_DECO_BG:   '#FFF0E6', CAT_DECO_FG:   '#7B2D00',
  CAT_POWER_BG:  '#FFE8E8', CAT_POWER_FG:  '#7B0000',
  CAT_VIDEO_BG:  '#F3E5F5', CAT_VIDEO_FG:  '#4A0E7B',
  CAT_BAR_BG:    '#E0F7FA', CAT_BAR_FG:    '#005070',
  CAT_STAGE_BG:  '#E8EAF6', CAT_STAGE_FG:  '#1A1A3C',
  CAT_GUARD_BG:  '#F1F8E9', CAT_GUARD_FG:  '#2D4D00',
};

// ───────────────────────────────────────────
// メイン実行関数
// ───────────────────────────────────────────

function setupAllNewSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // ボット保護シートの確認
  const existing = ss.getSheets().map(s => s.getName());
  const missing = BOT_PROTECTED.filter(n => !existing.includes(n));
  if (missing.length > 0) {
    Logger.log('⚠️ 以下のボット保護シートが見つかりません（スキップ）: ' + missing.join(', '));
  }

  Logger.log('🌟 表紙/ダッシュボード 作成中...');
  createDashboardSheet(ss);

  Logger.log('📅 工程表（全体） 作成中...');
  createScheduleSheet(ss);

  Logger.log('🎤 アーティストケア 作成中...');
  createArtistCareSheet(ss);

  Logger.log('🎵 タイムテーブル 作成中...');
  createTimeTableSheet(ss);

  Logger.log('🍱 賄い管理 作成中...');
  createMakanaishiSheet(ss);

  Logger.log('📞 スタッフ緊急連絡先 作成中...');
  createContactSheet(ss);

  Logger.log('📂 シート順番を整理中...');
  reorderSheets(ss);

  Logger.log('✅ 全シート再構築完了！');
  SpreadsheetApp.flush();
}

// ───────────────────────────────────────────
// 🌟 表紙/ダッシュボード
// ───────────────────────────────────────────

function createDashboardSheet(ss) {
  const sh = getOrCreateSheet(ss, '🌟 表紙');
  sh.clear();
  sh.setTabColor('#C9A84C');

  // タイトルブロック
  sh.setColumnWidth(1, 60);
  sh.setColumnWidth(2, 280);
  sh.setColumnWidth(3, 320);
  sh.setColumnWidth(4, 180);
  sh.setColumnWidth(5, 180);

  const titleRange = sh.getRange('B1:E1');
  titleRange.merge();
  titleRange.setValue('🌟 MOMENT 2026 — 管理システム ダッシュボード');
  styleH1(titleRange);

  const subRange = sh.getRange('B2:E2');
  subRange.merge();
  subRange.setValue('2026年7月3日（金）〜 7月5日（日）｜奈良県天川村・洞川キャンプ場');
  subRange.setBackground(C.H2_BG).setFontColor(C.GOLD)
    .setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 32);

  // 区切り
  sh.getRange('B3:E3').merge().setValue('').setBackground(C.H1_BG);
  sh.setRowHeight(3, 8);

  // セクションヘッダー
  const secRange = sh.getRange('B4:E4');
  secRange.merge();
  secRange.setValue('📎 関連スプレッドシート一覧');
  styleH2(secRange);
  sh.setRowHeight(4, 36);

  // リンクヘッダー行
  const linkHdr = sh.getRange('B5:E5');
  [['', 'スプレッドシート名', 'URL（クリックして開く）', '担当/備考']].forEach((row, i) => {
    sh.getRange(5, 2, 1, 4).setValues([row]);
  });
  styleColHeader(sh.getRange('B5:E5'));
  sh.setRowHeight(5, 30);

  // リンクデータ
  const linkData = [
    ['🗓', '工程表（スケジュール管理）',    `https://docs.google.com/spreadsheets/d/${LINKS.schedule}/edit`,   '全体スケジュール'],
    ['✅', 'タスク管理（本スプシ）',         `https://docs.google.com/spreadsheets/d/${LINKS.tasks}/edit`,      'ジュニアBot連携'],
    ['📋', 'ボランティア回答シート',          `https://docs.google.com/spreadsheets/d/${LINKS.volunteer}/edit`,  'Googleフォーム連携'],
    ['🎤', 'アーティスト管理シート',          `https://docs.google.com/spreadsheets/d/${LINKS.artist}/edit`,    'ケア・宿泊管理'],
    ['🪟', '出店管理シート',                  `https://docs.google.com/spreadsheets/d/${LINKS.vendor}/edit`,    '出店者情報'],
    ['🚪', 'エントランス管理シート',           `https://docs.google.com/spreadsheets/d/${LINKS.entrance}/edit`, 'チケット・入場'],
  ];

  linkData.forEach((row, i) => {
    const r = 6 + i;
    sh.getRange(r, 2).setValue(row[0]);
    sh.getRange(r, 3).setValue(row[1]).setFontWeight('bold');
    sh.getRange(r, 4).setValue(row[2]).setFontColor('#1A73E8').setFontLine('underline');
    sh.getRange(r, 5).setValue(row[3]);
    const bg = i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG;
    sh.getRange(r, 2, 1, 4).setBackground(bg).setFontColor(C.DARK)
      .setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.setRowHeight(r, 36);
  });

  // このスプシ内のシート案内
  sh.getRange('B13:E13').merge().setValue('📂 このスプレッドシートのシート構成').setBackground(C.H2_BG)
    .setFontColor(C.WHITE).setFontSize(12).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(13, 36);

  const sheetInfo = [
    ['🌟 表紙', 'ダッシュボード（本シート）', 'リンク集'],
    ['📅 工程表（全体）', '全体スケジュール 6/29〜7/7', '設営〜撤収まで'],
    ['🎤 アーティストケア', 'アーティスト35組のケア担当', 'MARIA/TUI/LOE/BUNDO'],
    ['🎵 タイムテーブル', 'DAY1/DAY2/DAY3 ＋ Live Paint', '出演順・ステージ'],
    ['🍱 賄い管理', 'スタッフ・アーティスト食事管理', '7/3〜7/5'],
    ['📞 スタッフ緊急連絡先', '緊急時の連絡先一覧', 'コアスタッフ'],
    ['─── ボット連携シート（以下変更禁止）───', '', ''],
    ['📱 LINEリアルタイム', 'LINEメッセージログ', 'ジュニアBotが自動書込'],
    ['📋 タスク（現役）', '自動抽出タスク', 'ジュニアBotが自動書込'],
    ['✅ 完了タスク', '完了済みタスク', 'ジュニアBotが自動書込'],
    ['📚 確定知識ベース', '学習済み確定情報', 'ジュニアBotが自動書込'],
    ['📦 備品・資材', '備品場所・数量', 'ジュニアBotが自動書込'],
    ['👥 スタッフ', 'スタッフ情報', 'ジュニアBotが参照'],
    ['🛍️ 出店リスト', '出店者情報', 'ジュニアBotが参照'],
  ];

  sh.getRange(14, 2, 1, 4).setValues([['シート名', '内容', '備考', '']]);
  styleColHeader(sh.getRange('B14:E14'));
  sh.setRowHeight(14, 30);

  sheetInfo.forEach((row, i) => {
    const r = 15 + i;
    const isProtected = row[0].includes('ボット連携');
    const isBotSheet  = BOT_PROTECTED.some(n => row[0] === n);
    const bg = isProtected ? C.H2_BG :
               isBotSheet  ? '#FFF8DC' :
               i % 2 === 0  ? C.ROW_A_BG : C.ROW_B_BG;
    const fg = isProtected ? C.GOLD : isBotSheet ? '#7B5A00' : C.DARK;
    sh.getRange(r, 2).setValue(row[0]);
    sh.getRange(r, 3).setValue(row[1]);
    sh.getRange(r, 4).setValue(row[2]);
    sh.getRange(r, 2, 1, 3).setBackground(bg).setFontColor(fg)
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    if (isProtected) sh.getRange(r, 2, 1, 3).setFontWeight('bold').setFontStyle('italic');
    sh.setRowHeight(r, 30);
  });

  sh.setFrozenRows(1);
}

// ───────────────────────────────────────────
// 📅 工程表（全体）
// ───────────────────────────────────────────

function createScheduleSheet(ss) {
  const sh = getOrCreateSheet(ss, '📅 工程表（全体）');
  sh.clear();
  sh.setTabColor('#2D2D6B');

  // 列幅設定
  const colWidths = [60, 90, 120, 220, 180, 180, 100, 200];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  // タイトル
  sh.getRange('A1:H1').merge().setValue('📅 MOMENT 2026 — 工程表（全体）6/29〜7/7');
  styleH1(sh.getRange('A1:H1'));
  sh.setRowHeight(1, 48);

  sh.getRange('A2:H2').merge().setValue('※ このシートは工程の概要版です。詳細は工程表スプシを参照してください。');
  sh.getRange('A2:H2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 28);

  // 列ヘッダー
  const headers = ['No.', '日付', 'カテゴリ', '作業内容', '担当チーム', '担当者', '場所', '備考'];
  sh.getRange(3, 1, 1, headers.length).setValues([headers]);
  styleColHeader(sh.getRange(3, 1, 1, headers.length));
  sh.setRowHeight(3, 32);
  sh.setFrozenRows(3);

  // 工程データ（カテゴリ別・日付順）
  const schedule = [
    // 6/29 事前準備
    [1,  '6/29（月）', 'MOMENT運営', '機材リスト最終確認・発注締め切り',   'MOMENT運営', 'HI-C',   '遠隔',      ''],
    [2,  '6/29（月）', 'MOMENT運営', 'スタッフシフト表最終版送付',          'MOMENT運営', 'HI-C',   '遠隔',      ''],
    [3,  '6/30（火）', 'MOMENT運営', 'アーティスト最終確認・旅程共有',      'アーティストケア', 'MARIA', '遠隔',   ''],
    [4,  '6/30（火）', '音響',       '音響機材積み込み・トラック手配',       '音響チーム', '',       '大阪',      ''],
    [5,  '7/1（水）',  '照明',       '照明機材積み込み確認',                '照明チーム', '',       '大阪',      ''],
    [6,  '7/1（水）',  'MOMENT運営', 'ボランティアスタッフ最終連絡',        'MOMENT運営', 'HI-C',   '遠隔',      ''],
    // 7/2 移動日
    [7,  '7/2（木）',  'MOMENT運営', '先遣隊 天川村入り',                  'MOMENT運営', '',       '洞川キャンプ場', ''],
    [8,  '7/2（木）',  '電源',       '発電機設置・電源ライン敷設開始',       '電源チーム', '',       'メインエリア', ''],
    [9,  '7/2（木）',  'デコ',       'ステージデコ・アーチ設置開始',        'デコチーム', '',       'メインステージ', ''],
    // 7/3 DAY1
    [10, '7/3（金）',  '音響',       '音響システム仮設・マイクチェック',     '音響チーム', '',       'メインステージ', ''],
    [11, '7/3（金）',  '照明',       '照明リグ組み上げ・シーン設定',        '照明チーム', '',       'メインステージ', ''],
    [12, '7/3（金）',  '映像',       'LED壁設置・映像テスト',              '映像チーム', '',       'メインステージ', ''],
    [13, '7/3（金）',  'BAR',        'BARエリア設営・在庫搬入',            'BARチーム',  '',       'BARエリア', ''],
    [14, '7/3（金）',  '警備',       '入場ゲート設置・動線確認',            '警備チーム', '',       'エントランス', ''],
    [15, '7/3（金）',  '舞台監督',   'サウンドチェック（全アーティスト）',   '舞台監督',   '',       'メインステージ', '14:00〜'],
    [16, '7/3（金）',  'MOMENT運営', 'OPEN 17:00 → DAY1スタート',         '全スタッフ', '',       '洞川キャンプ場', ''],
    // 7/4 DAY2
    [17, '7/4（土）',  'MOMENT運営', 'DAY2 運営・全体統括',                '全スタッフ', '',       '洞川キャンプ場', ''],
    [18, '7/4（土）',  '舞台監督',   'サウンドチェック（当日分）',           '舞台監督',   '',       'メインステージ', '昼'],
    [19, '7/4（土）',  'アーティストケア', 'アーティスト送迎・ケア対応',    'ケアチーム', 'MARIA/TUI/LOE/BUNDO', '各宿泊施設', ''],
    [20, '7/4（土）',  'BAR',        'BAR営業・在庫補充',                  'BARチーム',  '',       'BARエリア', ''],
    // 7/5 DAY3・撤収
    [21, '7/5（日）',  'MOMENT運営', 'DAY3 運営・クロージング',            '全スタッフ', '',       '洞川キャンプ場', ''],
    [22, '7/5（日）',  'MOMENT運営', 'CLOSE → 片付け開始',                '全スタッフ', '',       '洞川キャンプ場', '終演後'],
    [23, '7/5（日）',  '音響',       '音響機材撤収・梱包',                  '音響チーム', '',       'メインステージ', ''],
    [24, '7/5（日）',  '照明',       '照明機材撤収・梱包',                  '照明チーム', '',       'メインステージ', ''],
    [25, '7/5（日）',  '電源',       '電源ライン撤去・発電機積み込み',       '電源チーム', '',       'メインエリア', ''],
    // 7/6〜7/7 撤収
    [26, '7/6（月）',  'MOMENT運営', '完全撤収・場内清掃',                  '全スタッフ', '',       '洞川キャンプ場', ''],
    [27, '7/6（月）',  'MOMENT運営', 'キャンプ場引き渡し確認',              'MOMENT運営', 'HI-C',  '洞川キャンプ場', ''],
    [28, '7/7（火）',  'MOMENT運営', '打ち上げ・スタッフ解散',              '全スタッフ', '',       '大阪市内',  ''],
  ];

  const catColorMap = {
    'MOMENT運営': [C.CAT_MOMENT_BG, C.CAT_MOMENT_FG],
    '音響':       [C.CAT_SOUND_BG,  C.CAT_SOUND_FG],
    '照明':       [C.CAT_LIGHT_BG,  C.CAT_LIGHT_FG],
    'デコ':       [C.CAT_DECO_BG,   C.CAT_DECO_FG],
    '電源':       [C.CAT_POWER_BG,  C.CAT_POWER_FG],
    '映像':       [C.CAT_VIDEO_BG,  C.CAT_VIDEO_FG],
    'BAR':        [C.CAT_BAR_BG,    C.CAT_BAR_FG],
    '舞台監督':   [C.CAT_STAGE_BG,  C.CAT_STAGE_FG],
    '警備':       [C.CAT_GUARD_BG,  C.CAT_GUARD_FG],
    'アーティストケア': [C.MARIA_BG, C.MARIA_FG],
  };

  schedule.forEach((row, i) => {
    const r = 4 + i;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const cat = row[2];
    const [bg, fg] = catColorMap[cat] || [i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG, C.DARK];
    sh.getRange(r, 1, 1, 8).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    // カテゴリ列は太字
    sh.getRange(r, 3).setFontWeight('bold');
    sh.setRowHeight(r, 30);
  });
}

// ───────────────────────────────────────────
// 🎤 アーティストケア
// ───────────────────────────────────────────

function createArtistCareSheet(ss) {
  const sh = getOrCreateSheet(ss, '🎤 アーティストケア');
  sh.clear();
  sh.setTabColor('#7B1B5E');

  const colWidths = [30, 160, 70, 160, 80, 80, 80, 120, 120, 120, 200];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('A1:K1').merge().setValue('🎤 MOMENT 2026 — アーティストケア管理');
  styleH1(sh.getRange('A1:K1'));
  sh.setRowHeight(1, 48);

  sh.getRange('A2:K2').merge()
    .setValue('ケアスタッフ: MARIA（ピンク）/ TUI（ブルー）/ LOE（グリーン）/ BUNDO（オレンジ）');
  sh.getRange('A2:K2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 28);

  const headers = ['#', 'アーティスト名', 'ステージ', '出演時間', '宿泊タイプ', 'ホテル名', 'ケア担当', '到着便', '帰路便', '備考1', '備考2'];
  sh.getRange(3, 1, 1, headers.length).setValues([headers]);
  styleColHeader(sh.getRange(3, 1, 1, headers.length));
  sh.setRowHeight(3, 32);
  sh.setFrozenRows(3);

  const artists = [
    // DAY1
    [1,  'U-ichi',           'MAIN',  'DAY1 17:00-18:00', '旅館',   'にしむら旅館',  'MARIA', '', '', '', ''],
    [2,  'Dj Nobu',          'MAIN',  'DAY1 18:00-19:30', '旅館',   'にしむら旅館',  'TUI',   '', '', '', ''],
    [3,  'Shinichi Atobe',   'MAIN',  'DAY1 19:30-21:00', '旅館',   '花屋徳兵衛',    'LOE',   '', '', '', ''],
    [4,  'Yoshinori Hayashi','MAIN',  'DAY1 21:00-23:00', '旅館',   '花屋徳兵衛',    'BUNDO', '', '', '', ''],
    [5,  'HIKO',             'MAIN',  'DAY1 23:00-01:00', '旅館',   'いろは旅館',    'MARIA', '', '', '', ''],
    [6,  'K-HAND',           'MAIN',  'DAY1 01:00-02:30', '旅館',   'いろは旅館',    'TUI',   '', '', '', ''],
    [7,  'Masalo',           'MAIN',  'DAY1 02:30-04:00', 'キャンプ', 'キャンプエリア', 'LOE',  '', '', '', ''],
    [8,  'Kode9',            'MAIN',  'DAY1 04:00-06:00', '旅館',   'にしむら旅館',  'BUNDO', '', '', '', ''],
    // DAY2
    [9,  'Noproblem',        'MAIN',  'DAY2 14:00-16:00', 'キャンプ', 'キャンプエリア', 'MARIA','', '', '', ''],
    [10, 'Masahiro Takahashi','MAIN', 'DAY2 16:00-17:30', '旅館',   'にしむら旅館',  'TUI',   '', '', '', ''],
    [11, 'Yusuke Hirado',    'MAIN',  'DAY2 17:30-19:00', '旅館',   'にしむら旅館',  'LOE',   '', '', '', ''],
    [12, 'Jonatan Backelie', 'MAIN',  'DAY2 19:00-20:30', '旅館',   '花屋徳兵衛',    'BUNDO', '', '', '', ''],
    [13, 'Mio',              'MAIN',  'DAY2 20:30-22:00', '旅館',   '花屋徳兵衛',    'MARIA', '', '', '', ''],
    [14, 'Kuniyuki',         'MAIN',  'DAY2 22:00-00:00', '旅館',   'いろは旅館',    'TUI',   '', '', '', ''],
    [15, 'Crue-L Grand Orchestra', 'MAIN', 'DAY2 00:00-02:00', '旅館', 'いろは旅館', 'LOE',  '', '', '', ''],
    [16, 'Vakula',           'MAIN',  'DAY2 02:00-04:00', '旅館',   'にしむら旅館',  'BUNDO', '', '', '', ''],
    [17, 'dj Stingray',      'MAIN',  'DAY2 04:00-06:00', '旅館',   'にしむら旅館',  'MARIA', '', '', '', ''],
    [18, 'AFAR',             'MAIN',  'DAY2 06:00-08:00', 'キャンプ', 'キャンプエリア', 'TUI', '', '', '', ''],
    [19, 'Headless Horseman', 'MAIN', 'DAY2 08:00-10:00', '旅館',   '花屋徳兵衛',    'LOE',   '', '', '', ''],
    [20, 'Saito Koji',       'MAIN',  'DAY2 10:00-12:00', '旅館',   '花屋徳兵衛',    'BUNDO', '', '', '', ''],
    // DAY3
    [21, 'MAKITO',           'MAIN',  'DAY3 14:00-16:00', 'キャンプ', 'キャンプエリア', 'MARIA','', '', '', ''],
    [22, 'Maara',            'MAIN',  'DAY3 16:00-18:00', '旅館',   'にしむら旅館',  'TUI',   '', '', '', ''],
    [23, 'DJ Slip',          'MAIN',  'DAY3 18:00-20:00', '旅館',   'にしむら旅館',  'LOE',   '', '', '', ''],
    [24, 'Rui Ho',           'MAIN',  'DAY3 20:00-22:00', '旅館',   'いろは旅館',    'BUNDO', '', '', '', ''],
    [25, 'dj marfeu',        'MAIN',  'DAY3 22:00-00:00', '旅館',   'いろは旅館',    'MARIA', '', '', '', ''],
    [26, 'Octa Octa',        'MAIN',  'DAY3 00:00-02:00', '旅館',   '花屋徳兵衛',    'TUI',   '', '', '', ''],
    [27, 'Blawan',           'MAIN',  'DAY3 02:00-04:00', '旅館',   '花屋徳兵衛',    'LOE',   '', '', '', ''],
    [28, 'JASSS',            'MAIN',  'DAY3 04:00-06:00', 'キャンプ', 'キャンプエリア', 'BUNDO','', '', '', ''],
    // Live Paint
    [29, 'Noid',             'LIVE PAINT', 'DAY1 全日', 'キャンプ', 'キャンプエリア', 'MARIA', '', '', 'ライブペイント', ''],
    [30, 'Gaku',             'LIVE PAINT', 'DAY2 全日', 'キャンプ', 'キャンプエリア', 'TUI',   '', '', 'ライブペイント', ''],
    [31, 'Maka',             'LIVE PAINT', 'DAY2 全日', 'キャンプ', 'キャンプエリア', 'LOE',   '', '', 'ライブペイント', ''],
    [32, 'Hari',             'LIVE PAINT', 'DAY3 全日', 'キャンプ', 'キャンプエリア', 'BUNDO', '', '', 'ライブペイント', ''],
    [33, 'Kenzo Ouchi',      'LIVE PAINT', 'DAY3 全日', '旅館',    'にしむら旅館',   'MARIA', '', '', 'ライブペイント', ''],
    [34, 'yuma',             'MAIN',  'DAY1 スペシャル', '旅館',   'にしむら旅館',  'TUI',   '', '', 'スペシャル出演', ''],
    [35, 'DJ Mimosa',        'MAIN',  'DAY2 スペシャル', '旅館',   'いろは旅館',    'LOE',   '', '', 'スペシャル出演', ''],
  ];

  const careColorMap = {
    'MARIA': [C.MARIA_BG, C.MARIA_FG],
    'TUI':   [C.TUI_BG,   C.TUI_FG],
    'LOE':   [C.LOE_BG,   C.LOE_FG],
    'BUNDO': [C.BUNDO_BG, C.BUNDO_FG],
  };

  artists.forEach((row, i) => {
    const r = 4 + i;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const careStaff = row[6];
    const [bg, fg] = careColorMap[careStaff] || [i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG, C.DARK];
    sh.getRange(r, 1, 1, 11).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    // ケア担当列は太字
    sh.getRange(r, 7).setFontWeight('bold');
    sh.setRowHeight(r, 30);
  });
}

// ───────────────────────────────────────────
// 🎵 タイムテーブル
// ───────────────────────────────────────────

function createTimeTableSheet(ss) {
  const sh = getOrCreateSheet(ss, '🎵 タイムテーブル');
  sh.clear();
  sh.setTabColor('#1B4D7B');

  const colWidths = [30, 100, 160, 80, 100, 80, 200];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('A1:G1').merge().setValue('🎵 MOMENT 2026 — タイムテーブル');
  styleH1(sh.getRange('A1:G1'));
  sh.setRowHeight(1, 48);

  const headers = ['#', 'DAY', 'アーティスト', 'ステージ', '開始時間', '終了時間', '備考'];
  sh.getRange(2, 1, 1, headers.length).setValues([headers]);
  styleColHeader(sh.getRange(2, 1, 1, headers.length));
  sh.setRowHeight(2, 32);
  sh.setFrozenRows(2);

  const timetable = [
    // DAY1
    [1,  'DAY1 7/3(金)', 'U-ichi',              'MAIN', '17:00', '18:00', 'OPEN SET'],
    [2,  'DAY1 7/3(金)', 'Dj Nobu',             'MAIN', '18:00', '19:30', ''],
    [3,  'DAY1 7/3(金)', 'Shinichi Atobe',       'MAIN', '19:30', '21:00', ''],
    [4,  'DAY1 7/3(金)', 'Yoshinori Hayashi',    'MAIN', '21:00', '23:00', ''],
    [5,  'DAY1 7/3(金)', 'HIKO',                 'MAIN', '23:00', '01:00', ''],
    [6,  'DAY1 7/3(金)', 'K-HAND',               'MAIN', '01:00', '02:30', ''],
    [7,  'DAY1 7/3(金)', 'Masalo',               'MAIN', '02:30', '04:00', ''],
    [8,  'DAY1 7/3(金)', 'Kode9',                'MAIN', '04:00', '06:00', 'SUNRISE'],
    // DAY2
    [9,  'DAY2 7/4(土)', 'Noproblem',            'MAIN', '14:00', '16:00', 'OPENING'],
    [10, 'DAY2 7/4(土)', 'Masahiro Takahashi',   'MAIN', '16:00', '17:30', ''],
    [11, 'DAY2 7/4(土)', 'Yusuke Hirado',        'MAIN', '17:30', '19:00', ''],
    [12, 'DAY2 7/4(土)', 'Jonatan Backelie',     'MAIN', '19:00', '20:30', ''],
    [13, 'DAY2 7/4(土)', 'Mio',                  'MAIN', '20:30', '22:00', ''],
    [14, 'DAY2 7/4(土)', 'Kuniyuki',             'MAIN', '22:00', '00:00', ''],
    [15, 'DAY2 7/4(土)', 'Crue-L Grand Orchestra','MAIN','00:00', '02:00', 'スペシャル'],
    [16, 'DAY2 7/4(土)', 'Vakula',               'MAIN', '02:00', '04:00', ''],
    [17, 'DAY2 7/4(土)', 'dj Stingray',          'MAIN', '04:00', '06:00', ''],
    [18, 'DAY2 7/4(土)', 'AFAR',                 'MAIN', '06:00', '08:00', 'SUNRISE'],
    [19, 'DAY2 7/4(土)', 'Headless Horseman',    'MAIN', '08:00', '10:00', ''],
    [20, 'DAY2 7/4(土)', 'Saito Koji',           'MAIN', '10:00', '12:00', 'MORNING CLOSE'],
    // DAY3
    [21, 'DAY3 7/5(日)', 'MAKITO',               'MAIN', '14:00', '16:00', 'OPENING'],
    [22, 'DAY3 7/5(日)', 'Maara',                'MAIN', '16:00', '18:00', ''],
    [23, 'DAY3 7/5(日)', 'DJ Slip',              'MAIN', '18:00', '20:00', ''],
    [24, 'DAY3 7/5(日)', 'Rui Ho',               'MAIN', '20:00', '22:00', ''],
    [25, 'DAY3 7/5(日)', 'dj marfeu',            'MAIN', '22:00', '00:00', ''],
    [26, 'DAY3 7/5(日)', 'Octa Octa',            'MAIN', '00:00', '02:00', ''],
    [27, 'DAY3 7/5(日)', 'Blawan',               'MAIN', '02:00', '04:00', ''],
    [28, 'DAY3 7/5(日)', 'JASSS',                'MAIN', '04:00', '06:00', 'CLOSING SUNRISE'],
    // Live Paint
    [29, 'DAY1-3', 'Noid',       'LIVE PAINT', 'DAY1 全日', '',      'ライブペイント'],
    [30, 'DAY1-3', 'Gaku',       'LIVE PAINT', 'DAY2 全日', '',      'ライブペイント'],
    [31, 'DAY1-3', 'Maka',       'LIVE PAINT', 'DAY2 全日', '',      'ライブペイント'],
    [32, 'DAY1-3', 'Hari',       'LIVE PAINT', 'DAY3 全日', '',      'ライブペイント'],
    [33, 'DAY1-3', 'Kenzo Ouchi','LIVE PAINT', 'DAY3 全日', '',      'ライブペイント'],
  ];

  const dayColorMap = {
    'DAY1 7/3(金)': [C.CAT_SOUND_BG,  C.CAT_SOUND_FG],
    'DAY2 7/4(土)': [C.CAT_MOMENT_BG, C.CAT_MOMENT_FG],
    'DAY3 7/5(日)': [C.CAT_DECO_BG,   C.CAT_DECO_FG],
    'DAY1-3':       [C.CAT_VIDEO_BG,   C.CAT_VIDEO_FG],
  };

  timetable.forEach((row, i) => {
    const r = 3 + i;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const day = row[1];
    const [bg, fg] = dayColorMap[day] || [i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG, C.DARK];
    sh.getRange(r, 1, 1, 7).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r, 3).setFontWeight('bold');
    sh.setRowHeight(r, 30);
  });
}

// ───────────────────────────────────────────
// 🍱 賄い管理
// ───────────────────────────────────────────

function createMakanaishiSheet(ss) {
  const sh = getOrCreateSheet(ss, '🍱 賄い管理');
  sh.clear();
  sh.setTabColor('#1B7B2C');

  const colWidths = [30, 180, 100, 80, 80, 80, 80, 80, 120];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('A1:I1').merge().setValue('🍱 MOMENT 2026 — 賄い管理（7/3〜7/5）');
  styleH1(sh.getRange('A1:I1'));
  sh.setRowHeight(1, 48);

  // スタッフ賄いセクション
  sh.getRange('A2:I2').merge().setValue('👥 スタッフ賄い');
  styleH2(sh.getRange('A2:I2'));
  sh.setRowHeight(2, 36);

  const staffHeaders = ['#', '名前', 'チーム', '7/3 昼', '7/3 夜', '7/4 昼', '7/4 夜', '7/5 昼', '備考'];
  sh.getRange(3, 1, 1, staffHeaders.length).setValues([staffHeaders]);
  styleColHeader(sh.getRange(3, 1, 1, staffHeaders.length));
  sh.setRowHeight(3, 30);

  const staffMeals = [
    [1,  'HI-C',       'MOMENT運営', '○', '○', '○', '○', '○', '全食事提供'],
    [2,  'MARIA',      'アーティストケア', '○', '○', '○', '○', '○', '全食事提供'],
    [3,  'TUI',        'アーティストケア', '○', '○', '○', '○', '○', '全食事提供'],
    [4,  'LOE',        'アーティストケア', '○', '○', '○', '○', '○', '全食事提供'],
    [5,  'BUNDO',      'アーティストケア', '○', '○', '○', '○', '○', '全食事提供'],
    [6,  '音響スタッフ1', '音響', '○', '○', '○', '○', '○', ''],
    [7,  '音響スタッフ2', '音響', '○', '○', '○', '○', '○', ''],
    [8,  '照明スタッフ1', '照明', '○', '○', '○', '○', '○', ''],
    [9,  '照明スタッフ2', '照明', '○', '○', '○', '○', '○', ''],
    [10, '電源スタッフ1', '電源', '○', '○', '○', '○', '○', ''],
    [11, 'BARスタッフ1', 'BAR',  '○', '○', '○', '○', '○', ''],
    [12, 'BARスタッフ2', 'BAR',  '○', '○', '○', '○', '○', ''],
    [13, '警備スタッフ1', '警備', '○', '○', '○', '○', '○', ''],
    [14, '警備スタッフ2', '警備', '○', '○', '○', '○', '○', ''],
    [15, '映像スタッフ1', '映像', '○', '○', '○', '○', '○', ''],
  ];

  staffMeals.forEach((row, i) => {
    const r = 4 + i;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const bg = i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG;
    sh.getRange(r, 1, 1, 9).setBackground(bg).setFontColor(C.DARK).setVerticalAlignment('middle')
      .setHorizontalAlignment('center')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r, 2).setHorizontalAlignment('left').setFontWeight('bold');
    sh.setRowHeight(r, 28);
  });

  const secRow = 4 + staffMeals.length + 1;

  // アーティスト賄いセクション
  sh.getRange(secRow, 1, 1, 9).merge().setValue('🎤 アーティスト食事・ライダー');
  styleH2(sh.getRange(secRow, 1, 1, 9));
  sh.setRowHeight(secRow, 36);

  const artistHeaders = ['#', 'アーティスト名', 'ケア担当', '7/3', '7/4', '7/5', 'アレルギー', 'ライダー要求', '備考'];
  sh.getRange(secRow + 1, 1, 1, artistHeaders.length).setValues([artistHeaders]);
  styleColHeader(sh.getRange(secRow + 1, 1, 1, artistHeaders.length));
  sh.setRowHeight(secRow + 1, 30);

  const artistMeals = [
    [1,  'Kode9',                'BUNDO', '', '○', '', '', '', ''],
    [2,  'Dj Nobu',              'TUI',   '○', '○', '', '', '', ''],
    [3,  'Shinichi Atobe',       'LOE',   '○', '', '', '', '', ''],
    [4,  'Yoshinori Hayashi',    'BUNDO', '○', '', '', '', '', ''],
    [5,  'HIKO',                 'MARIA', '○', '', '', '', '', ''],
    [6,  'Vakula',               'BUNDO', '', '○', '', '', '', ''],
    [7,  'Kuniyuki',             'TUI',   '', '○', '', '', '', ''],
    [8,  'Rui Ho',               'BUNDO', '', '', '○', '', '', ''],
    [9,  'Octa Octa',            'TUI',   '', '', '○', 'グルテンフリー', '', ''],
    [10, 'Blawan',               'LOE',   '', '', '○', '', 'Red Bull 24本', ''],
  ];

  artistMeals.forEach((row, i) => {
    const r = secRow + 2 + i;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const careStaff = row[2];
    const careColorMap = { 'MARIA': [C.MARIA_BG, C.MARIA_FG], 'TUI': [C.TUI_BG, C.TUI_FG], 'LOE': [C.LOE_BG, C.LOE_FG], 'BUNDO': [C.BUNDO_BG, C.BUNDO_FG] };
    const [bg, fg] = careColorMap[careStaff] || [i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG, C.DARK];
    sh.getRange(r, 1, 1, 9).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r, 2).setFontWeight('bold');
    sh.setRowHeight(r, 28);
  });

  sh.setFrozenRows(3);
}

// ───────────────────────────────────────────
// 📞 スタッフ緊急連絡先
// ───────────────────────────────────────────

function createContactSheet(ss) {
  const sh = getOrCreateSheet(ss, '📞 スタッフ緊急連絡先');
  sh.clear();
  sh.setTabColor('#7B0000');

  const colWidths = [30, 160, 120, 140, 120, 180];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('A1:F1').merge().setValue('📞 MOMENT 2026 — スタッフ緊急連絡先');
  styleH1(sh.getRange('A1:F1'));
  sh.setRowHeight(1, 48);

  sh.getRange('A2:F2').merge()
    .setValue('⚠️ このシートの内容は関係者限定情報です。外部共有禁止。');
  sh.getRange('A2:F2').setBackground('#7B0000').setFontColor('#FFD700').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setFontWeight('bold');
  sh.setRowHeight(2, 28);

  const headers = ['#', '名前', 'チーム・役割', '携帯番号', 'LINE ID', '備考'];
  sh.getRange(3, 1, 1, headers.length).setValues([headers]);
  styleColHeader(sh.getRange(3, 1, 1, headers.length));
  sh.setRowHeight(3, 32);
  sh.setFrozenRows(3);

  const contacts = [
    [1,  'HI-C',  'MOMENT運営 / 総合統括', '（別途連絡）', '', '最終判断者'],
    [2,  'MARIA', 'アーティストケア / リーダー', '（別途連絡）', '', 'ケアチーム責任者'],
    [3,  'TUI',   'アーティストケア', '（別途連絡）', '', ''],
    [4,  'LOE',   'アーティストケア', '（別途連絡）', '', ''],
    [5,  'BUNDO', 'アーティストケア', '（別途連絡）', '', ''],
    [6,  '',      '音響チームリーダー', '（別途連絡）', '', ''],
    [7,  '',      '照明チームリーダー', '（別途連絡）', '', ''],
    [8,  '',      '電源チームリーダー', '（別途連絡）', '', ''],
    [9,  '',      'BARチームリーダー', '（別途連絡）', '', ''],
    [10, '',      '警備チームリーダー', '（別途連絡）', '', ''],
    [11, '',      '映像チームリーダー', '（別途連絡）', '', ''],
    [12, '',      '救護担当', '（別途連絡）', '', '緊急時最優先'],
    [13, '',      '洞川キャンプ場 管理者', '（別途連絡）', '', '会場緊急連絡先'],
    [14, '',      '最寄り警察（天川村）', '（別途連絡）', '', '緊急時'],
    [15, '',      '最寄り消防・救急', '119 / (別途)', '', '緊急時'],
  ];

  contacts.forEach((row, i) => {
    const r = 4 + i;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const bg = i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG;
    sh.getRange(r, 1, 1, 6).setBackground(bg).setFontColor(C.DARK).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    if (row[1]) sh.getRange(r, 2).setFontWeight('bold');
    sh.setRowHeight(r, 30);
  });
}

// ───────────────────────────────────────────
// シート並び順の整理
// ───────────────────────────────────────────

function reorderSheets(ss) {
  const ORDER = [
    '🌟 表紙',
    '📅 工程表（全体）',
    '🎤 アーティストケア',
    '🎵 タイムテーブル',
    '🍱 賄い管理',
    '📞 スタッフ緊急連絡先',
    // ボット連携シートは後ろに残す（順序はそのまま）
  ];

  ORDER.forEach((name, targetIndex) => {
    const sh = ss.getSheetByName(name);
    if (sh) ss.moveActiveSheet(targetIndex + 1); // 1-indexed
  });

  // より確実な方法で並べ直し
  const sheets = ss.getSheets();
  ORDER.forEach((name) => {
    const sh = ss.getSheetByName(name);
    if (sh) {
      ss.setActiveSheet(sh);
      ss.moveActiveSheet(ORDER.indexOf(name) + 1);
    }
  });
}

// ───────────────────────────────────────────
// ヘルパー関数
// ───────────────────────────────────────────

function getOrCreateSheet(ss, name) {
  if (BOT_PROTECTED.includes(name)) {
    throw new Error('ボット保護シートは変更できません: ' + name);
  }
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    Logger.log('新規シート作成: ' + name);
  } else {
    Logger.log('既存シートをクリアして再構築: ' + name);
  }
  return sh;
}

function styleH1(range) {
  range.setBackground(C.H1_BG)
    .setFontColor(C.GOLD)
    .setFontSize(16)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  range.getSheet().setRowHeight(range.getRow(), 52);
}

function styleH2(range) {
  range.setBackground(C.H2_BG)
    .setFontColor(C.WHITE)
    .setFontSize(13)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
}

function styleColHeader(range) {
  range.setBackground(C.COL_HDR_BG)
    .setFontColor(C.WHITE)
    .setFontSize(10)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#111133', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}
