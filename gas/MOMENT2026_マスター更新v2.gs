/**
 * MOMENT 2026 — マスタースプレッドシート 再構築スクリプト v3
 * 対象スプシ: 1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ
 * ①スプシ（理想形）のデータを②に移植。BOT_PROTECTEDシートは絶対に変更しない。
 */

const SPREADSHEET_ID = '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ';

const BOT_PROTECTED = [
  '📱 LINEリアルタイム', '📋 タスク（現役）', '✅ 完了タスク',
  '📚 確定知識ベース', '📦 備品・資材', '👥 スタッフ', '🛍️ 出店リスト',
];

const LINKS = {
  schedule:  '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY',
  tasks:     '1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ',
  volunteer: '1tVEmUOELKBQTkDGew6jRmWaqqlCLwz61wIvRCKFuF_Q',
  artist:    '1h7HV6ZfnDElblK4nJ_dbtKgAOaNnB1olv2A7946GjYo',
  vendor:    '1ULD9TcMRJDMF1k-i4CBJEX3M_DT2TRLohTQ-xugZTCA',
  entrance:  '1ncj9sVeOKFhqavsdo4hsjaQ2f5LLeMptBxHSQTgwP0g',
};

const C = {
  H1_BG: '#0D0D1A', H2_BG: '#1C1C3C', COL_HDR_BG: '#2D2D6B',
  ROW_A_BG: '#FFFFFF', ROW_B_BG: '#F2F2FA', WHITE: '#FFFFFF',
  DARK: '#0D0D1A', GOLD: '#C9A84C',
  ALERT_BG: '#FFF3CD', ALERT_FG: '#7B4F00',
  MARIA_BG: '#FCEEF5', MARIA_FG: '#7B1B5E',
  TUI_BG:   '#EEF5FC', TUI_FG:   '#1B4D7B',
  LOE_BG:   '#EFFCF0', LOE_FG:   '#1B7B2C',
  BUNDO_BG: '#FFF5EE', BUNDO_FG: '#7B3B1B',
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
  PAID_BG: '#E3F2FD', PAID_FG: '#0D47A1',
  VOL_BG:  '#E8F5E9', VOL_FG:  '#1B5E20',
  TOTAL_BG: '#263238', TOTAL_FG: '#FFFFFF',
  SETUP_BG:    '#F3E5F5', SETUP_FG:    '#4A0E7B',
  TEARDOWN_BG: '#FCE4EC', TEARDOWN_FG: '#880E4F',
  // ステージ色
  STAGE_MAIN_BG:      '#DDEEFF', STAGE_MAIN_FG:      '#1A3B6B',
  STAGE_BAR_BG:       '#E0F7FA', STAGE_BAR_FG:       '#005070',
  STAGE_AFTER_BG:     '#B2EBF2', STAGE_AFTER_FG:     '#004D60',
  STAGE_WORKSHOP_BG:  '#F3E5F5', STAGE_WORKSHOP_FG:  '#4A0E7B',
  STAGE_LIVEPAINT_BG: '#FFF0E6', STAGE_LIVEPAINT_FG: '#7B2D00',
  STAGE_SPECIAL_BG:   '#FFFDE7', STAGE_SPECIAL_FG:   '#6B4500',
  // 重要度
  PRIO_HIGH_BG: '#FFE0E0', PRIO_HIGH_FG: '#7B0000',
  PRIO_MID_BG:  '#FFF9E0', PRIO_MID_FG:  '#7B5A00',
  PRIO_LOW_BG:  '#E0FFE8', PRIO_LOW_FG:  '#1B5E20',
};

// ───────────────────────────────────────────
// メイン実行
// ───────────────────────────────────────────

function setupAllNewSheets_v2() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const existing = ss.getSheets().map(s => s.getName());
  const missing = BOT_PROTECTED.filter(n => !existing.includes(n));
  if (missing.length > 0) Logger.log('⚠️ 保護シート未存在（スキップ）: ' + missing.join(', '));

  Logger.log('🌟 表紙...');       createDashboardSheet_v2(ss);
  Logger.log('📅 工程表（全体）...');  createScheduleSheet_v2(ss);
  Logger.log('📅 工程表（MOMENT）...'); createMomentOnlyScheduleSheet(ss);
  Logger.log('🚛 トラック運行表...');  createTruckScheduleSheet(ss);
  Logger.log('🎤 アーティストケア...'); createArtistCareSheet_v2(ss);
  Logger.log('🎵 タイムテーブル...');  createTimeTableSheet_v2(ss);
  Logger.log('🍱 賄い管理...');      createMakanaishiSheet_v2(ss);
  Logger.log('📞 緊急連絡先...');    createContactSheet_v2(ss);
  Logger.log('👥 ボランティア管理...'); createVolunteerSheet(ss);
  Logger.log('📂 シート順番整理...');  reorderSheets_v2(ss);
  Logger.log('✅ 全シート再構築完了！');
  SpreadsheetApp.flush();
}

// ───────────────────────────────────────────
// 🌟 表紙/ダッシュボード
// ───────────────────────────────────────────

function createDashboardSheet_v2(ss) {
  const sh = getOrCreateSheet(ss, '🌟 表紙');
  sh.clear(); sh.setTabColor('#C9A84C');
  sh.setColumnWidth(1,60); sh.setColumnWidth(2,280);
  sh.setColumnWidth(3,320); sh.setColumnWidth(4,180); sh.setColumnWidth(5,180);

  const t = sh.getRange('B1:E1');
  t.merge().setValue('🌟 MOMENT 2026 — 管理システム ダッシュボード'); styleH1(t);
  const s = sh.getRange('B2:E2');
  s.merge().setValue('2026年7月3日（金）〜 7月5日（日）｜奈良県天川村・洞川キャンプ場｜前売全810枚 SOLD OUT');
  s.setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2,32);
  sh.getRange('B3:E3').merge().setValue('').setBackground(C.H1_BG); sh.setRowHeight(3,8);

  const sec = sh.getRange('B4:E4');
  sec.merge().setValue('📎 関連スプレッドシート一覧'); styleH2(sec); sh.setRowHeight(4,36);

  sh.getRange(5,2,1,4).setValues([['','スプレッドシート名','URL','担当/備考']]);
  styleColHeader(sh.getRange('B5:E5')); sh.setRowHeight(5,30);

  const linkData = [
    ['🗓','工程表（スケジュール管理）','https://docs.google.com/spreadsheets/d/'+LINKS.schedule+'/edit','全体スケジュール'],
    ['✅','タスク管理（本スプシ）','https://docs.google.com/spreadsheets/d/'+LINKS.tasks+'/edit','ジュニアBot連携'],
    ['📋','ボランティア回答シート','https://docs.google.com/spreadsheets/d/'+LINKS.volunteer+'/edit','Googleフォーム連携'],
    ['🎤','アーティスト管理シート','https://docs.google.com/spreadsheets/d/'+LINKS.artist+'/edit','ケア・宿泊管理'],
    ['🪟','出店管理シート','https://docs.google.com/spreadsheets/d/'+LINKS.vendor+'/edit','出店者情報'],
    ['🚪','エントランス管理シート','https://docs.google.com/spreadsheets/d/'+LINKS.entrance+'/edit','チケット・入場'],
  ];
  linkData.forEach((row,i) => {
    const r = 6+i;
    sh.getRange(r,2).setValue(row[0]);
    sh.getRange(r,3).setValue(row[1]).setFontWeight('bold');
    sh.getRange(r,4).setValue(row[2]).setFontColor('#1A73E8').setFontLine('underline');
    sh.getRange(r,5).setValue(row[3]);
    sh.getRange(r,2,1,4).setBackground(i%2===0?C.ROW_A_BG:C.ROW_B_BG).setFontColor(C.DARK)
      .setVerticalAlignment('middle').setBorder(true,true,true,true,true,true,'#CCCCCC',SpreadsheetApp.BorderStyle.SOLID);
    sh.setRowHeight(r,36);
  });

  sh.getRange('B13:E13').merge().setValue('📂 シート構成').setBackground(C.H2_BG)
    .setFontColor(C.WHITE).setFontSize(12).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(13,36);
  styleColHeader(sh.getRange(14,2,1,3)); sh.setRowHeight(14,30);

  const sheetInfo = [
    ['シート名','内容','備考'],
    ['🌟 表紙','ダッシュボード（本シート）','リンク集'],
    ['📅 工程表（全体）','全体スケジュール 6/29〜7/6','全チーム・設営〜撤収 フィルター付き'],
    ['📅 工程表（MOMENTチーム）','MOMENT運営チームの工程のみ','コアスタッフ向け 重要度色分け'],
    ['🚛 トラック運行表','トラック・車両の入出庫一覧','日時・担当'],
    ['🎤 アーティストケア','アーティストケア担当管理 35組','MARIA/TUI/LOE/BUNDO'],
    ['🎵 タイムテーブル','DAY1/DAY2/DAY3 全出演33組','ステージ色分け'],
    ['🍱 賄い管理','個人別食事チェックリスト','7/3〜7/5 朝昼夜'],
    ['📞 スタッフ緊急連絡先','緊急時の連絡先一覧','チーム別'],
    ['👥 ボランティア管理','ボランティア103名 業務別管理','フォーム回答データ連携'],
    ['─── ボット連携シート（以下変更禁止）───','',''],
    ['📱 LINEリアルタイム','LINEメッセージログ','Bot自動書込'],
    ['📋 タスク（現役）','自動抽出タスク','Bot自動書込'],
    ['✅ 完了タスク','完了済みタスク','Bot自動書込'],
    ['📚 確定知識ベース','学習済み確定情報','Bot自動書込'],
    ['📦 備品・資材','備品場所・数量','Bot自動書込'],
    ['👥 スタッフ','スタッフ情報','Botが参照'],
    ['🛍️ 出店リスト','出店者情報','Botが参照'],
  ];
  sheetInfo.forEach((row,i) => {
    const r = 14+i;
    const isProtected = row[0].includes('ボット連携');
    const isBotSheet = BOT_PROTECTED.some(n => row[0]===n);
    const bg = isProtected?C.H2_BG : isBotSheet?'#FFF8DC' : i%2===0?C.ROW_A_BG:C.ROW_B_BG;
    const fg = isProtected?C.GOLD  : isBotSheet?'#7B5A00' : C.DARK;
    sh.getRange(r,2).setValue(row[0]); sh.getRange(r,3).setValue(row[1]); sh.getRange(r,4).setValue(row[2]);
    sh.getRange(r,2,1,3).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
      .setBorder(true,true,true,true,true,true,'#CCCCCC',SpreadsheetApp.BorderStyle.SOLID);
    if (isProtected) sh.getRange(r,2,1,3).setFontWeight('bold').setFontStyle('italic');
    sh.setRowHeight(r,30);
  });
  sh.setFrozenRows(1);
}

// ───────────────────────────────────────────
// 📅 工程表（全体）— 6/29〜7/6 全チーム ①形式
// ───────────────────────────────────────────

function createScheduleSheet_v2(ss) {
  const sh = getOrCreateSheet(ss, '📅 工程表（全体）');
  sh.clear(); sh.setTabColor('#2D2D6B');

  // 列幅: 時刻|カテゴリ|チーム名|作業内容|人数|車両台数|備考
  [80,120,160,280,70,80,200].forEach((w,i) => sh.setColumnWidth(i+1,w));

  sh.getRange('A1:G1').merge().setValue('📅 MOMENT 2026 — 工程表（全体）6/29〜7/6'); styleH1(sh.getRange('A1:G1'));
  sh.getRange('A2:G2').merge()
    .setValue('確定データのみ掲載 ｜ 会場：奈良県天川村・洞川キャンプ場 ｜ カテゴリでフィルター可能');
  sh.getRange('A2:G2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2,28);

  const HEADERS = ['時刻','カテゴリ','チーム名','作業内容','人数','車両台数','備考'];
  sh.getRange(3,1,1,7).setValues([HEADERS]); styleColHeader(sh.getRange(3,1,1,7));
  sh.setRowHeight(3,32); sh.setFrozenRows(3);

  // カテゴリ→色マップ
  const catColor = {
    'MOMENT運営':    [C.CAT_MOMENT_BG, C.CAT_MOMENT_FG],
    'デコレーション': [C.CAT_DECO_BG,   C.CAT_DECO_FG],
    'メインフロア':   [C.CAT_STAGE_BG,  C.CAT_STAGE_FG],
    '照明':          [C.CAT_LIGHT_BG,  C.CAT_LIGHT_FG],
    '音響':          [C.CAT_SOUND_BG,  C.CAT_SOUND_FG],
    '電源':          [C.CAT_POWER_BG,  C.CAT_POWER_FG],
    'BAR':           [C.CAT_BAR_BG,    C.CAT_BAR_FG],
    '撮影・映像・VJ': [C.CAT_VIDEO_BG,  C.CAT_VIDEO_FG],
    '警備・荷物検査': [C.CAT_GUARD_BG,  C.CAT_GUARD_FG],
    '舞台監督':      [C.CAT_STAGE_BG,  C.CAT_STAGE_FG],
    '撤収':          [C.TEARDOWN_BG,   C.TEARDOWN_FG],
  };

  // データ: [時刻, カテゴリ, チーム名, 作業内容, 人数, 車両台数, 備考]
  const days = [
    { label: '6/29（月）  設営 Day 1', rows: [
      ['14:00','MOMENT運営','MOMENT運営','摂津倉庫 荷物詰め込み〈トラック積み込み〉','4名','1台','当日はその後待機。トラック出発は翌朝'],
      ['15:00','MOMENT運営','MOMENT運営','会場入り・宿泊テント設営','5名','','コアスタッフ先発隊 ／ 泉の森は7/3から使用可能'],
      ['20:00','デコレーション','ZIGN','デコレーション設営 〈入り〉','6名','3台',''],
      ['20:00','デコレーション','Samaya Design','デコレーション設営 〈入り〉','8名','3台','〜6/30 8:00'],
      ['夜','メインフロア','ストレッチテント・カンパニー','ストレッチテント設営チーム 〈入り〉（FOHドーム＆底上げ含む）','3名','2台','翌30日：Mステージ・XL途中 / 7/1：XL仕上げ＆照明取り付け / 7/6撤収16:00まで'],
    ]},
    { label: '6/30（火）  設営 Day 2', rows: [
      ['5:00','照明','Ruriko Hosono','BAR／KIDS／六角堂 照明設営 〈入り〉','3名','1台',''],
      ['朝一','MOMENT運営','MOMENT運営','摂津倉庫→会場 トラック到着・荷物おろし','4名','2tトラック×1','その後回収ルートへ出発'],
      ['8:00','MOMENT運営','MOMENT運営','MMT備品荷下ろし・会場内資材運搬','4名','',''],
      ['午前','メインフロア','ドームテントチーム','FOHドーム＆ステージ底上げ 〈入り〉','','','BAR・六角堂にテーブル設置も担当'],
      ['10:00','メインフロア','ストレッチテント・カンパニー','Mステージ設営・XL途中','3名','',''],
      ['13:00','MOMENT運営','MOMENT運営','焚き火テントサイト区画整理・場内ラミネート・備品整理','3名','',''],
      ['昼過ぎ','MOMENT運営','トラック（回収ルート）','資材回収: エクソダス→エッセンシャルストア→長谷川→広戸の事務所（ドリンク）','','2tトラック×1','椅子・テーブル・ドリンク等を各所でピックアップ'],
      ['終日','メインフロア','ストレッチテント（BAR・六角堂）','BAR・六角堂エリア テーブル設置','','',''],
    ]},
    { label: '7/1（水）  設営 Day 3', rows: [
      ['朝一','音響','SOL（小野裕介）','音響メイン設営 〈入り〉 ※時間前後あり','','2tワイド×1 ／ 軽トラ×1',''],
      ['8:00','MOMENT運営','MOMENT運営','各エントランス設営／バルーン投光器設置／LED UPライト設置（トラック使用）','6名','','運転1名含む'],
      ['終日','メインフロア','ストレッチテント・カンパニー','XL仕上げ＆照明取り付け・Mステージ最終調整','3名','',''],
      ['13:00','MOMENT運営','MOMENT運営','オートキャンプサイト区画整理・ラミネート','4名','',''],
      ['時間未定','音響','kamba（神波崇）','BAR 音響設営 〈入り〉','1名','',''],
      ['19:00','照明','山脇 Shu','照明卓周り設営・シュート 〈入り〉','1名','',''],
      ['20:00','電源','KAMADEN／GOTO DENKI（後藤拓己）','電源設置 〈入り〉','5名','2台',''],
      ['20:00','電源','株式会社VERY（田中）','ジェネレーター・電源設置 〈入り〉','8名','4台',''],
      ['7/1〜7/2','舞台監督','ルウジ','舞台監督 〈入り〉','1名','',''],
    ]},
    { label: '7/2（木）  設営 Day 4（最終仕上げ）', rows: [
      ['8:00','MOMENT運営','MOMENT運営','Moment備品の清掃（バー備品・掃除道具・エントランス用品）整理・配置','3名','',''],
      ['10:00','BAR','BARチーム（田岡太一）','飲料搬入 〈入り〉','','冷凍車×1',''],
      ['11:00','MOMENT運営','MOMENT運営','倉庫に資材を綺麗に収納','4名','','手空きスタッフで対応'],
      ['12:00','撮影・映像・VJ','撮影チーム（濵田隆史）','撮影 〈入り〉','1名','',''],
      ['13:00','音響','宮野拓人（楽器テック）','フリーランス楽器テック 〈入り〉','1名','',''],
      ['14:00','MOMENT運営','MOMENT運営','天川村・会場内資材収納・再確認','全員','','手空きスタッフ全員'],
      ['16:00','MOMENT運営','MOMENT運営','ゴミ拾い（全エリア）','全員','',''],
      ['16:00','撮影・映像・VJ','CRACKWORKS（モリグチハルキ）','VJ設営 〈入り〉','2名','1台',''],
      ['16:00〜17:00','撮影・映像・VJ','MAYADESU（井原麻耶）','撮影 〈入り〉','1名','1台',''],
      ['23:00','警備・荷物検査','荷物検査チーム（東谷）','荷物検査 〈入り〉','1名','1台',''],
      ['23:00','警備・荷物検査','荷物検査チーム（三賀真生）','荷物検査 〈入り〉','2名','1台',''],
    ]},
    { label: '7/3（金）  本番 Day 1 🎵', rows: [
      ['8:00','警備・荷物検査','荷物検査チーム（荻山）','荷物検査 〈入り〉','1名','1台','出：7/5 午前'],
      ['9:00','MOMENT運営','MOMENT運営','ゲートオープン','3名','','エントランス担当'],
      ['11:00','舞台監督','Joshua SW','舞台監督 〈入り〉','1名','','出：7/6 13:00'],
      ['14:00','撮影・映像・VJ','KAGAMI JAPAN（池上健太）','撮影 〈入り〉','1名','1台',''],
      ['15:00','MOMENT運営','MOMENT運営（全体）','♪ タイムテーブル スタート！','全体','',''],
    ]},
    { label: '7/4（土）  本番 Day 2 🎵', rows: [
      ['終日','MOMENT運営','MOMENT運営（全体）','♪ 本番 Day 2 開催中','全体','',''],
    ]},
    { label: '7/5（日）  本番 Day 3 🎵', rows: [
      ['23:30','MOMENT運営','MOMENT運営（全体）','After 終了','全体','',''],
    ]},
    { label: '7/6（月）  撤収', rows: [
      ['7:00','MOMENT運営','MOMENT運営','リース品を優先に資材全て回収（撤収開始）','25名以上','','2025年実績：25名以上 ／ リース品→音響→照明→テントの順で優先'],
      ['13:00','舞台監督','Joshua SW','退場','1名','',''],
      ['14:30','MOMENT運営','MOMENT運営','リース品 出発','3名','','運転担当2〜3名'],
      ['〜16:00','メインフロア','ストレッチテント・カンパニー','ストレッチテント 完全撤収','','','16時頃までに完全撤収'],
    ]},
  ];

  let row = 4;
  days.forEach(day => {
    // 日付ブロックヘッダー
    sh.getRange(row,1,1,7).merge().setValue('── ' + day.label + ' ──');
    sh.getRange(row,1,1,7).setBackground(C.H2_BG).setFontColor(C.GOLD)
      .setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.setRowHeight(row,32); row++;

    day.rows.forEach(r => {
      sh.getRange(row,1,1,7).setValues([r]);
      const cat = r[1];
      const [bg,fg] = catColor[cat] || [C.ROW_A_BG, C.DARK];
      sh.getRange(row,1,1,7).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
        .setBorder(true,true,true,true,true,true,'#CCCCCC',SpreadsheetApp.BorderStyle.SOLID);
      sh.getRange(row,2).setFontWeight('bold');
      sh.setRowHeight(row,32); row++;
    });
  });

  // フィルター設定
  sh.getRange(3,1,row-3,7).createFilter();
}

// ───────────────────────────────────────────
// 📅 工程表（MOMENTチームのみ）— 重要度色分け
// ───────────────────────────────────────────

function createMomentOnlyScheduleSheet(ss) {
  const sh = getOrCreateSheet(ss, '📅 工程表（MOMENTチーム）');
  sh.clear(); sh.setTabColor('#1E4D2B');

  // 列幅: 時刻|作業内容|必要人数|備考|重要度
  [80,320,80,220,80].forEach((w,i) => sh.setColumnWidth(i+1,w));

  sh.getRange('A1:E1').merge().setValue('📅 MOMENT 2026 — 工程表（MOMENTチーム専用）'); styleH1(sh.getRange('A1:E1'));
  sh.getRange('A2:E2').merge()
    .setValue('コアスタッフ向け ｜ HI-C / MARIA / 妹尾真行 / YMT / 南城 祐介 / 中道大雅');
  sh.getRange('A2:E2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2,28);

  const HEADERS = ['時刻','作業内容','必要人数','備考','重要度'];
  sh.getRange(3,1,1,5).setValues([HEADERS]); styleColHeader(sh.getRange(3,1,1,5));
  sh.setRowHeight(3,32); sh.setFrozenRows(3);

  // 重要度→色
  const prioColor = {
    '🔴 高': [C.PRIO_HIGH_BG, C.PRIO_HIGH_FG],
    '🟡 中': [C.PRIO_MID_BG,  C.PRIO_MID_FG],
    '🟢 低': [C.PRIO_LOW_BG,  C.PRIO_LOW_FG],
  };

  // データ: [時刻, 作業内容, 必要人数, 備考, 重要度]
  const days = [
    { label: '6/29（月）  🔨設営  設営 Day 1', rows: [
      ['14:00','倉庫資材積み込み（約1.5時間・摂津）','4名','運転1名＋積み込み3名','🔴 高'],
      ['21:00','会場入り 車内宿泊','5名','コアスタッフ先発隊 ／ 泉の森は7/3から使用可能','🔴 高'],
    ]},
    { label: '6/30（火）  🔨設営  設営 Day 2', rows: [
      ['8:00','MMT備品荷下ろし・会場内資材運搬','4名','','🟡 中'],
      ['13:00','焚き火テントサイト区画整理・場内ラミネート・備品整理','3名','','🟡 中'],
    ]},
    { label: '7/1（水）  🔨設営  設営 Day 3', rows: [
      ['8:00','各エントランス設営／バルーン投光器設置／LED UPライト設置（トラック使用）','6名','運転1名含む','🟡 中'],
      ['13:00','オートキャンプサイト区画整理・ラミネート','4名','','🟢 低'],
    ]},
    { label: '7/2（木）  🔨設営  設営 Day 4（最終仕上げ）', rows: [
      ['8:00','Moment備品の清掃（バー備品・掃除道具・エントランス用品）整理・配置','3名','','🟡 中'],
      ['11:00','倉庫に資材を綺麗に収納','4名','手空きスタッフで対応','🟡 中'],
      ['14:00','天川村・会場内資材収納・再確認','全員','手空きスタッフ全員','🟡 中'],
      ['16:00','ゴミ拾い（全エリア）','全員','','🟢 低'],
    ]},
    { label: '7/3（金）  🎵本番  本番 Day 1 🎵', rows: [
      ['9:00','ゲートオープン','3名','エントランス担当','🔴 高'],
      ['15:00','♪ タイムテーブル スタート！','全体','','🔴 高'],
    ]},
    { label: '7/4（土）  🎵本番  本番 Day 2 🎵', rows: [
      ['終日','♪ 本番 Day 2 開催中','全体','','🟢 低'],
    ]},
    { label: '7/5（日）  🎵本番  本番 Day 3 🎵', rows: [
      ['23:30','After 終了','全体','','🟢 低'],
    ]},
    { label: '7/6（月）  📦撤収  撤収', rows: [
      ['7:00','リース品を優先に資材全て回収（撤収開始）','25名以上','2025年実績：25名以上 ／ リース品→音響→照明→テントの順で優先','🔴 高'],
      ['14:30','リース品 出発','3名','運転担当2〜3名','🔴 高'],
    ]},
  ];

  let row = 4;
  days.forEach(day => {
    sh.getRange(row,1,1,5).merge().setValue('── ' + day.label + ' ──');
    sh.getRange(row,1,1,5).setBackground(C.H2_BG).setFontColor(C.GOLD)
      .setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.setRowHeight(row,32); row++;

    day.rows.forEach(r => {
      sh.getRange(row,1,1,5).setValues([r]);
      const prio = r[4];
      const [bg,fg] = prioColor[prio] || [C.ROW_A_BG, C.DARK];
      sh.getRange(row,1,1,5).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
        .setBorder(true,true,true,true,true,true,'#CCCCCC',SpreadsheetApp.BorderStyle.SOLID);
      sh.getRange(row,2).setFontWeight('bold');
      sh.getRange(row,5).setHorizontalAlignment('center').setFontWeight('bold');
      sh.setRowHeight(row,34); row++;
    });
  });

  sh.getRange(3,1,row-3,5).createFilter();
}

// ───────────────────────────────────────────
// 🚛 トラック・車両 運行表
// ───────────────────────────────────────────

function createTruckScheduleSheet(ss) {
  const sh = getOrCreateSheet(ss, '🚛 トラック運行表');
  sh.clear(); sh.setTabColor('#6B4500');
  [40,120,80,120,120,160,120,200].forEach((w,i) => sh.setColumnWidth(i+1,w));

  sh.getRange('A1:H1').merge().setValue('🚛 MOMENT 2026 — トラック・車両 運行表'); styleH1(sh.getRange('A1:H1'));
  sh.getRange('A2:H2').merge()
    .setValue('確定データのみ掲載（LINEグループ確認済）');
  sh.getRange('A2:H2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2,28);

  sh.getRange('A3:H3').merge().setValue('🔷 プロ・業者車両'); styleH2(sh.getRange('A3:H3')); sh.setRowHeight(3,36);
  const th = ['No.','会社/チーム名','車両台数','車両種別','入り日時','経由/出発地','撤収日時','備考'];
  sh.getRange(4,1,1,8).setValues([th]); styleColHeader(sh.getRange(4,1,1,8)); sh.setRowHeight(4,30);

  const trucks = [
    [1,'Shinovi Creation\n（ハギワラハジメ・ニシタニショウ）','2台','2Tロングアルミバン＋4T平トラック','6/30（火）朝','大阪方面','7/7（火）午後','デコ/設営全般 ✅確定'],
    [2,'西尾レントオール','TBD','レンタル機材車両','7/1（水）9:00','大阪方面','7/7（火）11:00','機材レンタル引取 ✅確定'],
    [3,'KAMADEN／GOTO DENKI（後藤拓己）','2台','電源機材車両','7/1（水）20:00','大阪方面','7/6以降','電源設置チーム ✅確定'],
    [4,'株式会社VERY（田中）','4台','ジェネレーター車両','7/1（水）20:00','大阪方面','7/6以降','ジェネレーター設置 ✅確定'],
    [5,'BARチーム（田岡太一）','1台','冷凍トラック','7/2（木）10:00','大阪方面','7/6以降','飲料搬入 ✅確定'],
  ];
  trucks.forEach((r,i) => {
    const rn = 5+i;
    sh.getRange(rn,1,1,r.length).setValues([r]);
    sh.getRange(rn,1,1,8).setBackground(C.CAT_TRUCK_BG).setFontColor(C.CAT_TRUCK_FG)
      .setVerticalAlignment('middle').setBorder(true,true,true,true,true,true,'#CCCCCC',SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(rn,2).setFontWeight('bold'); sh.setRowHeight(rn,48);
  });

  const s2 = 5+trucks.length+1;
  sh.getRange(s2,1,1,8).merge().setValue('🔶 スタッフ・ボランティア車両'); styleH2(sh.getRange(s2,1,1,8)); sh.setRowHeight(s2,36);
  const sh2 = ['No.','代表者名','車両台数','同乗者','入り日時','出発地','撤収/帰路','備考'];
  sh.getRange(s2+1,1,1,8).setValues([sh2]); styleColHeader(sh.getRange(s2+1,1,1,8)); sh.setRowHeight(s2+1,30);

  const sveh = [
    [1,'井原麻耶（Maya Saito）','1台','1名','7/2（木）16〜17時着','大阪方面','TBD','カメラチーム ✅確定'],
    [2,'三賀真生（Mao Sanga）','1台','大阪から2名同乗可','7/2（木）夜中','大阪発','TBD','設営ボランティア ✅確定'],
    [3,'東谷隆太','1台','1名','7/2夜中〜7/3朝イチ','大阪方面','TBD','設営ボランティア ✅確定'],
    [4,'荻山','1台','1名','7/3（金）朝イチ','大阪方面','7/5（日）午前発','設営ボランティア ✅確定'],
    [5,'田中秋水（Shusui Tanaka）','1台','1名','7/3（金）朝イチ','大阪方面','TBD','設営ボランティア ✅確定'],
    [6,'市健太朗（Ichi）\n+ 東谷れお + 奥山星也','1台','3名','7/3（金）朝イチ','大阪方面','TBD','設営ボランティア ✅確定'],
    [7,'橋本航（Wataru Hashimoto）','1台','1名','7/3（金）夜着','大阪方面','TBD','設営ボランティア ✅確定'],
    [8,'池上健太（KAGAMI JAPAN）','1台','1名','7/3（金）14:00着','TBD','TBD','カメラボランティア ✅確定'],
    [9,'濵田隆史（カメラ）','0台','0名（送迎依頼）','7/2（木）12:00 新大阪発（アーティスト送迎便）','新大阪','TBD','カメラ ✅確定'],
  ];
  sveh.forEach((r,i) => {
    const rn = s2+2+i;
    sh.getRange(rn,1,1,r.length).setValues([r]);
    sh.getRange(rn,1,1,8).setBackground(i%2===0?C.ROW_A_BG:C.ROW_B_BG).setFontColor(C.DARK)
      .setVerticalAlignment('middle').setBorder(true,true,true,true,true,true,'#CCCCCC',SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(rn,2).setFontWeight('bold'); sh.setRowHeight(rn,40);
  });
  sh.setFrozenRows(4);
}

// ───────────────────────────────────────────
// 🎤 アーティストケア — 35エントリー完全版（①準拠）
// ───────────────────────────────────────────

function createArtistCareSheet_v2(ss) {
  const sh = getOrCreateSheet(ss, '🎤 アーティストケア');
  sh.clear(); sh.setTabColor('#7B1B5E');

  [30,80,180,70,100,90,80,80,50,80,130,200].forEach((w,i) => sh.setColumnWidth(i+1,w));

  sh.getRange('A1:L1').merge().setValue('🎤 MOMENT 2026 — アーティストケア管理 全35組'); styleH1(sh.getRange('A1:L1'));
  sh.getRange('A2:L2').merge()
    .setValue('ケア: MARIA（ピンク）/ TUI（ブルー）/ LOE（グリーン）/ BUNDO（オレンジ）｜ International: Gordon/Morgan/Azu Tiwaline/JakoJako/Hybrid Man');
  sh.getRange('A2:L2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2,28);

  const HEADERS = ['No.','ケア担当','アーティスト名','出演DAY','出演時間','ステージ','チェックイン','チェックアウト','人数','宿泊タイプ','宿名','備考・特記事項'];
  sh.getRange(3,1,1,12).setValues([HEADERS]); styleColHeader(sh.getRange(3,1,1,12));
  sh.setRowHeight(3,32); sh.setFrozenRows(3);

  const careColor = {
    'MARIA': [C.MARIA_BG, C.MARIA_FG],
    'TUI':   [C.TUI_BG,   C.TUI_FG],
    'LOE':   [C.LOE_BG,   C.LOE_FG],
    'BUNDO': [C.BUNDO_BG, C.BUNDO_FG],
    '-':     [C.ROW_B_BG, C.DARK],
  };

  // No | ケア担当 | アーティスト名 | 出演DAY | 出演時間 | ステージ | チェックイン | チェックアウト | 人数 | 宿泊タイプ | 宿名 | 備考
  const artists = [
    [1, 'MARIA','Kuniyuki','DAY2','23:30-01:30','MAIN','7/3','7/5','1名','旅館','いろは旅館','フライト：新千歳→関空 14:05着　出：関空 15:10'],
    [2, 'MARIA','JakoJako (Live)','DAY2','20:30-21:30','MAIN','7/3','7/5','2名','旅館','いろは旅館','🌱ベジタリアン（Sibel）　出：新大阪 7/6'],
    [3, 'MARIA','Azu Tiwaline','DAY1','15:00-17:00','MAIN','7/2','7/3','1名','旅館','あたらしや旅館','⚠️ 重要：7/3 17:30 関空送り　帰り便 KIX 22:10'],
    [4, 'MARIA','Hybrid Man','DAY3','15:00-16:00','MAIN','7/4','7/6','8名','旅館','いろは旅館','🌱ベジタリアン（Julien）　追加分支払い要 / 2部屋'],
    [5, 'TUI','Morgan','DAY2','03:00-05:00','BAR','7/3','7/5','1名','旅館','いろは旅館','フライト：PEK→関空 12:40着'],
    [6, 'MARIA','Gordon','DAY1','23:00-01:00','MAIN','7/1','7/3','4名','旅館','いろは旅館','自家用車駐車 ✔　延泊分・友人分追加支払い要'],
    [7, 'TUI','CHIDA','DAY3','12:00-15:00','MAIN','7/3','7/5','1名','バンガロー','会場内',''],
    [8, 'LOE','Taihei','DAY2','12:30-14:30','MAIN','7/3','7/5','1名','バンガロー','会場内',''],
    [9, 'MARIA','Yamarchy','DAY2','05:00-07:00','BAR','7/3','7/5','1名','バンガロー','会場内',''],
    [10,'BUNDO','Akira Arasawa','DAY2','01:00-03:00','BAR','7/3','7/5','1名','バンガロー','会場内','自家用車駐車 ✔'],
    [11,'BUNDO','Zundoko Disco','DAY1','01:00-03:00','BAR','7/3','7/5','2名','バンガロー','会場内',''],
    [12,'LOE','You Forgot','DAY1','21:00-23:00','MAIN','7/3','7/6','2名','旅館','いろは旅館','追加3名（合計4名）'],
    [13,'LOE','Natsuki','DAY1','03:00-05:00','BAR','7/3','7/5','2名','旅館','いろは旅館',''],
    [14,'BUNDO','Olive oil','DAY2','14:30-16:30','MAIN','7/3','7/4','1名','旅館','あたらしや旅館',''],
    [15,'MARIA','鏡民','DAY1','17:00-19:00','MAIN','7/2','7/5','1名','旅館','いろは旅館','⚠️ 迎え：下市口 7/2（要確認）'],
    [16,'BUNDO','CMT','DAY3','23:15-01:00','AFTER','7/4','7/6','1名','旅館','いろは旅館',''],
    [17,'TUI','KAGE','DAY3','19:45-21:30','AFTER','7/3','7/6','1名','テント','-','自家用車駐車 ✔'],
    [18,'MARIA','KAZUMA ONISHI','DAY1','14:30-15:00','MAIN','7/3','7/5','1名','バンガロー','会場内','🎵 Opening Ceremony'],
    [19,'MARIA','TOKIO AOYAMA','全日','LIVE PAINT','LIVE PAINT','7/2','7/5','1名','バンガロー','会場内','自家用車 ✔ / ライブペイント'],
    [20,'MARIA','Gravityfree','全日','LIVE PAINT','LIVE PAINT','7/3','7/5','1名','バンガロー','会場内','自家用車 ✔ / ライブペイント'],
    [21,'MARIA','小保方まげ子','全日','LIVE PAINT','LIVE PAINT','7/3','7/5','1名','テント','-','自家用車 ✔ / ライブペイント'],
    [22,'-','アヤ オーシマ','全日','LIVE PAINT','LIVE PAINT','7/3','7/5','1名','テント','-','MOMENT BUSで来場 / ライブペイント'],
    [23,'MARIA','YAMA','DAY3','21:30-23:15','AFTER','7/4','7/6','1名','旅館','いろは旅館',''],
    [24,'-','MOMO','DAY3','18:00-19:45','AFTER','7/3','7/5','1名','テント','-','自家用車 ✔'],
    [25,'LOE','Hideo Nakasako','DAY3','11:00-12:00','MAIN','7/4','7/5','1名','テント','-','自家用車 ✔ / BSでコーヒー（詳細未定）'],
    [26,'MARIA','Elements Link','DAY2','10:00-11:00','WORKSHOP','7/3','7/5','1名','テント','-','自家用車 ✔×2台 / ワークショップ'],
    [27,'MARIA','Musuhi','DAY1','14:30-15:00','MAIN','7/3','7/5','1名','テント','-','自家用車 ✔ / Opening Ceremony'],
    [28,'-','DJ MARIA.','DAY2','18:30-20:30','MAIN','7/3','7/5','1名','バンガロー','-','交通費込み'],
    [29,'-','Endurance','DAY2','11:00-12:30','MAIN','7/3','7/5','1名','テント','-','レンタカー代金込み'],
    [30,'-','DJ Senoh','DAY1','19:00-21:00','MAIN','7/3','7/5','1名','バンガロー','-',''],
    [31,'-','yu1','DAY3','16:00-18:00','MAIN','7/3','7/5','1名','テント','-',''],
    [32,'-','YMT','DAY2','16:30-18:30','MAIN','7/3','7/5','1名','テント','-',''],
    [33,'-','DJ HI-C','DAY2','21:30-23:30','MAIN','7/3','7/5','1名','バンガロー','-',''],
    [34,'-','hiroo tachibana','DAY1','14:30-15:00','MAIN','7/3','7/3','1名','テント','-','🎵 Opening Ceremony / 村の人 / カフェ空送迎'],
    [35,'-','Carlos Sulpizio','全日','LIVE PAINT','LIVE PAINT','7/3','7/5','1名','テント','-','MOMENT BUS×2 / ライブペイント'],
  ];

  artists.forEach((r,i) => {
    const rn = 4+i;
    sh.getRange(rn,1,1,r.length).setValues([r]);
    const care = String(r[1]);
    const [bg,fg] = careColor[care] || [i%2===0?C.ROW_A_BG:C.ROW_B_BG, C.DARK];
    sh.getRange(rn,1,1,12).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
      .setBorder(true,true,true,true,true,true,'#CCCCCC',SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(rn,3).setFontWeight('bold');
    sh.getRange(rn,2).setFontWeight('bold');
    sh.setRowHeight(rn,32);
  });

  const sumRow = 4+artists.length+1;
  sh.getRange(sumRow,1,1,12).merge()
    .setValue('【35組全員掲載】MARIA: 1/2/3/4/6/9/15/18/19/20/21/23/26/27 ｜ TUI: 5/7/17 ｜ LOE: 8/12/13/25 ｜ BUNDO: 10/11/14/16 ｜ -（運営兼任）: 22/24/28/29/30/31/32/33/34/35');
  sh.getRange(sumRow,1,1,12).setBackground(C.H2_BG).setFontColor(C.GOLD)
    .setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle').setFontWeight('bold');
  sh.setRowHeight(sumRow,36);
}

// ───────────────────────────────────────────
// 🎵 タイムテーブル — 全33組 ①準拠 ステージ色分け
// ───────────────────────────────────────────

function createTimeTableSheet_v2(ss) {
  const sh = getOrCreateSheet(ss, '🎵 タイムテーブル（暫定）');
  sh.clear(); sh.setTabColor('#1B4D7B');

  [80,180,100,80,70,70,220].forEach((w,i) => sh.setColumnWidth(i+1,w));

  sh.getRange('A1:G1').merge().setValue('🎵 MOMENT 2026 — タイムテーブル 全33組'); styleH1(sh.getRange('A1:G1'));
  sh.getRange('A2:G2').merge()
    .setValue('MAIN🔵 / BAR🩵 / AFTER🩵 / WORKSHOP🟣 / LIVE PAINT🟠 ｜ 2026年7月3日（金）15:00スタート → 7月5日（日）クロージング');
  sh.getRange('A2:G2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2,28);

  const HEADERS = ['時刻','アーティスト / 出演者','ステージ','ケア担当','IN','OUT','備考・特記事項'];
  sh.getRange(3,1,1,7).setValues([HEADERS]); styleColHeader(sh.getRange(3,1,1,7));
  sh.setRowHeight(3,32); sh.setFrozenRows(3);

  const stageColor = {
    'MAIN':       [C.STAGE_MAIN_BG,      C.STAGE_MAIN_FG],
    'BAR':        [C.STAGE_BAR_BG,       C.STAGE_BAR_FG],
    'AFTER':      [C.STAGE_AFTER_BG,     C.STAGE_AFTER_FG],
    'WORKSHOP':   [C.STAGE_WORKSHOP_BG,  C.STAGE_WORKSHOP_FG],
    'LIVE PAINT': [C.STAGE_LIVEPAINT_BG, C.STAGE_LIVEPAINT_FG],
    'SPECIAL':    [C.STAGE_SPECIAL_BG,   C.STAGE_SPECIAL_FG],
  };

  // [時刻, アーティスト, ステージ, ケア担当, IN, OUT, 備考]
  const days = [
    { label: '🎵 DAY 1  --  7/3（金）スタート 15:00〜  (8組)', rows: [
      ['14:30','Opening Ceremony (hiroo tachibana / KAZUMA ONISHI / Musuhi)','MAIN','MARIA','7/3','7/3','🎵 Opening〜村の人・カフェ空送迎'],
      ['15:00','Azu Tiwaline','MAIN','MARIA','7/2','7/3','⚠️ 終演後17:30 関空送り KIX22:10'],
      ['17:00','鏡民','MAIN','MARIA','7/2','7/5','⚠️ 迎え：下市口7/2（要確認）'],
      ['19:00','DJ Senoh','MAIN','-','7/3','7/5',''],
      ['21:00','You Forgot','MAIN','LOE','7/3','7/6','追加3名（合計4名）'],
      ['23:00','Gordon','MAIN','MARIA','7/1','7/3','自家用車駐車 ✔　延泊分追加支払い要'],
      ['1:00','Zundoko Disco','BAR','BUNDO','7/3','7/5',''],
      ['3:00','Natsuki','BAR','LOE','7/3','7/5',''],
    ]},
    { label: '🎵 DAY 2  --  7/4（土）  (12組)', rows: [
      ['10:00','Elements Link','WORKSHOP','MARIA','7/3','7/5','自家用車✔×2台 / ワークショップ'],
      ['11:00','Endurance','MAIN','-','7/3','7/5','レンタカー代金込み'],
      ['12:30','Taihei','MAIN','LOE','7/3','7/5',''],
      ['14:30','Olive oil','MAIN','BUNDO','7/3','7/4',''],
      ['16:30','YMT','MAIN','-','7/3','7/5',''],
      ['18:30','DJ MARIA.','MAIN','-','7/3','7/5','交通費込み'],
      ['20:30','JakoJako (Live)','MAIN','MARIA','7/3','7/5','🌱ベジタリアン（Sibel）'],
      ['21:30','DJ HI-C','MAIN','-','7/3','7/5',''],
      ['23:30','Kuniyuki','MAIN','MARIA','7/3','7/5','フライト：新千歳→関空14:05着'],
      ['1:00','Akira Arasawa','BAR','BUNDO','7/3','7/5','自家用車駐車 ✔'],
      ['3:00','Morgan','BAR','TUI','7/3','7/5','フライト：PEK→関空12:40着'],
      ['5:00','Yamarchy','BAR','MARIA','7/3','7/5',''],
    ]},
    { label: '🎵 DAY 3  --  7/5（日）クロージング  (8組)', rows: [
      ['11:00','Hideo Nakasako','MAIN','LOE','7/4','7/5','自家用車 ✔ / BSでコーヒー（詳細未定）'],
      ['12:00','CHIDA','MAIN','TUI','7/3','7/5',''],
      ['15:00','Hybrid Man','MAIN','MARIA','7/4','7/6','🌱ベジタリアン（Julien）/ 2部屋'],
      ['16:00','yu1','MAIN','-','7/3','7/5',''],
      ['18:00','MOMO','AFTER','-','7/3','7/5','自家用車 ✔'],
      ['19:45','KAGE','AFTER','TUI','7/3','7/6','自家用車駐車 ✔'],
      ['21:30','YAMA','AFTER','MARIA','7/4','7/6',''],
      ['23:15','CMT','AFTER','BUNDO','7/4','7/6',''],
    ]},
    { label: '🎨 全日  --  LIVE PAINT / 演出  (5組)', rows: [
      ['全日','TOKIO AOYAMA','LIVE PAINT','MARIA','7/2','7/5','自家用車 ✔ / ライブペイント'],
      ['全日','Gravityfree','LIVE PAINT','MARIA','7/3','7/5','自家用車 ✔ / ライブペイント'],
      ['全日','小保方まげ子','LIVE PAINT','MARIA','7/3','7/5','自家用車 ✔ / ライブペイント'],
      ['全日','アヤ オーシマ','LIVE PAINT','-','7/3','7/5','MOMENT BUSで来場 / ライブペイント'],
      ['全日','Carlos Sulpizio','LIVE PAINT','-','7/3','7/5','MOMENT BUS×2 / ライブペイント'],
    ]},
  ];

  let row = 4;
  days.forEach(day => {
    sh.getRange(row,1,1,7).merge().setValue('── ' + day.label + ' ──');
    sh.getRange(row,1,1,7).setBackground(C.H2_BG).setFontColor(C.GOLD)
      .setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.setRowHeight(row,32); row++;

    day.rows.forEach(r => {
      sh.getRange(row,1,1,7).setValues([r]);
      const stage = r[2];
      const [bg,fg] = stageColor[stage] || [C.ROW_A_BG, C.DARK];
      sh.getRange(row,1,1,7).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
        .setBorder(true,true,true,true,true,true,'#CCCCCC',SpreadsheetApp.BorderStyle.SOLID);
      sh.getRange(row,2).setFontWeight('bold');
      sh.getRange(row,3).setFontWeight('bold').setHorizontalAlignment('center');
      sh.setRowHeight(row,32); row++;
    });
  });

  // 凡例
  const leg = row+1;
  sh.getRange(leg,1,1,7).merge().setValue(
    '■ 凡例：MAIN（青）= メインステージ ｜ BAR（水色）= BARブース ｜ AFTER（濃水）= アフターパーティー at BARブース ｜ WORKSHOP（紫）= ワークショップ ｜ LIVE PAINT（橙）= ライブペイント'
  );
  sh.getRange(leg,1,1,7).setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(9)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(leg,28);
}

// ───────────────────────────────────────────
// 🍱 賄い管理 — グループ別 食数管理
// ───────────────────────────────────────────

function createMakanaishiSheet_v2(ss) {
  const sh = getOrCreateSheet(ss, '🍱 賄い管理');
  sh.clear(); sh.setTabColor('#1B7B2C');

  // 5列: グループ | 人数 | 昼 | 18時 | 備考
  [220, 70, 90, 90, 320].forEach((w,i) => sh.setColumnWidth(i+1,w));

  sh.getRange('A1:E1').merge().setValue('🍱 MOMENT 2026 — 賄い 食数管理（グループ別）7/3〜7/5');
  styleH1(sh.getRange('A1:E1'));
  sh.setRowHeight(1, 50);

  sh.getRange('A2:E2').merge()
    .setValue('数値 = 提供食数 ｜ - = 提供なし ｜ 提供回数: 昼 / 18時 の2回 ｜ ※アーティスト分は別途加算');
  sh.getRange('A2:E2').setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 28);

  sh.getRange(3, 1, 1, 5).setValues([['グループ', '人数', '昼', '18時', '備考']]);
  styleColHeader(sh.getRange(3, 1, 1, 5));
  sh.getRange(3, 2, 1, 3).setHorizontalAlignment('center');
  sh.setRowHeight(3, 36);
  sh.setFrozenRows(3);

  const D = '-';
  // days: [{ noon, e }] for 7/3, 7/4, 7/5  (e = 18時)
  const groups = [
    {
      name: 'MOMENTメンバー（コアスタッフ）',
      count: 6,
      days: [{ noon:6, e:6 }, { noon:6, e:6 }, { noon:6, e:6 }],
      bg: C.CAT_MOMENT_BG, fg: C.CAT_MOMENT_FG,
      note: 'HI-C / MARIA / 妹尾 / YMT / 南城 / 中道 ｜ 全日6食提供（昼+18時×3日）',
    },
    {
      name: '公式スタッフ（音響/照明/電源/映像/舞台監督/デコ/LIVE PAINT等）',
      count: '27名＋α',
      // 技術8名 + デコ14名(ZIGN6+Samaya8) + LIVE PAINT 5名 = 27名固定
      // 7/5 18時: デコ撤収済みのためLIVE PAINT 5名のみ
      days: [{ noon:27, e:27 }, { noon:27, e:27 }, { noon:22, e:5 }],
      bg: C.PAID_BG, fg: C.PAID_FG,
      note: '技術8名（SOL/kamba/山脇Shu/Ruriko/KAMADEN/VERY/CRACKWORKS/宮野）＋デコ14名＋LIVE PAINT 5名 ｜ ※アーティスト（20〜35名）は別途加算',
    },
    {
      name: 'ボランティア',
      count: 103,
      // 7/3: 103名 / 7/4〜7/5: 設営班6名が抜けて97名
      days: [{ noon:103, e:103 }, { noon:97, e:97 }, { noon:97, e:97 }],
      bg: C.VOL_BG, fg: C.VOL_FG,
      note: '7/3: 103名 / 7/4〜7/5: 97名（設営班6名は7/3まで）',
    },
  ];

  const DAY_LABELS = ['7/3（金）', '7/4（土）', '7/5（日）'];
  let row = 4;
  const dayTotals = [];

  for (let d = 0; d < 3; d++) {
    // 日付バナー
    sh.getRange(row, 1, 1, 5).merge().setValue('━━  ' + DAY_LABELS[d] + '  ━━');
    sh.getRange(row, 1, 1, 5)
      .setBackground(C.H2_BG).setFontColor(C.GOLD)
      .setFontWeight('bold').setFontSize(13)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBorder(true,true,true,true,false,false,'#444488',SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sh.setRowHeight(row, 38);
    row++;

    let dtN = 0, dtE = 0;

    groups.forEach(g => {
      const day = g.days[d];
      const nV = day.noon > 0 ? day.noon : D;
      const eV = day.e   > 0 ? day.e   : D;

      sh.getRange(row, 1, 1, 5).setValues([
        [g.name,
         typeof g.count === 'number' ? g.count + '名' : g.count,
         nV, eV,
         d === 0 ? g.note : '']
      ]);
      sh.getRange(row, 1, 1, 5)
        .setBackground(g.bg).setFontColor(g.fg)
        .setVerticalAlignment('middle')
        .setBorder(true,true,true,true,true,true,'#CCCCCC',SpreadsheetApp.BorderStyle.SOLID);
      sh.getRange(row, 1).setFontWeight('bold').setHorizontalAlignment('left');
      sh.getRange(row, 2).setHorizontalAlignment('center').setFontWeight('bold').setFontSize(12);
      sh.getRange(row, 3, 1, 2).setHorizontalAlignment('center').setFontWeight('bold').setFontSize(15);
      sh.getRange(row, 5).setHorizontalAlignment('left').setFontSize(9).setFontWeight('normal');
      sh.setRowHeight(row, 42);

      // 食数ありのセルを緑強調
      [{ c:3, v:day.noon }, { c:4, v:day.e }].forEach(({c,v}) => {
        if (v > 0) sh.getRange(row,c).setBackground('#C8E6C9').setFontColor('#1B5E20');
      });

      dtN += day.noon; dtE += day.e;
      row++;
    });

    dayTotals.push({ n: dtN, e: dtE });
    const dt = dayTotals[d];

    // 日計行
    sh.getRange(row, 1, 1, 5).setValues([
      [DAY_LABELS[d] + '　合計', '', dt.n, dt.e,
       '※アーティスト分（約20〜35名）を加算すること']
    ]);
    sh.getRange(row, 1, 1, 5)
      .setBackground(C.TOTAL_BG).setFontColor(C.TOTAL_FG)
      .setFontWeight('bold').setFontSize(12)
      .setVerticalAlignment('middle')
      .setBorder(true,true,true,true,false,false,'#000000',SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sh.getRange(row, 1).setHorizontalAlignment('left');
    sh.getRange(row, 3, 1, 2).setHorizontalAlignment('center').setFontSize(17);
    sh.getRange(row, 5).setHorizontalAlignment('left').setFontSize(9).setFontWeight('normal');
    sh.setRowHeight(row, 46);
    row++;
  }

  // 3日間 グランド合計
  const gN     = dayTotals.reduce((s,t) => s + t.n, 0);
  const gE     = dayTotals.reduce((s,t) => s + t.e, 0);
  const gTotal = gN + gE;
  sh.getRange(row, 1, 1, 5).setValues([
    ['3日間 合計（アーティスト除く）', '', gN, gE,
     '合計 ' + gTotal + '食（≈）｜ アーティスト分を加算してオーダー数を確定']
  ]);
  sh.getRange(row, 1, 1, 5)
    .setBackground('#0D0D1A').setFontColor(C.GOLD)
    .setFontWeight('bold').setFontSize(13)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true,true,true,true,false,false,'#C9A84C',SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.getRange(row, 1).setHorizontalAlignment('left');
  sh.getRange(row, 3, 1, 2).setFontSize(19);
  sh.getRange(row, 5).setHorizontalAlignment('left').setFontSize(9).setFontWeight('normal');
  sh.setRowHeight(row, 54);
  row++;

  // アレルギー注意書き
  sh.getRange(row, 1, 1, 5).merge()
    .setValue('🌱 アレルギー・食事制限: JakoJako / Sibel ベジタリアン ｜ Hybrid Man (Julien) ベジタリアン ｜ ※個別対応要確認');
  sh.getRange(row, 1, 1, 5).setBackground(C.ALERT_BG).setFontColor(C.ALERT_FG)
    .setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true,true,true,true,false,false,'#FFD700',SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeight(row, 36);
}

// ───────────────────────────────────────────
// 📞 スタッフ緊急連絡先
// ───────────────────────────────────────────

function createContactSheet_v2(ss) {
  const sh = getOrCreateSheet(ss, '📞 スタッフ緊急連絡先');
  sh.clear(); sh.setTabColor('#7B0000');
  [30,80,180,160,120,180].forEach((w,i) => sh.setColumnWidth(i+1,w));

  sh.getRange('A1:F1').merge().setValue('📞 MOMENT 2026 — スタッフ緊急連絡先'); styleH1(sh.getRange('A1:F1'));
  sh.getRange('A2:F2').merge()
    .setValue('⚠️ このシートの内容は関係者限定情報です。外部共有・個人情報の無断開示禁止。');
  sh.getRange('A2:F2').setBackground('#7B0000').setFontColor('#FFD700').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setFontWeight('bold');
  sh.setRowHeight(2,28);

  const HEADERS = ['#','役割','名前','電話番号','LINE/SNS','担当エリア・備考'];
  sh.getRange(3,1,1,6).setValues([HEADERS]); styleColHeader(sh.getRange(3,1,1,6));
  sh.setRowHeight(3,32); sh.setFrozenRows(3);

  const sections = [
    { label: '── MOMENT運営コア ──', rows: [
      [1,'総合責任者','Mike（桃瀬）','-','-','全体 / オーナー・最終判断'],
      [2,'音響責任者','SOL','-','-','MAIN STAGE音響 / D&B'],
      [3,'BAR音響','kamba','-','-','BAR STAGE音響'],
      [4,'照明責任者','山脇 Shu','-','-','照明全般'],
      [5,'照明','Ruriko Hosono','-','-','照明'],
      [6,'電源責任者','KAMADEN','-','-','電源・発電機'],
      [7,'電源サポート','VERY','-','-','BAR電源'],
      [8,'VJ','CRACKWORKS（モリグチ）','-','-','映像・VJ'],
    ]},
    { label: '── アーティストケアチーム ──', rows: [
      [9, 'アーティストケア','MARIA','-','-','アーティスト管理 担当No: 1/2/3/4/6/9/15/18/19/20/21/23/26/27'],
      [10,'アーティストケア','TUI','-','-','アーティスト管理 担当No: 5/7/17'],
      [11,'アーティストケア','LOE','-','-','アーティスト管理 担当No: 8/12/13/25'],
      [12,'アーティストケア','BUNDO','-','-','アーティスト管理 担当No: 10/11/14/16'],
    ]},
    { label: '── チームリーダー ──', rows: [
      [13,'BARチームリーダー','田岡 太一','-','-','BAR運営 / 飲料在庫管理'],
      [14,'舞台監督','宮野拓人','-','-','ステージ管理'],
      [15,'エントランス担当','-','-','-','エントランス'],
    ]},
    { label: '── 緊急連絡先 ──', rows: [
      [16,'洞川キャンプ場 管理者','会場管理','-','-','緊急時 / 奈良県吉野郡天川村洞川943番地15'],
      [17,'吉野警察署','警察','-','-','道路使用許可申請済'],
      [18,'救急・消防','緊急時','119','-','最優先'],
    ]},
  ];

  let row = 4;
  sections.forEach(sec => {
    sh.getRange(row,1,1,6).merge().setValue(sec.label);
    sh.getRange(row,1,1,6).setBackground(C.H2_BG).setFontColor(C.GOLD)
      .setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.setRowHeight(row,28); row++;

    sec.rows.forEach((r,i) => {
      const rn = row;
      sh.getRange(rn,1,1,r.length).setValues([r]);
      const isEmergency = String(r[3]).includes('119');
      const bg = isEmergency?'#FFEBEE' : i%2===0?C.ROW_A_BG:C.ROW_B_BG;
      const fg = isEmergency?'#B71C1C' : C.DARK;
      sh.getRange(rn,1,1,6).setBackground(bg).setFontColor(fg).setVerticalAlignment('middle')
        .setBorder(true,true,true,true,true,true,'#CCCCCC',SpreadsheetApp.BorderStyle.SOLID);
      if (r[2]) sh.getRange(rn,3).setFontWeight('bold');
      sh.setRowHeight(rn,30); row++;
    });
  });
}

// ───────────────────────────────────────────
// 👥 ボランティア管理
// ───────────────────────────────────────────

function createVolunteerSheet(ss) {
  const sh = getOrCreateSheet(ss, '👥 ボランティア管理');
  sh.clear(); sh.setTabColor('#1B5E20');

  // No|名前|フリガナ|決定ポジション|到着日|出発日|来場方法|免許|紹介者|備考
  [40,160,140,140,80,80,100,60,120,180].forEach((w,i) => sh.setColumnWidth(i+1,w));

  sh.getRange('A1:J1').merge().setValue('👥 MOMENT 2026 — ボランティア管理（業務別）'); styleH1(sh.getRange('A1:J1'));
  const sub = sh.getRange('A2:J2');
  sub.merge().setValue('総勢103名 ｜ ボランティアフォーム回答データ ｜ ソース: 1tVEmUOELKBQTkDGew6jRmWaqqlCLwz61wIvRCKFuF_Q ｜ 2026/06/27時点 ｜ ※電話・メール非掲載');
  sub.setBackground(C.H2_BG).setFontColor(C.GOLD).setFontSize(9)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2,26);

  const HEADERS = ['No','名前','フリガナ','決定ポジション','到着日','出発日','来場方法','免許','紹介者','備考'];
  sh.getRange(3,1,1,10).setValues([HEADERS]); styleColHeader(sh.getRange(3,1,1,10));
  sh.setRowHeight(3,32); sh.setFrozenRows(3);

  const depts = [
    { name:'BARスタッフ',     bg:'#B2EBF2', fg:'#005070',
      members:['Sara','清澤 未来','須知 杏奈','須山 あを','田村 友理佳','藤田 真由','松村 潤人','芹沢 孝哉',
               'Acushla Ayla','松本 葵','矢部 優花','山口 空','Hao Bui','Jiri Swen','Patrick Lothoz',
               '佐藤 雄亮','東宮 慎之助','Natalia Ramadori','菱川 晶','Planelles Leo'] },
    { name:'エントランス（受付）', bg:'#C8E6C9', fg:'#1B5E20',
      members:['Aurelia Jessica','穴沢 有希奈','粟井 真結','粟井 萌絵','伊藤 はるか','宇良 匡士郎',
               '多田 小春','服部 香琳','保科 巴蓮','Mykyta Kovalenko','宮崎 恵巳','山野 穂佳'] },
    { name:'セキュリティ',    bg:'#BBDEFB', fg:'#0D47A1',
      members:['Geordie Wilson','稲井 千夏','猪田 由理子','北村 美咲','金 愛奈','キム チュナ',
               '重里 久史','瀬古 麗菜','竹 春乃','谷口 能也','Ho Wai Sze','Malorie Stanley','山崎 優子'] },
    { name:'荷物検査',        bg:'#FFF9C4', fg:'#7B5A00',
      members:['伊禮 心夏','小野 陽向','新城 弘樹','多田 浩平','野田 レキオ','橋本 航'] },
    { name:'場外駐車場',      bg:'#E1BEE7', fg:'#4A0E7B',
      members:['浅津 梨子','杉木 望愛','小川 遼馬','石本 耀介','鷲尾 昂世','渡邉 龍矢',
               'サジャル アユミ ツボイ','コナーズ 東満寿','小林 佳蓮','中野 翔太',
               '末廣 啓史','田中 愛佳','高橋 謙仁朗'] },
    { name:'場内駐車場',      bg:'#F8BBD0', fg:'#880E4F',
      members:['鍛治 尚英','若園 優世','村上 圭','関 翔馬','米谷 航','アテュエニ ジュニア','菅沼 千夏'] },
    { name:'シャトルバス',    bg:'#FFE0B2', fg:'#6B4500',
      members:['伊東 憲輝','岩崎 正亨','佐伯 安王','大関 翠','岡崎 佑生','柏村 享也','山崎 力輝夫'] },
    { name:'アーティストケア', bg:'#FCEEF5', fg:'#7B1B5E',
      members:['大井 博絵','筒井 和斗','分藤 貴文','Kipp Hendricks'] },
    { name:'アーティスト送迎', bg:'#EEF5FC', fg:'#1B4D7B',
      members:['東 颯太朗','狩俣 力士'] },
    { name:'キッズエリア',    bg:'#DCEDC8', fg:'#33691E',
      members:['柏村 郁美','西島 春菜','野口 房子','橋本 瞳衣','Betsie K Slaby'] },
    { name:'設営/撤収',       bg:'#EDE7F6', fg:'#4A0E7B',
      members:['溝口 秋平','伊藤 楽','コステロ 是允','竹内 涼平','Mori Silva Hugo Tadashi','金沢 真由'] },
    { name:'舞台監督補佐',    bg:'#E8EAF6', fg:'#1A1A3C',
      members:['田村 かれん'] },
    { name:'カメラ/映像',     bg:'#F3E5F5', fg:'#4A0E7B',
      members:['jacK'] },
    { name:'出店サポート',    bg:'#FFF5EE', fg:'#7B3B1B',
      members:['坂元 大輔','作山 けいと','中村 利玖'] },
    { name:'物販',            bg:'#FFF9E6', fg:'#6B4500',
      members:['姫野 尚紀','コステロ 誌苑'] },
    { name:'トイレマネージャー', bg:'#E8F8F5', fg:'#0E5C48',
      members:['中道 大雅'] },
  ];

  let row = 4;
  let no  = 1;

  depts.forEach(dept => {
    // 部署ヘッダー行
    sh.getRange(row,1,1,10).merge()
      .setValue('■ ' + dept.name + '（' + dept.members.length + '名）');
    sh.getRange(row,1,1,10)
      .setBackground(dept.bg).setFontColor(dept.fg)
      .setFontWeight('bold').setFontSize(11)
      .setHorizontalAlignment('left').setVerticalAlignment('middle')
      .setBorder(true,true,true,true,false,false,'#888888',SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sh.setRowHeight(row,38); row++;

    // メンバー行
    dept.members.forEach((name,i) => {
      sh.getRange(row,1,1,10).setValues([[no, name, '', dept.name, '', '', '', '', '', '']]);
      sh.getRange(row,1,1,10)
        .setBackground(i%2===0 ? C.ROW_A_BG : C.ROW_B_BG)
        .setFontColor(C.DARK).setVerticalAlignment('middle')
        .setBorder(true,true,true,true,true,true,'#CCCCCC',SpreadsheetApp.BorderStyle.SOLID);
      sh.getRange(row,2).setFontWeight('bold');
      sh.setRowHeight(row,28);
      no++; row++;
    });
  });

  // 合計行
  sh.getRange(row,1,1,10).merge()
    .setValue('✅ ボランティア合計 ' + (no-1) + '名 ｜ ※ EXCLUDE: コワセ（マホ）・大野挙汰（キャンセル）');
  sh.getRange(row,1,1,10)
    .setBackground(C.TOTAL_BG).setFontColor(C.TOTAL_FG)
    .setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true,true,true,true,false,false,'#000000',SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.setRowHeight(row,36);

  // フィルター（ヘッダー行から）
  if (row > 3) sh.getRange(3,1,row-3,10).createFilter();
}

// ───────────────────────────────────────────
// シート順番整理
// ───────────────────────────────────────────

function reorderSheets_v2(ss) {
  const ORDER = [
    '🌟 表紙','📅 工程表（全体）','📅 工程表（MOMENTチーム）',
    '🚛 トラック運行表','🎤 アーティストケア','🎵 タイムテーブル（暫定）',
    '🍱 賄い管理','📞 スタッフ緊急連絡先','👥 ボランティア管理',
  ];
  ORDER.forEach((name,idx) => {
    const sh = ss.getSheetByName(name);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(idx+1); }
  });
}

// ───────────────────────────────────────────
// ヘルパー関数
// ───────────────────────────────────────────

function getOrCreateSheet(ss, name) {
  if (BOT_PROTECTED.includes(name)) throw new Error('ボット保護シートは変更できません: ' + name);
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); Logger.log('新規シート作成: '+name); }
  else { Logger.log('既存シートを再構築: '+name); }
  return sh;
}

function styleH1(range) {
  range.setBackground(C.H1_BG).setFontColor(C.GOLD).setFontSize(16)
    .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  range.getSheet().setRowHeight(range.getRow(), 52);
}

function styleH2(range) {
  range.setBackground(C.H2_BG).setFontColor(C.WHITE).setFontSize(13)
    .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
}

function styleColHeader(range) {
  range.setBackground(C.COL_HDR_BG).setFontColor(C.WHITE).setFontSize(10)
    .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true,true,true,true,true,true,'#111133',SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}
