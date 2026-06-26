/**
 * MOMENT 2026 — マスタースプレッドシート 再構築スクリプト v2
 *
 * 対象スプシ: 1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ
 * 目的: ボット連携シートを一切触らずに、運営用シートを新規追加/再構築する
 *       工程表3種 + 賄い管理（人数表記）+ アーティストケア + タイムテーブル + 緊急連絡先
 *
 * 実行方法: setupAllNewSheets_v2() を Apps Script エディタから手動実行
 *
 * ⚠️ BOT_PROTECTED のシートは絶対に変更・削除しない
 * ⚠️ データはLINEグループチャットから確認された情報のみ使用
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

const LINKS = {
  schedule:   '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY',
  tasks:      '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ',
  volunteer:  '1tVEmUOELKBQTkDGew6jRmWaqqlCLwz61wIvRCKFuF_Q',
  artist:     '1h7HV6ZfnDElblK4nJ_dbtKgAOaNnB1olv2A7946GjYo',
  vendor:     '1ULD9TcMRJDMF1k-i4CBJEX3M_DT2TRLohTQ-xugZTCA',
  entrance:   '1ncj9sVeOKFhqavsdo4hsjaQ2f5LLeMptBxHSQTgwP0g',
};

// ───────────────────────────────────────────
// カラーパレット
// ───────────────────────────────────────────

const C = {
  H1_BG:        '#0D0D1A',
  H2_BG:        '#1C1C3C',
  COL_HDR_BG:   '#2D2D6B',
  ROW_A_BG:     '#FFFFFF',
  ROW_B_BG:     '#F2F2FA',
  WHITE:        '#FFFFFF',
  DARK:         '#0D0D1A',
  GOLD:         '#C9A84C',
  ALERT_BG:     '#FFF3CD',
  ALERT_FG:     '#7B4F00',
  MARIA_BG:     '#FCEEF5', MARIA_FG:  '#7B1B5E',
  TUI_BG:       '#EEF5FC', TUI_FG:    '#1B4D7B',
  LOE_BG:       '#EFFCF0', LOE_FG:    '#1B7B2C',
  BUNDO_BG:     '#FFF5EE', BUNDO_FG:  '#7B3B1B',
  CAT_MOMENT_BG: '#E8F5E9', CAT_MOMENT_FG: '#1E4D2B',
  CAT_SOUND_BG:  '#DDEEFF', CAT_SOUND_FG:  '#1A3B6B',
  CAT_LIGHT_BG:  '#FFF8DC', CAT_LIGHT_FG:  '#7B5A00',
  CAT_DECO_BG:   '#FFF0E6', CAT_DECO_FG:   '#7B2D00',
  CAT_POWER_BG:  '#FFE8E8', CAT_POWER_FG:  '#7B0000',
  CAT_VIDEO_BG:  '#F3E5F5', CAT_VIDEO_FG:  '#4A0E7B',
  CAT_BAR_BG:    '#E0F7FA', CAT_BAR_FG:    '#005070',
  CAT_STAGE_BG:  '#E8EAF6', CAT_STAGE_FG:  '#1A1A3C',
  CAT_GUARD_BG:  '#F1F8E9', CAT_GUARD_FG:  '#2D4D00',
  CAT_TRUCK_BG:  '#FFF9E6', CAT_TRUCK_FG:  '#6B4500',
  CAT_CLEAN_BG:  '#E8F8F5', CAT_CLEAN_FG:  '#0E5C48',
  CAT_KIDS_BG:   '#FEF9E7', CAT_KIDS_FG:   '#7D6608',
  PAID_BG:       '#E3F2FD', PAID_FG:       '#0D47A1',
  VOL_BG:        '#E8F5E9', VOL_FG:        '#1B5E20',
  TOTAL_BG:      '#263238', TOTAL_FG:      '#FFFFFF',
  SETUP_BG:      '#F3E5F5', SETUP_FG:      '#4A0E7B',
  TEARDOWN_BG:   '#FCE4EC', TEARDOWN_FG:   '#880E4F',
};

// ───────────────────────────────────────────
// メイン実行関数
// ───────────────────────────────────────────

function setupAllNewSheets_v2() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const existing = ss.getSheets().map(s => s.getName());
  const missing = BOT_PROTECTED.filter(n => !existing.includes(n));
  if (missing.length > 0) {
    Logger.log('⚠️ 保護シートが見つかりません（スキップ）: ' + missing.join(', '));
  }

  Logger.log('🌟 表紙 作成中...');
  createDashboardSheet_v2(ss);

  Logger.log('📅 工程表（全体） 作成中...');
  createScheduleSheet_v2(ss);

  Logger.log('📅 工程表（MOMENTチームのみ） 作成中...');
  createMomentOnlyScheduleSheet(ss);

  Logger.log('🚛 トラック運行表 作成中...');
  createTruckScheduleSheet(ss);

  Logger.log('🎤 アーティストケア 作成中...');
  createArtistCareSheet_v2(ss);

  Logger.log('🎵 タイムテーブル 作成中...');
  createTimeTableSheet_v2(ss);

  Logger.log('🍱 賄い管理 作成中...');
  createMakanaishiSheet_v2(ss);

  Logger.log('📞 スタッフ緊急連絡先 作成中...');
  createContactSheet_v2(ss);

  Logger.log('📂 シート順番整理中...');
  reorderSheets_v2(ss);

  Logger.log('✅ 全シート再構築完了！');
  SpreadsheetApp.flush();
}

// ───────────────────────────────────────────
// 🌟 表紙/ダッシュボード
// ───────────────────────────────────────────

function createDashboardSheet_v2(ss) {
  const sh = getOrCreateSheet(ss, '🌟 表紙');
  sh.clear();
  sh.setTabColor('#C9A84C');

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
  subRange.setValue('2026年7月3日（金）〜 7月5日（日）｜奈良県天川村・洞川キャンプ場（前売全810枚 SOLD OUT）');
  subRange.setBackground(C.H2_BG).setFontColor(C.GOLD)
    .setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 32);

  sh.getRange('B3:E3').merge().setValue('').setBackground(C.H1_BG);
  sh.setRowHeight(3, 8);

  const secRange = sh.getRange('B4:E4');
  secRange.merge();
  secRange.setValue('📎 関連スプレッドシート一覧');
  styleH2(secRange);
  sh.setRowHeight(4, 36);

  sh.getRange(5, 2, 1, 4).setValues([['', 'スプレッドシート名', 'URL（クリックして開く）', '担当/備考']]);
  styleColHeader(sh.getRange('B5:E5'));
  sh.setRowHeight(5, 30);

  const linkData = [
    ['🗓', '工程表（スケジュール管理）',   'https://docs.google.com/spreadsheets/d/' + LINKS.schedule + '/edit',   '全体スケジュール'],
    ['✅', 'タスク管理（本スプシ）',        'https://docs.google.com/spreadsheets/d/' + LINKS.tasks + '/edit',      'ジュニアBot連携'],
    ['📋', 'ボランティア回答シート',         'https://docs.google.com/spreadsheets/d/' + LINKS.volunteer + '/edit',  'Googleフォーム連携'],
    ['🎤', 'アーティスト管理シート',         'https://docs.google.com/spreadsheets/d/' + LINKS.artist + '/edit',    'ケア・宿泊管理'],
    ['🪟', '出店管理シート',                 'https://docs.google.com/spreadsheets/d/' + LINKS.vendor + '/edit',    '出店者情報'],
    ['🚪', 'エントランス管理シート',          'https://docs.google.com/spreadsheets/d/' + LINKS.entrance + '/edit', 'チケット・入場'],
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

  sh.getRange('B13:E13').merge().setValue('📂 このスプレッドシートのシート構成').setBackground(C.H2_BG)
    .setFontColor(C.WHITE).setFontSize(12).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(13, 36);

  const sheetInfo = [
    ['シート名', '内容', '備考'],
    ['🌟 表紙', 'ダッシュボード（本シート）', 'リンク集'],
    ['📅 工程表（全体）', '全体スケジュール 6/28〜7/8', '全チーム・設営〜撤収'],
    ['📅 工程表（MOMENTチーム）', 'MOMENT運営チームの工程のみ', 'コアスタッフ向け'],
    ['🚛 トラック運行表', 'トラック・車両の入出庫一覧', '日時・経由・担当'],
    ['🎤 アーティストケア', 'アーティストケア担当管理', 'MARIA/TUI/LOE/BUNDO'],
    ['🎵 タイムテーブル（暫定）', 'DAY1/DAY2/DAY3 出演順', 'ステージ・時間'],
    ['🍱 賄い管理', '食数管理（ボランティア/ギャラ発生別）', '7/3〜7/5 合計食数'],
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

  styleColHeader(sh.getRange(14, 2, 1, 3));
  sh.setRowHeight(14, 30);

  sheetInfo.forEach((row, i) => {
    const r = 14 + i;
    const isProtected = row[0].includes('ボット連携');
    const isBotSheet = BOT_PROTECTED.some(n => row[0] === n);
    const bg = isProtected ? C.H2_BG : isBotSheet ? '#FFF8DC' : i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG;
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
// 📅 工程表（全体）— 6/28〜7/8 全チーム
// ───────────────────────────────────────────

function createScheduleSheet_v2(ss) {
  const sh = getOrCreateSheet(ss, '📅 工程表（全体）');
  sh.clear();
  sh.setTabColor('#2D2D6B');

  const colWidths = [40, 110, 110, 220, 160, 160, 100, 200];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('A1:H1').merge().setValue('📅 MOMENT 2026 — 工程表（全体）6/28〜7/8');
  styleH1(sh.getRange('A1:H1'));
  sh.setRowHeight(1, 48);

  sh.getRange('A2:H2').merge()
    .setValue('確定データのみ掲載 ｜ 会場：奈良県天川村・洞川キャンプ場 ｜ 前売810枚 SOLD OUT');
  sh.getRange('A2:H2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 28);

  const headers = ['No.', '日付', 'カテゴリ', '作業内容', '担当チーム', '担当者', '場所', '備考'];
  sh.getRange(3, 1, 1, headers.length).setValues([headers]);
  styleColHeader(sh.getRange(3, 1, 1, headers.length));
  sh.setRowHeight(3, 32);
  sh.setFrozenRows(3);

  const schedule = [
    // ─── 事前準備フェーズ ───
    [1,  '6/28（日）', '設営',       '設営先着メンバー 現地入り（最早）',       '設営チーム',    'つづきけいすけ他', '洞川キャンプ場', '28〜29日着可'],
    [2,  '6/29（月）', '設営',       '大阪摂津倉庫 部材積み込み（14:00〜）',   '設営チーム',    'Mike Senoh他',   '大阪府摂津市',  '3時間程度 食事あり'],
    [3,  '6/29（月）', '設営',       '設営先着メンバー 現地入り',               '設営チーム',    '複数',           '洞川キャンプ場', '6/29着予定あり'],
    // ─── 設営フェーズ ───
    [4,  '6/30（火）', '設営',       'Shinovi Creation 2T+4Tトラック 朝イン',  'デコ/設営',     'ハギワラハジメ, ニシタニショウ', '洞川キャンプ場', '2Tロング+4T平ﾄﾗ'],
    [5,  '6/30（火）', '設営',       '設営開始（全体）6/30〜7/2',               '全設営チーム',  '南城 祐介 他',   '洞川キャンプ場', 'テント設営・電源敷設等'],
    [6,  '7/1（水）',  '電源',       '後藤電気 発電機・電源機材 夜イン',        '電源チーム',    '後藤電気',       '洞川キャンプ場', '電源ドラム30〜50m×4〜5本'],
    [7,  '7/1（水）',  'レンタル',   '西尾レントオール 機材 9:00着',            'レンタル',      '西尾レントオール', '洞川キャンプ場', '7/7(火)11:00に引取'],
    [8,  '7/1（水）',  '音響',       '音響機材搬入 (ユースケ PA)',              '音響チーム',    'ユースケ(沖縄)', '洞川キャンプ場', 'ユースケさん水入り'],
    [9,  '7/2（木）',  'BAR',        'BAR冷凍車 午前着 ・ BAR設営',             'BARチーム',     '担当TBD',        'BARエリア',     '冷凍車 7/2木午前着'],
    [10, '7/2（木）',  'カメラ',     '撮影チーム現地入り',                       '撮影チーム',    'マヤ（16-17時）', '洞川キャンプ場', '一部7/3入り'],
    [11, '7/2（木）',  '設営',       '設営メンバー 夜中入り（複数）',            '設営チーム',    '東谷隆太,三賀真生他', '洞川キャンプ場', '7/2夜中〜7/3朝予定'],
    // ─── 本番前日 7/3（DAY1）───
    [12, '7/3（金）',  'MOMENT運営', '場内最終確認・エントランス設営完了',       'MOMENT運営',    '全コアスタッフ', '洞川キャンプ場', ''],
    [13, '7/3（金）',  '音響',       '音響システム本設・テスト',                 '音響チーム',    'ユースケ, タク', 'メインステージ', 'V10 ﾒｲﾝ機材'],
    [14, '7/3（金）',  '照明',       'ライト・レーザー設置',                     '照明/演出',     '山脇さん',       'メインステージ', 'レーザー演出'],
    [15, '7/3（金）',  '映像',       'VJ セットアップ',                          '映像チーム',    'ハルキ(VJ)',     'メインステージ', ''],
    [16, '7/3（金）',  'デコ',       'OLEO デコレーション最終仕上げ',            'デコチーム',    'OLEO, Shinovi', 'メインステージ', 'R領域×OLEO'],
    [17, '7/3（金）',  '警備',       '警備員5名 配置開始（9:00）',               '警備チーム',    '警備員5名',      'エントランス他', '吉野警察届出済'],
    [18, '7/3（金）',  'エントランス','ゲートオープン 9:00',                    '受付チーム',    '＆you⭐︎, 田中カズハ他', 'エントランス', 'ボラスタ: 場内11〜12名'],
    [19, '7/3（金）',  '舞台監督',   'サウンドチェック開始',                     '舞台監督',      'Joshua SW, ルウジ', 'メインステージ', ''],
    [20, '7/3（金）',  'MOMENT運営', 'OPEN 14:00 — DAY1 スタート',              '全スタッフ',    '',               '洞川キャンプ場', '音楽 14:00〜翌4:00'],
    [21, '7/3（金）',  'エントランス','ゲートクローズ 22:00',                   '受付チーム',    '',               'エントランス',   ''],
    // ─── DAY2 ───
    [22, '7/4（土）',  'エントランス','ゲートオープン 9:00',                    '受付チーム',    '',               'エントランス',   '音楽 11:00〜翌7:00'],
    [23, '7/4（土）',  '舞台監督',   'サウンドチェック（当日分）',               '舞台監督',      'Joshua SW, ルウジ', 'メインステージ', ''],
    [24, '7/4（土）',  'アーティストケア', 'アーティスト送迎・ケア対応',         'ケアチーム',    'MARIA/TUI/LOE/BUNDO', '各宿泊施設', ''],
    [25, '7/4（土）',  'MOMENT運営', 'DAY2 運営・全体統括',                      '全スタッフ',    '',               '洞川キャンプ場', ''],
    [26, '7/4（土）',  'エントランス','ゲートクローズ 20:00',                   '受付チーム',    '',               'エントランス',   ''],
    // ─── DAY3 ───
    [27, '7/5（日）',  'エントランス','ゲートオープン 9:00',                    '受付チーム',    '',               'エントランス',   '音楽 10:00〜18:00'],
    [28, '7/5（日）',  'MOMENT運営', 'DAY3 運営・クロージング',                  '全スタッフ',    '',               '洞川キャンプ場', ''],
    [29, '7/5（日）',  'MOMENT運営', 'CLOSE 18:00 → After Party 24:00',         '全スタッフ',    '',               '洞川キャンプ場', 'After Party 18-24時'],
    [30, '7/5（日）',  'エントランス','ゲートクローズ 20:00',                   '受付チーム',    '',               'エントランス',   ''],
    // ─── 撤収フェーズ ───
    [31, '7/6（月）',  '撤収',       '全体撤収・場内清掃開始',                   '全スタッフ',    '南城 祐介 他',   '洞川キャンプ場', '撤収期間: 7/6〜7/8午前'],
    [32, '7/6（月）',  '音響',       '音響機材撤収・梱包',                        '音響チーム',    'ユースケ,タク',  'メインステージ', ''],
    [33, '7/6（月）',  'デコ',       'OLEO デコレーション撤収',                  'デコチーム',    'OLEO, Shinovi', 'メインステージ', ''],
    [34, '7/7（火）',  'レンタル',   '西尾レントオール 機材引取 11:00',           'レンタル',      '西尾レントオール', '洞川キャンプ場', ''],
    [35, '7/7（火）',  '設営/撤収',  'Shinovi Creation トラック 午後アウト',      'デコ/設営',     'ハギワラハジメ', '洞川キャンプ場', '2T+4Tトラック 出発'],
    [36, '7/8（火）',  '撤収',       '撤収完了・キャンプ場返却',                  '全スタッフ',    '全員',           '洞川キャンプ場', '撤収期間終了'],
  ];

  const catColorMap = {
    'MOMENT運営':       [C.CAT_MOMENT_BG, C.CAT_MOMENT_FG],
    '音響':             [C.CAT_SOUND_BG,  C.CAT_SOUND_FG],
    '照明/演出':        [C.CAT_LIGHT_BG,  C.CAT_LIGHT_FG],
    'デコ':             [C.CAT_DECO_BG,   C.CAT_DECO_FG],
    '電源':             [C.CAT_POWER_BG,  C.CAT_POWER_FG],
    '映像':             [C.CAT_VIDEO_BG,  C.CAT_VIDEO_FG],
    'BAR':              [C.CAT_BAR_BG,    C.CAT_BAR_FG],
    '舞台監督':         [C.CAT_STAGE_BG,  C.CAT_STAGE_FG],
    '警備':             [C.CAT_GUARD_BG,  C.CAT_GUARD_FG],
    'アーティストケア': [C.MARIA_BG,      C.MARIA_FG],
    'エントランス':     [C.TUI_BG,        C.TUI_FG],
    '設営':             [C.SETUP_BG,      C.SETUP_FG],
    '撤収':             [C.TEARDOWN_BG,   C.TEARDOWN_FG],
    '設営/撤収':        [C.TEARDOWN_BG,   C.TEARDOWN_FG],
    'カメラ':           [C.CAT_VIDEO_BG,  C.CAT_VIDEO_FG],
    'レンタル':         [C.CAT_TRUCK_BG,  C.CAT_TRUCK_FG],
  };

  schedule.forEach((row, i) => {
    const r = 4 + i;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const cat = row[2];
    const [bg, fg] = catColorMap[cat] || [i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG, C.DARK];
    sh.getRange(r, 1, 1, 8).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r, 3).setFontWeight('bold');
    sh.setRowHeight(r, 32);
  });
}

// ───────────────────────────────────────────
// 📅 工程表（MOMENTチームのみ）
// ───────────────────────────────────────────

function createMomentOnlyScheduleSheet(ss) {
  const sh = getOrCreateSheet(ss, '📅 工程表（MOMENTチーム）');
  sh.clear();
  sh.setTabColor('#1E4D2B');

  const colWidths = [40, 110, 100, 260, 160, 180];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('A1:F1').merge().setValue('📅 MOMENT 2026 — 工程表（MOMENTチーム専用）');
  styleH1(sh.getRange('A1:F1'));
  sh.setRowHeight(1, 48);

  sh.getRange('A2:F2').merge()
    .setValue('コアスタッフ向け ｜ HI-C / MARIA / 妹尾真行 / YMT / 南城 祐介 / 中道大雅');
  sh.getRange('A2:F2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 28);

  const headers = ['No.', '日付', '時刻', '内容・タスク', '担当', '備考'];
  sh.getRange(3, 1, 1, headers.length).setValues([headers]);
  styleColHeader(sh.getRange(3, 1, 1, headers.length));
  sh.setRowHeight(3, 32);
  sh.setFrozenRows(3);

  // ブロック定義: [no, 日付, 時刻, 内容, 担当, 備考, カテゴリ色キー]
  const momentSchedule = [
    // 事前
    [1,  '6/29（月）', '14:00〜', '大阪摂津倉庫 部材積み込み監督',         'Mike Senoh',     '3時間・食事あり・補助2名募集', 'pre'],
    [2,  '6/30（火）', '朝〜',    '設営開始 (Shinovi Creation IN確認)',      '南城 祐介',      '2Tロング+4T平 搬入確認', 'setup'],
    [3,  '7/1（水）',  '9:00〜',  '西尾レントオール 受け入れ',               '担当者TBD',      '7/7(火)11:00まで', 'setup'],
    [4,  '7/1（水）',  '夜〜',    '後藤電気 電源機材搬入確認',               '担当者TBD',      '電源ドラム×4-5台', 'setup'],
    [5,  '7/2（木）',  '午前',    'BAR冷凍車 受け入れ確認',                  'BARリーダー',    '', 'setup'],
    [6,  '7/2（木）',  '終日',    '設営最終確認・動線チェック',               'HI-C / 石田翔馬', '本番前日', 'ops'],
    // 本番Day1
    [7,  '7/3（金）',  '〜8:00',  'スタッフ現地集合・体制確認ミーティング', 'HI-C / 全員',    '', 'day1'],
    [8,  '7/3（金）',  '9:00',    'ゲートオープン・エントランス始動',         '受付チーム',     'ボラスタ場内11-12名+場外8-9名', 'day1'],
    [9,  '7/3（金）',  '9:00',    '警備員5名 配置完了確認',                  '石田翔馬',       '吉野警察届出済', 'day1'],
    [10, '7/3（金）',  '〜14:00', 'サウンドチェック完了確認',                '舞台監督(Joshua/ルウジ)', 'V10機材確認', 'day1'],
    [11, '7/3（金）',  '14:00',   '音楽スタート DAY1 OPEN',                  'HI-C / 全員',    '〜翌朝4:00', 'day1'],
    [12, '7/3（金）',  '22:00',   'ゲートクローズ',                          '受付チーム',     '', 'day1'],
    // 本番Day2
    [13, '7/4（土）',  '9:00',    'ゲートオープン Day2',                     '受付チーム',     '音楽 11:00〜翌7:00', 'day2'],
    [14, '7/4（土）',  '終日',    'アーティスト送迎・ケア対応',               'MARIA/TUI/LOE/BUNDO', '各宿泊施設→会場', 'day2'],
    [15, '7/4（土）',  '終日',    '賄い提供・スタッフ管理',                   'MOMENT運営',     '', 'day2'],
    [16, '7/4（土）',  '20:00',   'ゲートクローズ Day2',                     '受付チーム',     '', 'day2'],
    // 本番Day3
    [17, '7/5（日）',  '9:00',    'ゲートオープン Day3',                     '受付チーム',     '音楽 10:00〜18:00', 'day3'],
    [18, '7/5（日）',  '18:00',   'クロージング → After Party 開始',         'HI-C / 全員',    '〜24:00', 'day3'],
    [19, '7/5（日）',  '20:00',   'ゲートクローズ Day3',                     '受付チーム',     '', 'day3'],
    [20, '7/5（日）',  '24:00',   'After Party 終了・完全クローズ',          'HI-C',           '深夜片付け開始', 'day3'],
    // 撤収
    [21, '7/6（月）',  '終日',    '撤収作業開始（全体）',                    '南城 祐介 他',   '撤収期間: 7/6〜7/8午前', 'teardown'],
    [22, '7/7（火）',  '11:00',   '西尾レントオール 機材引取',               '担当者TBD',      '', 'teardown'],
    [23, '7/7（火）',  '午後',    'Shinovi Creation トラック OUT',            'ハギワラハジメ',  '2T+4T出発', 'teardown'],
    [24, '7/8（火）',  '午前',    '撤収完了・キャンプ場返却',                '全員',           '7/8午前中に完了予定', 'teardown'],
  ];

  const blockColors = {
    'pre':       [C.SETUP_BG,        C.SETUP_FG],
    'setup':     [C.SETUP_BG,        C.SETUP_FG],
    'ops':       [C.CAT_MOMENT_BG,   C.CAT_MOMENT_FG],
    'day1':      [C.CAT_SOUND_BG,    C.CAT_SOUND_FG],
    'day2':      [C.CAT_MOMENT_BG,   C.CAT_MOMENT_FG],
    'day3':      [C.CAT_DECO_BG,     C.CAT_DECO_FG],
    'teardown':  [C.TEARDOWN_BG,     C.TEARDOWN_FG],
  };

  // 日付ブロックヘッダーを挿入しながら書き込み
  let currentDate = '';
  let rowIdx = 4;

  momentSchedule.forEach((row) => {
    const date = row[1];
    if (date !== currentDate) {
      // 日付ブロックヘッダー
      sh.getRange(rowIdx, 1, 1, 6).merge().setValue('── ' + date + ' ──');
      sh.getRange(rowIdx, 1, 1, 6).setBackground(C.H2_BG).setFontColor(C.GOLD)
        .setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center')
        .setVerticalAlignment('middle');
      sh.setRowHeight(rowIdx, 32);
      rowIdx++;
      currentDate = date;
    }

    const [no, d, time, content, staff, note, colorKey] = row;
    sh.getRange(rowIdx, 1).setValue(no);
    sh.getRange(rowIdx, 2).setValue(d);
    sh.getRange(rowIdx, 3).setValue(time);
    sh.getRange(rowIdx, 4).setValue(content);
    sh.getRange(rowIdx, 5).setValue(staff);
    sh.getRange(rowIdx, 6).setValue(note);

    const [bg, fg] = blockColors[colorKey] || [C.ROW_A_BG, C.DARK];
    sh.getRange(rowIdx, 1, 1, 6).setBackground(bg).setFontColor(fg)
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(rowIdx, 4).setFontWeight('bold');
    sh.setRowHeight(rowIdx, 32);
    rowIdx++;
  });
}

// ───────────────────────────────────────────
// 🚛 トラック・車両 運行表
// ───────────────────────────────────────────

function createTruckScheduleSheet(ss) {
  const sh = getOrCreateSheet(ss, '🚛 トラック運行表');
  sh.clear();
  sh.setTabColor('#6B4500');

  const colWidths = [40, 120, 80, 120, 120, 160, 120, 200];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('A1:H1').merge().setValue('🚛 MOMENT 2026 — トラック・車両 運行表');
  styleH1(sh.getRange('A1:H1'));
  sh.setRowHeight(1, 48);

  sh.getRange('A2:H2').merge()
    .setValue('確定データのみ掲載（LINEグループ確認済） ｜ 未確定は「TBD」と記載');
  sh.getRange('A2:H2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 28);

  // ── セクション1：プロ車両（トラック・業者車両） ──
  sh.getRange('A3:H3').merge().setValue('🔷 プロ・業者車両');
  styleH2(sh.getRange('A3:H3'));
  sh.setRowHeight(3, 36);

  const truckHeaders = ['No.', '会社/チーム名', '車両台数', '車両種別', '入り日時', '経由/出発地', '撤収日時', '備考'];
  sh.getRange(4, 1, 1, truckHeaders.length).setValues([truckHeaders]);
  styleColHeader(sh.getRange(4, 1, 1, truckHeaders.length));
  sh.setRowHeight(4, 30);

  const truckData = [
    [1, 'Shinovi Creation\n（ハギワラハジメ・ニシタニショウ）', '2台', '2Tロングアルミバン＋4T平トラック', '6/30（火）朝', '大阪方面', '7/7（火）午後', 'デコ/設営全般 ✅確定'],
    [2, '西尾レントオール',                                    'TBD', 'レンタル機材車両',                 '7/1（水）9:00', '大阪方面',  '7/7（火）11:00', '機材レンタル引取 ✅確定'],
    [3, '後藤電気（GOTO DENKI）',                              'TBD', '電源機材車両',                     '7/1（水）夜',  '大阪方面',  '7/6以降',       '電源ドラム×4-5 ✅確定'],
    [4, 'BAR冷凍車',                                           '1台', '冷凍トラック',                     '7/2（木）午前', '大阪方面',  '7/6以降',       'BAR食材搬入 ✅確定'],
  ];

  truckData.forEach((row, i) => {
    const r = 5 + i;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const bg = i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG;
    sh.getRange(r, 1, 1, 8).setBackground(C.CAT_TRUCK_BG).setFontColor(C.CAT_TRUCK_FG)
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r, 2).setFontWeight('bold');
    sh.setRowHeight(r, 48);
  });

  // ── セクション2：スタッフ・ボランティア車両 ──
  const staffStart = 5 + truckData.length + 1;
  sh.getRange(staffStart, 1, 1, 8).merge().setValue('🔶 スタッフ・ボランティア車両');
  styleH2(sh.getRange(staffStart, 1, 1, 8));
  sh.setRowHeight(staffStart, 36);

  const staffHeaders2 = ['No.', '代表者名', '車両台数', '同乗者', '入り日時', '出発地', '撤収/帰路', '備考'];
  sh.getRange(staffStart + 1, 1, 1, staffHeaders2.length).setValues([staffHeaders2]);
  styleColHeader(sh.getRange(staffStart + 1, 1, 1, staffHeaders2.length));
  sh.setRowHeight(staffStart + 1, 30);

  // cfa02287 - ボランティア車両グループから確定
  const staffVehicles = [
    [1,  '井原麻耶（Maya Saito）',                     '1台', '1名',                   '7/2（木）16〜17時着', '大阪方面', 'TBD',          'カメラチーム ✅確定'],
    [2,  '三賀真生（Mao Sanga）',                      '1台', '大阪から2名同乗可',     '7/2（木）夜中',       '大阪発',   'TBD',          '設営ボランティア ✅確定'],
    [3,  '東谷隆太',                                   '1台', '1名',                   '7/2夜中〜7/3朝イチ', '大阪方面', 'TBD',          '設営ボランティア ✅確定'],
    [4,  '荻山',                                       '1台', '1名',                   '7/3（金）朝イチ',     '大阪方面', '7/5（日）午前発','設営ボランティア ✅確定'],
    [5,  '田中秋水（Shusui Tanaka）',                  '1台', '1名',                   '7/3（金）朝イチ',     '大阪方面', 'TBD',          '設営ボランティア ✅確定'],
    [6,  '市健太朗（Ichi）\n+ 東谷れお + 奥山星也',   '1台', '3名',                   '7/3（金）朝イチ',     '大阪方面', 'TBD',          '設営ボランティア ✅確定'],
    [7,  '橋本航（Wataru Hashimoto）',                 '1台', '1名',                   '7/3（金）夜着',       '大阪方面', 'TBD',          '設営ボランティア ✅確定'],
    [8,  '池上健太（KAGAMI JAPAN）',                   '1台', '1名',                   '7/3（金）14:00着',    'TBD',      'TBD',          'カメラボランティア ✅確定'],
    [9,  '濵田隆史（カメラ）',                         '0台', '0名（送迎依頼）',       '7/2（木）12:00',      '新大阪発（アーティスト送迎便）', 'TBD', 'カメラ ✅確定'],
  ];

  staffVehicles.forEach((row, i) => {
    const r = staffStart + 2 + i;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const bg = i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG;
    sh.getRange(r, 1, 1, 8).setBackground(bg).setFontColor(C.DARK)
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r, 2).setFontWeight('bold');
    sh.setRowHeight(r, 40);
  });

  // ── サマリー ──
  const sumRow = staffStart + 2 + staffVehicles.length + 1;
  sh.getRange(sumRow, 1, 1, 8).merge()
    .setValue('【車両台数サマリー】プロ業者: 2台以上（西尾・後藤TBD）｜スタッフ・ボランティア: 8台（濵田は0台・送迎）');
  sh.getRange(sumRow, 1, 1, 8).setBackground(C.H2_BG).setFontColor(C.GOLD)
    .setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setFontWeight('bold');
  sh.setRowHeight(sumRow, 36);

  sh.setFrozenRows(4);
}

// ───────────────────────────────────────────
// 🎤 アーティストケア
// ───────────────────────────────────────────

function createArtistCareSheet_v2(ss) {
  const sh = getOrCreateSheet(ss, '🎤 アーティストケア');
  sh.clear();
  sh.setTabColor('#7B1B5E');

  const colWidths = [30, 180, 70, 160, 80, 80, 80, 120, 120, 200];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('A1:J1').merge().setValue('🎤 MOMENT 2026 — アーティストケア管理');
  styleH1(sh.getRange('A1:J1'));
  sh.setRowHeight(1, 48);

  sh.getRange('A2:J2').merge()
    .setValue('ケアスタッフ: MARIA（ピンク）/ TUI（ブルー）/ LOE（グリーン）/ BUNDO（オレンジ）｜ ラインナップ詳細は確認後に記入');
  sh.getRange('A2:J2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 28);

  // 注意書き
  sh.getRange('A3:J3').merge()
    .setValue('⚠️ アーティストラインナップは公式確定後に記入 — 確定前の情報は記載しない（絶対間違えないよう正確な情報を）');
  sh.getRange('A3:J3').setBackground(C.ALERT_BG).setFontColor(C.ALERT_FG).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setFontWeight('bold');
  sh.setRowHeight(3, 28);

  const headers = ['#', 'アーティスト名', 'ステージ', '出演時間', '宿泊タイプ', 'ホテル名', 'ケア担当', '到着便', '帰路便', '備考'];
  sh.getRange(4, 1, 1, headers.length).setValues([headers]);
  styleColHeader(sh.getRange(4, 1, 1, headers.length));
  sh.setRowHeight(4, 32);
  sh.setFrozenRows(4);

  // 確認済みケアチーム情報
  const careColorMap = {
    'MARIA': [C.MARIA_BG, C.MARIA_FG],
    'TUI':   [C.TUI_BG,   C.TUI_FG],
    'LOE':   [C.LOE_BG,   C.LOE_FG],
    'BUNDO': [C.BUNDO_BG, C.BUNDO_FG],
    'TBD':   [C.ALERT_BG, C.ALERT_FG],
  };

  // 確定行数分の空行（ラインナップ確定後に記入用）
  // 30枠を用意
  for (let i = 0; i < 30; i++) {
    const r = 5 + i;
    const careOrder = ['MARIA', 'TUI', 'LOE', 'BUNDO'];
    const care = 'TBD';
    sh.getRange(r, 1).setValue(i + 1);
    sh.getRange(r, 2).setValue('（ラインナップ確定後に記入）');
    sh.getRange(r, 3).setValue('MAIN');
    sh.getRange(r, 4).setValue('');
    sh.getRange(r, 5).setValue('');
    sh.getRange(r, 6).setValue('');
    sh.getRange(r, 7).setValue(careOrder[i % 4]);
    sh.getRange(r, 8).setValue('');
    sh.getRange(r, 9).setValue('');
    sh.getRange(r, 10).setValue('');

    const assignedCare = careOrder[i % 4];
    const [bg, fg] = careColorMap[assignedCare] || [i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG, C.DARK];
    sh.getRange(r, 1, 1, 10).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r, 2).setFontStyle('italic');
    sh.getRange(r, 7).setFontWeight('bold');
    sh.setRowHeight(r, 30);
  }

  // ケア担当サマリーブロック
  const sumRow = 5 + 30 + 1;
  sh.getRange(sumRow, 1, 1, 10).merge().setValue('【ケア担当割当基準】 MARIA: 1番目/5番目/9番目… ｜ TUI: 2番目/6番目/10番目… ｜ LOE: 3番目/7番目… ｜ BUNDO: 4番目/8番目…');
  sh.getRange(sumRow, 1, 1, 10).setBackground(C.H2_BG).setFontColor(C.GOLD)
    .setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle').setFontWeight('bold');
  sh.setRowHeight(sumRow, 36);
}

// ───────────────────────────────────────────
// 🎵 タイムテーブル
// ───────────────────────────────────────────

function createTimeTableSheet_v2(ss) {
  const sh = getOrCreateSheet(ss, '🎵 タイムテーブル（暫定）');
  sh.clear();
  sh.setTabColor('#1B4D7B');

  const colWidths = [30, 110, 180, 80, 100, 80, 200];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('A1:G1').merge().setValue('🎵 MOMENT 2026 — タイムテーブル（暫定）');
  styleH1(sh.getRange('A1:G1'));
  sh.setRowHeight(1, 48);

  sh.getRange('A2:G2').merge()
    .setValue('⚠️ 暫定版 — ラインナップ公式発表後に更新 ｜ 確定済み情報のみ掲載');
  sh.getRange('A2:G2').setBackground(C.ALERT_BG).setFontColor(C.ALERT_FG).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setFontWeight('bold');
  sh.setRowHeight(2, 28);

  // 確定しているタイムスケジュール（開催時間）
  sh.getRange('A3:G3').merge().setValue('【確定済み開催時間】');
  styleH2(sh.getRange('A3:G3'));
  sh.setRowHeight(3, 32);

  const timeInfo = [
    ['', 'DAY1 7/3（金）', 'ゲート:  9:00〜22:00',  '音楽:  14:00〜翌4:00', '→約14時間', '', ''],
    ['', 'DAY2 7/4（土）', 'ゲート:  9:00〜20:00',  '音楽:  11:00〜翌7:00', '→約20時間', '', ''],
    ['', 'DAY3 7/5（日）', 'ゲート:  9:00〜20:00',  '音楽:  10:00〜18:00',  '→8時間', '', 'After Party 18:00〜24:00'],
  ];

  timeInfo.forEach((row, i) => {
    const r = 4 + i;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const dayColors = [
      [C.CAT_SOUND_BG, C.CAT_SOUND_FG],
      [C.CAT_MOMENT_BG, C.CAT_MOMENT_FG],
      [C.CAT_DECO_BG, C.CAT_DECO_FG],
    ];
    const [bg, fg] = dayColors[i];
    sh.getRange(r, 1, 1, 7).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
      .setFontWeight('bold')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.setRowHeight(r, 34);
  });

  // タイムテーブル本体
  sh.getRange('A7:G7').merge().setValue('【出演タイムテーブル — ラインナップ確定後に記入】');
  styleH2(sh.getRange('A7:G7'));
  sh.setRowHeight(7, 32);

  const headers = ['#', 'DAY', 'アーティスト名', 'ステージ', '開始時間', '終了時間', '備考'];
  sh.getRange(8, 1, 1, headers.length).setValues([headers]);
  styleColHeader(sh.getRange(8, 1, 1, headers.length));
  sh.setRowHeight(8, 30);
  sh.setFrozenRows(8);

  const dayColorMap = {
    'DAY1 7/3(金)': [C.CAT_SOUND_BG,  C.CAT_SOUND_FG],
    'DAY2 7/4(土)': [C.CAT_MOMENT_BG, C.CAT_MOMENT_FG],
    'DAY3 7/5(日)': [C.CAT_DECO_BG,   C.CAT_DECO_FG],
    'LIVE PAINT':   [C.CAT_VIDEO_BG,   C.CAT_VIDEO_FG],
  };

  // DAY1 (14:00〜翌4:00 ≒ 14時間 / 各2時間枠で約7組)
  const timetableTemplate = [];
  let no = 1;
  const day1Slots = ['14:00','16:00','18:00','20:00','22:00','00:00','02:00'];
  day1Slots.forEach((t, i) => {
    const end = day1Slots[i+1] || '04:00';
    timetableTemplate.push([no++, 'DAY1 7/3(金)', '（確定後に記入）', 'MAIN', t, end, '']);
  });
  const day2Slots = ['11:00','13:00','15:00','17:00','19:00','21:00','23:00','01:00','03:00','05:00'];
  day2Slots.forEach((t, i) => {
    const end = day2Slots[i+1] || '07:00';
    timetableTemplate.push([no++, 'DAY2 7/4(土)', '（確定後に記入）', 'MAIN', t, end, '']);
  });
  const day3Slots = ['10:00','12:00','14:00','16:00'];
  day3Slots.forEach((t, i) => {
    const end = day3Slots[i+1] || '18:00';
    timetableTemplate.push([no++, 'DAY3 7/5(日)', '（確定後に記入）', 'MAIN', t, end, '']);
  });
  // After Party
  timetableTemplate.push([no++, 'DAY3 7/5(日)', 'After Party（TBD）', 'MAIN', '18:00', '24:00', 'After Party']);
  // Live Paint
  timetableTemplate.push([no++, 'LIVE PAINT', '（確定後に記入）', 'LIVE PAINT', 'DAY1〜3', '', 'ライブペイント']);

  timetableTemplate.forEach((row, i) => {
    const r = 9 + i;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const day = row[1];
    const [bg, fg] = dayColorMap[day] || [i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG, C.DARK];
    sh.getRange(r, 1, 1, 7).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r, 3).setFontStyle('italic');
    sh.setRowHeight(r, 30);
  });
}

// ───────────────────────────────────────────
// 🍱 賄い管理（人数表記・ボランティア/ギャラ発生スタッフ別）
// ───────────────────────────────────────────

function createMakanaishiSheet_v2(ss) {
  const sh = getOrCreateSheet(ss, '🍱 賄い管理');
  sh.clear();
  sh.setTabColor('#1B7B2C');

  const colWidths = [30, 200, 80, 80, 80, 80, 80, 100, 140];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('A1:I1').merge().setValue('🍱 MOMENT 2026 — 賄い管理（7/3〜7/5）');
  styleH1(sh.getRange('A1:I1'));
  sh.setRowHeight(1, 48);

  sh.getRange('A2:I2').merge()
    .setValue('人数×食数で合計食数を管理 ｜ ボランティア: 稼働日1食（設営撤収は2食）｜ ギャラ発生スタッフ: 3日間全食提供');
  sh.getRange('A2:I2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 28);

  let currentRow = 3;

  // ─── セクションA: ギャラ発生スタッフ ───
  sh.getRange(currentRow, 1, 1, 9).merge()
    .setValue('【A】 ギャラ発生スタッフ（3日間・全食提供）');
  sh.getRange(currentRow, 1, 1, 9).setBackground(C.PAID_BG).setFontColor(C.PAID_FG)
    .setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(currentRow, 36);
  currentRow++;

  const paidHeaders = ['#', '役割・チーム名', '人数', '7/3 昼', '7/3 夜', '7/4 昼', '7/4 夜', '7/5 昼', '備考'];
  sh.getRange(currentRow, 1, 1, 9).setValues([paidHeaders]);
  styleColHeader(sh.getRange(currentRow, 1, 1, 9));
  sh.setRowHeight(currentRow, 30);
  currentRow++;

  const paidStaff = [
    // [#, 役割, 人数, 7/3昼, 7/3夜, 7/4昼, 7/4夜, 7/5昼, 備考]
    [1,  'MOMENT運営コア（HI-C, MARIA, 妹尾真行, YMT, 石田翔馬）', 5, 5, 5, 5, 5, 5, '全食提供'],
    [2,  '南城 祐介（ボランティアMGR兼務）',                       1, 1, 1, 1, 1, 1, '全食提供'],
    [3,  '中道大雅（清掃MGR）',                                    1, 1, 1, 1, 1, 1, '全食提供'],
    [4,  'Joshua SW（舞台監督）',                                  1, 1, 1, 1, 1, 1, '全食提供'],
    [5,  'ルウジ（舞台監督補佐）',                                 1, 1, 1, 1, 1, 1, '全食提供'],
    [6,  'ユースケ（音響PA 沖縄）',                               1, 1, 1, 1, 1, 1, '音響PA・全食提供'],
    [7,  'タク（テック ラビリンスから）',                          1, 1, 1, 1, 1, 1, '機材テック・全食提供'],
    [8,  'Shinovi Creation（デコ/設営）',                          2, 0, 0, 2, 2, 2, '6/30〜設営IN: 本番3日間'],
    [9,  'OLEO（デコレーション）',                                 2, 2, 2, 2, 2, 2, '全食提供'],
    [10, '山脇さん（レーザー演出）',                               1, 1, 1, 1, 1, 1, '全食提供'],
    [11, 'ハルキ（VJ）',                                          1, 1, 1, 1, 1, 1, '全食提供'],
    [12, 'アーティストケアスタッフ（MARIA/TUI/LOE/BUNDO）',       4, 4, 4, 4, 4, 4, '全食提供'],
  ];

  const paidStartRow = currentRow;
  paidStaff.forEach((row, i) => {
    const r = currentRow;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    sh.getRange(r, 1, 1, 9).setBackground(C.PAID_BG).setFontColor(C.PAID_FG)
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r, 2).setFontWeight('bold').setHorizontalAlignment('left');
    sh.getRange(r, 3, 1, 6).setHorizontalAlignment('center');
    sh.setRowHeight(r, 32);
    currentRow++;
  });

  // ギャラ発生 小計行
  const paidSubTotal = [
    '',
    '【小計: ギャラ発生スタッフ】',
    '=SUM(C' + paidStartRow + ':C' + (currentRow - 1) + ')',
    '=SUM(D' + paidStartRow + ':D' + (currentRow - 1) + ')',
    '=SUM(E' + paidStartRow + ':E' + (currentRow - 1) + ')',
    '=SUM(F' + paidStartRow + ':F' + (currentRow - 1) + ')',
    '=SUM(G' + paidStartRow + ':G' + (currentRow - 1) + ')',
    '=SUM(H' + paidStartRow + ':H' + (currentRow - 1) + ')',
    '食数合計',
  ];
  sh.getRange(currentRow, 1, 1, 9).setValues([paidSubTotal]);
  sh.getRange(currentRow, 1, 1, 9).setBackground('#BBDEFB').setFontColor(C.PAID_FG)
    .setFontWeight('bold').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#1565C0', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.setRowHeight(currentRow, 32);
  const paidSubRow = currentRow;
  currentRow += 2;

  // ─── セクションB: ボランティアスタッフ ───
  sh.getRange(currentRow, 1, 1, 9).merge()
    .setValue('【B】 ボランティアスタッフ（稼働日のみ 1食提供 / 設営撤収は2食）');
  sh.getRange(currentRow, 1, 1, 9).setBackground(C.VOL_BG).setFontColor(C.VOL_FG)
    .setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(currentRow, 36);
  currentRow++;

  const volHeaders = ['#', 'ポジション', '総人数', '7/3\n食数', '7/4\n食数', '7/5\n食数', '1日\n最大食', '備考', '食数計算方法'];
  sh.getRange(currentRow, 1, 1, 9).setValues([volHeaders]);
  styleColHeader(sh.getRange(currentRow, 1, 1, 9));
  sh.setRowHeight(currentRow, 36);
  currentRow++;

  // ボランティア人数（LINEから確定値）
  // 285bbcff より: BAR 20人, エントランス 18人, 駐車場 12人
  // cebc7828 より: 受付業務 12人, 荷物検査 6人
  // 設営撤収人数は確定していないため TBD
  const volStaff = [
    // [#, ポジション, 総人数, 7/3食数, 7/4食数, 7/5食数, 1日最大食, 備考, 計算方法]
    [1,  'エントランス受付ボランティア', 18, 18, 18, 18, 18, '✅確定 18名', '稼働日1食 × 3日'],
    [2,  '場内駐車場ボランティア',      12, 12, 12, 12, 12, '✅確定 12名', '稼働日1食 × 3日'],
    [3,  'BARスタッフボランティア',     20, 20, 20, 20, 20, '✅確定 20名', '稼働日1食 × 3日'],
    [4,  '荷物検査ボランティア',         6,  6,  6,  6,  6, '✅確定 6名',  '稼働日1食 × 3日'],
    [5,  'セキュリティ（警備員含む）',   5,  5,  5,  5,  5, '✅確定 5名',  '警備員5名・稼働日1食'],
    [6,  '清掃ボランティア',            'TBD', 'TBD', 'TBD', 'TBD', 'TBD', '人数確認中', '4h×3日'],
    [7,  'キッズエリアボランティア',    'TBD', 'TBD', 'TBD', 'TBD', 'TBD', '人数確認中', '4h×3日'],
    [8,  '設営ボランティア',            'TBD', 0, 0, 0, 0, 'TBD（6/30〜7/2）', '設営期間: 2食/日'],
    [9,  '撤収ボランティア',            'TBD', 0, 0, 0, 0, 'TBD（7/6〜7/8）', '撤収期間: 2食/日'],
  ];

  const volStartRow = currentRow;
  volStaff.forEach((row, i) => {
    const r = currentRow;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    sh.getRange(r, 1, 1, 9).setBackground(i % 2 === 0 ? C.VOL_BG : '#F1F8E9')
      .setFontColor(C.VOL_FG)
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r, 2).setFontWeight('bold').setHorizontalAlignment('left');
    sh.getRange(r, 3, 1, 5).setHorizontalAlignment('center');
    sh.setRowHeight(r, 32);
    currentRow++;
  });

  // ボランティア 小計行
  sh.getRange(currentRow, 1).setValue('');
  sh.getRange(currentRow, 2).setValue('【小計: ボランティア】');
  sh.getRange(currentRow, 3).setValue('61名確定（TBD含む）');
  sh.getRange(currentRow, 4).setValue(18+12+20+6+5);
  sh.getRange(currentRow, 5).setValue(18+12+20+6+5);
  sh.getRange(currentRow, 6).setValue(18+12+20+6+5);
  sh.getRange(currentRow, 7).setValue('');
  sh.getRange(currentRow, 8).setValue('TBD除く確定分のみ');
  sh.getRange(currentRow, 9).setValue('');
  sh.getRange(currentRow, 1, 1, 9).setBackground('#C8E6C9').setFontColor(C.VOL_FG)
    .setFontWeight('bold').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#2E7D32', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.setRowHeight(currentRow, 32);
  const volSubRow = currentRow;
  currentRow += 2;

  // ─── セクションC: 合計食数サマリー ───
  sh.getRange(currentRow, 1, 1, 9).merge()
    .setValue('【C】 合計食数サマリー');
  sh.getRange(currentRow, 1, 1, 9).setBackground(C.TOTAL_BG).setFontColor(C.TOTAL_FG)
    .setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(currentRow, 36);
  currentRow++;

  const summaryHeaders = ['', 'カテゴリ', '人数', '7/3 昼', '7/3 夜', '7/4 昼', '7/4 夜', '7/5 昼', '3日合計食数'];
  sh.getRange(currentRow, 1, 1, 9).setValues([summaryHeaders]);
  styleColHeader(sh.getRange(currentRow, 1, 1, 9));
  sh.setRowHeight(currentRow, 30);
  currentRow++;

  // ギャラ発生スタッフ（Shinovi Creationは7/3未計上のため20人）
  const paidTotal = 5+1+1+1+1+1+1+2+2+1+1+4; // 21人
  const volConfirmed = 18+12+20+6+5; // 61名（確定分）
  const summaryData = [
    ['', 'ギャラ発生スタッフ', paidTotal + '名',
     '=D' + paidSubRow, '=E' + paidSubRow,
     '=F' + paidSubRow, '=G' + paidSubRow,
     '=H' + paidSubRow,
     '=D' + paidSubRow + '+E' + paidSubRow + '+F' + paidSubRow + '+G' + paidSubRow + '+H' + paidSubRow],
    ['', 'ボランティア（確定分61名）', '61名',
     volConfirmed, 0, volConfirmed, 0, volConfirmed, volConfirmed * 3],
    ['', '合計（確定分・TBD除く）', paidTotal + '+61名',
     '', '', '', '', '', '合計=上2行を参照'],
  ];

  summaryData.forEach((row, i) => {
    const r = currentRow;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const bgs = [C.PAID_BG, C.VOL_BG, C.TOTAL_BG];
    const fgs = [C.PAID_FG, C.VOL_FG, C.TOTAL_FG];
    sh.getRange(r, 1, 1, 9).setBackground(bgs[i]).setFontColor(fgs[i])
      .setFontWeight(i === 2 ? 'bold' : 'normal').setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sh.setRowHeight(r, 34);
    currentRow++;
  });

  // 注記
  currentRow++;
  sh.getRange(currentRow, 1, 1, 9).merge()
    .setValue('※ ボランティアは夜の賄いは対象外（昼のみ1食/稼働日）ギャラ発生スタッフは昼夜とも提供 ｜ 清掃・キッズ人数確定後に更新要');
  sh.getRange(currentRow, 1, 1, 9).setBackground(C.ALERT_BG).setFontColor(C.ALERT_FG)
    .setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(currentRow, 28);

  sh.setFrozenRows(3);
}

// ───────────────────────────────────────────
// 📞 スタッフ緊急連絡先
// ───────────────────────────────────────────

function createContactSheet_v2(ss) {
  const sh = getOrCreateSheet(ss, '📞 スタッフ緊急連絡先');
  sh.clear();
  sh.setTabColor('#7B0000');

  const colWidths = [30, 180, 160, 140, 120, 180];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('A1:F1').merge().setValue('📞 MOMENT 2026 — スタッフ緊急連絡先');
  styleH1(sh.getRange('A1:F1'));
  sh.setRowHeight(1, 48);

  sh.getRange('A2:F2').merge()
    .setValue('⚠️ このシートの内容は関係者限定情報です。外部共有・個人情報の無断開示禁止。');
  sh.getRange('A2:F2').setBackground('#7B0000').setFontColor('#FFD700').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setFontWeight('bold');
  sh.setRowHeight(2, 28);

  const headers = ['#', '名前', 'チーム・役割', '携帯番号', 'LINE ID', '備考'];
  sh.getRange(3, 1, 1, headers.length).setValues([headers]);
  styleColHeader(sh.getRange(3, 1, 1, headers.length));
  sh.setRowHeight(3, 32);
  sh.setFrozenRows(3);

  const contacts = [
    // ─── MOMENT運営コア ───
    [1,  'HI-C（小崎博資）', 'MOMENT運営 / 総合統括',               '（別途）', '', '最終判断者 / 借主代表'],
    [2,  '妹尾真行',          'MOMENT共同運営 / コア',               '（別途）', '', 'コアチーム'],
    [3,  'YMT（ヤマト）',     'MOMENT運営 / 出店・SNS担当',          '（別途）', '', ''],
    [4,  'MARIA',             'MOMENT運営 / アーティストケアリーダー','（別途）', '', 'ケアチーム責任者'],
    [5,  '南城 祐介',         'ボランティア統括マネージャー',         '（別途）', '', ''],
    [6,  '石田翔馬',          '本部運営統括（エデン等経験者）',       '（別途）', '', 'エントランス・本部'],
    // ─── 各チームリーダー ───
    [7,  '＆you⭐︎（ゆうさん）', 'エントランス受付統括',              '（別途）', '', '場内エントランス'],
    [8,  '田中カズハ',         '荷物検査チームリーダー',              '（別途）', '', '荷物検査'],
    [9,  'YUTO',               '場内駐車場整理マネージャー',          '（別途）', '', '駐車場12名'],
    [10, '中道大雅',           '清掃ボランティアマネージャー',        '（別途）', '', ''],
    [11, 'Joshua SW',          '舞台監督',                           '（別途）', '', 'ステージ管理'],
    [12, 'ルウジ',             '舞台監督補佐',                       '（別途）', '', 'ステージ管理'],
    [13, 'ユースケ',           '音響PA（沖縄）',                     '（別途）', '', '沖縄から来場'],
    [14, 'ハギワラハジメ',     'Shinovi Creation / デコ設営',        '090-8331-6756', '', '2T+4Tトラック'],
    [15, 'ニシタニショウ（タニシ）', 'Shinovi Creation / デコ設営',  '080-5488-7015', '', ''],
    // ─── 緊急連絡先 ───
    [16, '洞川キャンプ場 管理者', '会場管理',                        '（別途）', '', '緊急時 / 奈良県吉野郡天川村洞川943番地15'],
    [17, '吉野警察署',            '警察',                            '（別途）', '', '道路使用許可申請済'],
    [18, '救急・消防',            '緊急時',                          '119',      '', '最優先'],
  ];

  contacts.forEach((row, i) => {
    const r = 4 + i;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    const isSeparator = typeof row[2] === 'string' && (row[2].includes('MOMENT運営コア') || row[2].includes('各チーム') || row[2].includes('緊急'));
    const bg = row[1].includes('119') ? '#FFEBEE' : i % 2 === 0 ? C.ROW_A_BG : C.ROW_B_BG;
    const fg = row[1].includes('119') ? '#B71C1C' : C.DARK;
    sh.getRange(r, 1, 1, 6).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);
    if (row[1]) sh.getRange(r, 2).setFontWeight('bold');
    sh.setRowHeight(r, 30);
  });
}

// ───────────────────────────────────────────
// シート順番整理
// ───────────────────────────────────────────

function reorderSheets_v2(ss) {
  const ORDER = [
    '🌟 表紙',
    '📅 工程表（全体）',
    '📅 工程表（MOMENTチーム）',
    '🚛 トラック運行表',
    '🎤 アーティストケア',
    '🎵 タイムテーブル（暫定）',
    '🍱 賄い管理',
    '📞 スタッフ緊急連絡先',
  ];

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
