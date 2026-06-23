/**
 * MOMENT 2026 タスク・スケジュール管理システム
 * ================================================
 * 【使い方】
 * 1. script.google.com で新しいプロジェクトを作成
 * 2. このコードをエディタに全選択して貼り付け
 * 3. 関数選択欄で「createManagementSystem」を選んで実行
 * 4. 作成されたスプレッドシートをブックマーク
 *
 * 【LINE更新方法】
 * - 「LINE取込」シートにトーク履歴を貼り付け
 * - 「タスク抽出」ボタンを押す
 * ================================================
 */

// ══════════════════════════════════════
// カラー定数
// ══════════════════════════════════════
const C = {
  NAVY:   '#0a1628', WHITE: '#ffffff', LIGHT: '#f5f8ff',
  STATUS: {
    '対応中': '#fff9c4', '完了': '#c8e6c9', '未着手': '#ffcdd2',
    '待機中': '#e3f2fd', '保留': '#ede7f6', '予定': '#e0f7fa',
    '調整中': '#fff3e0',
  },
  PRIORITY: { '高': '#ef5350', '中': '#ffa726', '低': '#66bb6a' },
  DEPT: {
    '全体': '#e8eaf6',      '運営本部': '#e8eaf6',   '出店管理': '#e3f2fd',
    '電源': '#fff9c4',      '設営': '#fce4ec',       '音響': '#ede7f6',
    'ステージ': '#f3e5f5',  '舞台監督': '#f3e5f5',   'バー': '#e1f5fe',
    'エントランス': '#e8f5e9', '場外P': '#dcedc8',    'ボランティア': '#f3e5f5',
    'キッズ': '#e0f7fa',    '清掃': '#dcedc8',       '食堂': '#fff8e1',
    '物販': '#fce4ec',      '広報': '#fce4ec',       'カメラ': '#f5f5f5',
    'シャトルバス': '#e0f2f1',
  },
  EVENT: {
    'MTG': '#1976d2',       'ロケハン': '#388e3c',   '設営': '#f57f17',
    '設営・工事': '#e64a19', '本番DAY1': '#7b1fa2',  '本番DAY2': '#6a1b9a',
    '本番DAY3': '#4a148c',  '撤収': '#455a64',       '作業期限': '#c62828',
  },
};

// ══════════════════════════════════════
// LINEトーク分析から抽出した初期タスクデータ
// 列順: [担当者, 部署, タスク内容, 状態, 優先度, 期日, 関連LINE, メモ]
// ══════════════════════════════════════
const INITIAL_TASKS = [
  // ── 電源・音響 ──
  ['たなのりくん', '電源', 'ステージ側 分電盤レンタル確認・見積もり作成', '対応中', '高', '', 'ステージ音響&電源', '妹尾からの返答待ち。レンタルか弊社用意か確定後に準備'],
  ['妹尾 真行', '電源', '分電盤レンタル費用確認→たなのりくんへ返答', '対応中', '高', '2026/06/07', 'ステージ音響&電源', '土日中に確認予定'],
  ['yusuke ono', '音響', 'スピーカー台スタッキングフレーム寸法確認→hajimeへ連携', '対応中', '高', '', 'ステージグループ', 'hajimeと仕様決定して製作依頼'],
  ['Kunihiko Harada', '電源', '電源全体レンタル発注まとめ・Very班と連携', '対応中', '高', '', 'moment2026', '現情勢で部材入手困難→早急に'],
  ['Shu YAMAWAKI', '電源/演出', 'レーザー・照明 電源回路最終確認', '完了', '高', '2026/06/03', 'ステージ音響&電源', 'たなのりくんと確認済み。C平行・FOH7回路で合意'],
  ['Haruki Moriguchi', '音響', 'VJ電源（ステージ15A×2）確認', '完了', '高', '', 'ステージ音響&電源', '図面に追記済み'],
  // ── ステージ・設営 ──
  ['oleoreo', 'ステージ', 'スピーカー台（単管台形）製作', '予定', '高', '2026/06/30', 'ステージグループ', '高さ1700mm+ジャッキ。火曜7/1前に完成'],
  ['hajime', '設営', 'スピーカー用コンパネ・単管・かん太・自在ジャッキ×8調達', '対応中', '高', '', '設営G', 'タンカンとジョイントのかん太でスピーカー台建設'],
  ['hajime', '設営', '設営見積もり作成・提出', '対応中', '高', '', '設営G', 'HI-Cから依頼。できれば6/5中に'],
  ['hajime', '設営', 'テック・タクちゃんのLINE確認・繋げる', '対応中', '中', '', '設営G', '繋がっていないので確認中'],
  ['hajime', '設営', 'ゼンショーへのトラック積み込み・搬送段取り（2台）', '対応中', '高', '2026/07/01', '設営G', 'XLをジャイガ用に大阪保管。往路はhajime手配'],
  ['yusuke ono', '音響', '7/1 会場入り・機材搬入（軽トラはレオ手配済み）', '予定', '高', '2026/07/01', 'ステージグループ', '2tロングワイドは道幅NG→積み替え必要'],
  ['岩城真人', 'ステージ', 'ストレッチテント・スピーカー台寸法確認・図面反映', '対応中', '高', '', 'ステージグループ', 'テント奥行7500mm、センターポール3750mm位置'],
  // ── 運営本部 ──
  ['石田翔馬', '運営本部', 'インカム発注（レンタル先確認→発注）', '対応中', '高', '', 'MOMENT本部', '発注先が分かり次第発注。CCに石田メール'],
  ['石田翔馬', '運営本部', 'コテージ割り管理表作成', '完了', '中', '2026/06/04', 'MOMENT本部', '管理表に追加済み'],
  ['石田翔馬', '運営本部', '本部シフト確定・ボランティア2名アサイン', '対応中', '高', '', 'MOMENT本部', 'ゆうさんのシフトと合わせて組む'],
  ['masato morokuma', '運営本部', 'ロケハン参加（12時現地集合）', '予定', '高', '2026/06/09', '運営本部', '武藤の車で。電波なし注意。HI-Cはそのまま現地泊'],
  ['武藤剛亘', '運営本部', 'ロケハン参加（調整中）', '調整中', '高', '2026/06/09', '運営本部', '「多分行けると思うが調整中」'],
  ['石田翔馬', '運営本部', '場内エントランス・荷物検査のオペレーション確認（ロケハン時）', '予定', '高', '2026/06/09', '運営本部', 'リストバンドチェック場所・救護場所・管理棟前駐車台数も確認'],
  // ── エントランス ──
  ['＆you⭐︎', 'エントランス', 'エントランス管理表完成（組織図・シフト）', '対応中', '高', '', 'Momentエントランス', '仮シフト作成済み。場内12名・場外別途'],
  ['kazuha tanaka', 'エントランス', '荷物検査リーダー（秋水チーム）確認・人員確保', '対応中', '高', '', '荷物検査グループ', '石田と連携。ボランティア6名配置予定'],
  ['Shusui Tanaka', '荷物検査', '荷物検査チーム体制確認・HI-Cと打ち合わせ', '対応中', '高', '', '荷物検査', 'HI-Cが沖縄から帰国後MTG'],
  // ── 場外駐車場 ──
  ['Hide', '場外P', '場外駐車場シフト完成', '対応中', '高', '', '場外P', 'ゆうさんがざっくり作ってくれた。詳細詰め必要'],
  // ── ボランティア ──
  ['KEITA', 'ボランティア', '未確認ボランティア22名への電話確認', '対応中', '高', '', 'ボランティア募集', '月曜電話→火水でアサイン完了予定'],
  ['南城 祐介', 'ボランティア', 'ボランティア最終采配・ノートまとめ完了', '対応中', '高', '', 'ボランティア募集', 'KEITAと連携して仕上げ'],
  ['HI-C', 'ボランティア', '保留ボランティア追加アサイン決定（沖縄帰国後）', '保留', '中', '2026/06/09', 'ボランティア募集', '残り8人程度。沖縄から戻るまで保留'],
  // ── 舞台監督 ──
  ['Joshua SW', '舞台監督', '舞台監督MTG（オンライン）', '待機中', '高', '2026/06/08週', '舞台監督G', '息子が手足口病→月曜帰国後MTGでリスケ'],
  ['ルウジ', '舞台監督', '舞台監督MTG参加', '待機中', '中', '2026/06/08週', '舞台監督G', 'Joshuaと同時に'],
  // ── 広報 ──
  ['MARIA', '広報', 'リストバンドデザイン入稿', '対応中', '高', '', '広報', '来週（6/8週）にやる予定'],
  ['MARIA', '広報', 'KIDSとYoga投稿用写真選定', '対応中', '中', '', '広報', 'マヤちゃんの写真から選ぶ'],
  ['Momoko', '広報', 'KIDS画像作成（サウナと同フォーマット）', '対応中', '中', '', '広報', 'Yoga画像は完了済み'],
  ['MARIA', '広報', '映像撮影チーム打ち合わせ（ドローン・アフタームービー）', '対応中', '中', '', '広報', 'Ymasaへのオファーも来年視野で検討'],
  ['YMT', '広報', 'Twitterへのヨガ投稿', '完了', '低', '2026/06/04', '広報', 'マリアから依頼。完了'],
  // ── バー ──
  ['🌞Hiroto Arai', 'バー', 'バーシフト・テルキ・そうちゃん・はたくんへ共有', '対応中', '高', '', 'Moment2026 bar', 'シフト共有済み。最終確認'],
  ['田岡太一', 'バー', 'テルキくん最終日シフト変更（13-19枠）', '完了', '中', '2026/06/05', 'Moment2026 bar', 'OKもらった'],
  ['🌞Hiroto Arai', 'バー', 'バーメニューデータ・グランドメニュー作成', '対応中', '高', '', 'Moment2026 bar', 'アイデイがデザイン。moment側でテキスト版作成'],
  ['🌞Hiroto Arai', 'バー', 'コップ数量確定・発注', '対応中', '高', '', 'Moment2026 bar', '在庫確認後発注。カードリーダー行方も確認'],
  // ── 物販 ──
  ['ʚ愛ɞ', '物販', 'レインコート発注（Lサイズ6枚）', '完了', '中', '2026/06/03', '物販', 'のりこさんに発注完了'],
  ['ʚ愛ɞ', '物販', 'カードリーダー行方確認', '対応中', '中', '', '物販', 'ヒロトに渡したとMARIA言及。確認中'],
  ['ʚ愛ɞ', '物販', 'ライター200個・携帯灰皿200個 受取確認', '完了', '中', '2026/05/20', '物販', '発注・入稿・支払い完了（HI-C）'],
  // ── キッズ ──
  ['akinoko', 'キッズ', 'キッズボランティアシフト確定（5名）', '対応中', '中', '', 'mmt2026Kidz', '西島はるな・野口房子・橋本瞳衣・ベッツイー・かしむら郁美'],
  ['akinoko', 'キッズ', 'SNSキッズエリア告知文確認・日付修正済み', '完了', '中', '2026/05/24', 'mmt2026Kidz', '7/3・4・5に修正OK'],
  // ── 清掃 ──
  ['中道大雅', '清掃', '清掃ボランティアシフト作成・必要人数確定', '対応中', '高', '', '清掃ボランティア', '6/3MTGで大枠決定。詳細詰め中'],
  // ── 食堂 ──
  ['正弥', '食堂', 'ガス10kg×3本・五徳3連・炊飯器・保温ジャー・長机×2 発注', '完了', '中', '2026/06/03', '食堂G', '全て対応済み'],
  ['ナカムラ ダイスケ', '食堂', '賄いシフト確定', '完了', '中', '2026/06/03', '食堂G', '金はっしゃん/土だいすけ/日昼はっしゃん日夜だいすけ/月朝マサヤ'],
  // ── シャトルバス ──
  ['Yuto Saruwatari', 'シャトルバス', 'シャトルバスドライバー6名確定・シフト作成', '対応中', '高', '', 'シャトルバスCore', '小寺20h+斎藤16h+ボランティア9名(108h)=144h確保'],
  // ── 出店管理 ──
  ['YMT', '出店管理', '出店ボランティア2名確定（サクヤマ ケイト・ナカムラ リク）', '完了', '中', '', '出店グループ', 'ボランティア采配MTGで確定'],
  ['YMT', '出店管理', '出店管理マスターシート最終更新', '完了', '高', '2026/05/28', '出店グループ', 'マスターシートの出店管理タブに全店舗まとめ完了'],
  // ── 全体 ──
  ['HI-C', '全体', '沖縄ツアー後帰阪・洞川ロケハン段取り', '予定', '高', '2026/06/09', '全体', '6/4〜沖縄→6/9帰阪後洞川'],
  ['HI-C', '全体', '帯状疱疹回復・各MTG対応再開', '対応中', '高', '', '全体', '病院通院中。月曜帰阪後本格始動'],
  ['妹尾 真行', '全体', 'MOMENT2026 組織図・マスター資料更新', '対応中', '中', '', '全体', 'Discordにまとめ。ジュニア連携'],
];

// ══════════════════════════════════════
// スケジュールデータ
// 列順: [日付, 種別, 内容, 参加者, 場所, メモ]
// ══════════════════════════════════════
const SCHEDULE_DATA = [
  ['2026/06/08', 'MTG', '舞台監督MTG（オンライン）', 'HI-C、Joshua SW、ルウジ', 'オンライン', 'Joshua息子が手足口病 → 月曜22:30以降でリスケ'],
  ['2026/06/09', 'ロケハン', '洞川ロケハン（12時現地集合）', 'HI-C、masato morokuma、武藤剛亘', '洞川キャンプ場', '武藤の車。電波なし注意。HI-Cはそのまま現地泊'],
  ['2026/06/09', '期限', 'ボランティア保留分アサイン決定', 'HI-C、KEITA、南城', '', 'HI-C帰国後に決定'],
  ['2026/06/15以降', 'MTG', '電源・配電計画MTG', '妹尾/YMT/たなのりくん/Kunihiko', 'オンライン or 現地', '分電盤・ケーブル本数・ルート確定。発注へ'],
  ['2026/06/27', 'MTG', '設営MTG（22時〜）', 'HI-C、妹尾、hajime', 'オンライン', '発注品最終決定。約1ヶ月前'],
  ['2026/06/30', '設営', '設営1日目（11人）', '設営チーム', '洞川キャンプ場', 'ストレッチテントボランティア2名。7:00集合'],
  ['2026/07/01', '設営', '設営2日目（13人）/ 音響チーム入り', '設営チーム + yusuke ono', '洞川キャンプ場', 'yusuke: 2tロング→積み替え。レオが軽トラで同行'],
  ['2026/07/02', '工事', '設営3日目（15人）/ 電気工事 / 街灯設置', '設営+Very(たなのりくん)+後藤電機', '洞川キャンプ場', '電気工事：Very担当。街灯のみ：後藤電機'],
  ['2026/07/03', '本番', 'MOMENT 2026 DAY1', '全員', '洞川キャンプ場', '9:00 Gate Open / 14:00〜 音楽 / 翌4:00 終了。キッズ12:00-18:30'],
  ['2026/07/04', '本番', 'MOMENT 2026 DAY2', '全員', '洞川キャンプ場', '9:00 Gate Open / 11:00〜 音楽 / 翌7:00 終了。キッズ10:00-18:30'],
  ['2026/07/05', '本番', 'MOMENT 2026 DAY3 + After Party', '全員', '洞川キャンプ場', '9:00 Gate Open / 10:00〜 音楽 / After18:00-1:00。キッズ10:00-17:00'],
  ['2026/07/06', '撤収', '撤収1日目（25人以上）', '撤収チーム', '洞川キャンプ場', 'ストレッチテントボランティア4名'],
  ['2026/07/07', '撤収', '撤収2日目', '撤収チーム', '洞川キャンプ場', ''],
];

// ══════════════════════════════════════
// メイン関数 - ここを実行してください
// ══════════════════════════════════════
function createManagementSystem() {
  const ss = SpreadsheetApp.create('MOMENT 2026 タスク・スケジュール管理システム');

  // シート作成
  const dashboard = setupDashboard(ss);
  const taskSheet  = setupTaskSheet(ss);
  const calSheet   = setupCalendar(ss, 6);  // 6月
  const calSheet2  = setupCalendar(ss, 7);  // 7月
  const deptSheet  = setupDeptView(ss);
  const lineSheet  = setupLineImport(ss);

  // デフォルトの「シート1」を削除
  const def = ss.getSheetByName('シート1');
  if (def) ss.deleteSheet(def);

  // ダッシュボードを先頭に
  ss.setActiveSheet(dashboard);
  ss.moveActiveSheet(1);

  const url = ss.getUrl();
  // ★ 実行ログ（表示 > 実行ログ）にURLが出ます → コピーしてブックマーク
  console.log('✅ 作成完了！このURLをブックマーク: ' + url);
  Logger.log('作成完了: ' + url);
  return ss;
}

// ══════════════════════════════════════
// ① ダッシュボード
// ══════════════════════════════════════
function setupDashboard(ss) {
  const sh = ss.insertSheet('🏠 ダッシュボード');
  sh.setTabColor('#0a1628');

  // ヘッダー
  sh.setRowHeight(1, 60);
  sh.getRange('A1:I1').merge()
    .setValue('MOMENT 2026 タスク・スケジュール管理システム')
    .setBackground(C.NAVY).setFontColor(C.WHITE)
    .setFontSize(20).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  // サブヘッダー
  sh.getRange('A2:I2').merge()
    .setValue('📅 MOMENT 2026 / 7月3日〜5日 / 洞川キャンプ場（天川村・奈良）　　最終更新: ' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'))
    .setBackground('#1a3060').setFontColor('#a8c4ff')
    .setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 28);

  // ── 部署ステータスカード ──
  sh.getRange('A4').setValue('📊 部署別 タスク進捗').setFontSize(13).setFontWeight('bold').setFontColor(C.NAVY);
  sh.setRowHeight(3, 12);

  const cardHeaders = ['部署', '担当者(代表)', '総タスク', '✅完了', '🔄対応中', '⏳待機/保留', '🗓予定', '進捗率', '次のアクション'];
  sh.getRange(5, 1, 1, cardHeaders.length).setValues([cardHeaders])
    .setBackground(C.NAVY).setFontColor(C.WHITE)
    .setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(5, 30);

  const depts = buildDeptSummary();
  depts.forEach((row, i) => {
    const r = 6 + i;
    sh.setRowHeight(r, 24);
    const range = sh.getRange(r, 1, 1, row.length);
    range.setValues([row]);
    // 部署列の色
    const deptColor = C.DEPT[row[0]] || '#f5f5f5';
    sh.getRange(r, 1).setBackground(deptColor).setFontWeight('bold');
    // 進捗率のカラー
    const pct = parseFloat(row[7]) || 0;
    const pctColor = pct >= 75 ? '#c8e6c9' : pct >= 40 ? '#fff9c4' : '#ffcdd2';
    sh.getRange(r, 8).setBackground(pctColor).setHorizontalAlignment('center');
    // 交互色
    if (i % 2 === 1) {
      for (let c = 2; c <= 9; c++) {
        const cell = sh.getRange(r, c);
        if (!cell.getBackground() || cell.getBackground() === '#ffffff') cell.setBackground('#fafafa');
      }
    }
  });

  // 列幅
  sh.setColumnWidth(1, 140);
  sh.setColumnWidth(2, 160);
  [3,4,5,6,7].forEach(c => sh.setColumnWidth(c, 72));
  sh.setColumnWidth(8, 80);
  sh.setColumnWidth(9, 320);

  // ── 直近スケジュール ──
  const schedStartRow = 7 + depts.length;
  sh.setRowHeight(schedStartRow, 14);
  sh.getRange(schedStartRow + 1, 1).setValue('📅 直近スケジュール').setFontSize(13).setFontWeight('bold').setFontColor(C.NAVY);

  const schedHeaders = ['日付', '種別', '内容', '参加者', '場所', 'メモ'];
  sh.getRange(schedStartRow + 2, 1, 1, 6).setValues([schedHeaders])
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(schedStartRow + 2, 30);

  const today = new Date();
  const upcoming = SCHEDULE_DATA.filter(r => {
    try { return new Date(r[0]) >= today || r[0].includes('以降'); } catch(e) { return true; }
  }).slice(0, 8);

  upcoming.forEach((row, i) => {
    const r = schedStartRow + 3 + i;
    sh.setRowHeight(r, 26);
    sh.getRange(r, 1, 1, 6).setValues([row]);
    const typeColor = C.EVENT[row[1]] || '#607d8b';
    sh.getRange(r, 2).setBackground(typeColor).setFontColor(C.WHITE).setFontWeight('bold').setHorizontalAlignment('center');
    if (i % 2 === 1) sh.getRange(r, 1, 1, 6).setBackground('#fafafa');
  });

  // 枠線
  const lastRow = schedStartRow + 3 + upcoming.length - 1;
  sh.getRange(5, 1, 1 + depts.length, 9).setBorder(true, true, true, true, true, true);
  sh.getRange(schedStartRow + 2, 1, 1 + upcoming.length, 6).setBorder(true, true, true, true, true, true);

  // シートの行・列の固定
  sh.setFrozenRows(5);

  return sh;
}

// 部署サマリーデータ構築
function buildDeptSummary() {
  const deptMap = {};
  const deptNext = {
    '全体': 'HI-C帰国後(6/9〜)に各部署MTG再開',
    '運営本部': 'ロケハン6/9 → インカム発注 → 本部シフト確定',
    '出店管理': 'マスターシート更新済み。ボランティア2名確定済み',
    '電源': '分電盤レンタル返答待ち → 発注へ（急ぎ）',
    '設営': '見積もり提出 → 6/27MTGで最終発注確定',
    '音響': 'スピーカー台仕様確定 → oleoreo製作→7/1入り',
    'ステージ': 'スピーカー台製作（単管）→ 7/1入りで最終位置決め',
    '舞台監督': 'MTGリスケ。Joshua回復後→月曜オンライン',
    'バー': 'メニュー作成→コップ発注→バーテン連絡',
    'エントランス': '管理表完成→荷物検査チームと擦り合わせ',
    '場外P': 'Hideがシフト作成中。ゆうさんの叩き台あり',
    'ボランティア': '未確認22名電話→火水でアサイン完了予定',
    'キッズ': 'ボランティアシフト確定（5名確認済み）',
    '清掃': 'タイガがシフト詳細作成中',
    '食堂': '全発注完了。賄いシフト確定済み',
    '物販': 'カードリーダー行方確認 → 在庫確認',
    '広報': 'リストバンド入稿（来週）KIDS画像作成中',
    'カメラ': '撮影チーム確定済み。当日のみ対応',
    'シャトルバス': 'ドライバー6名確定。シフト調整中',
  };

  const deptReps = {
    '全体': 'HI-C / 妹尾 真行', '運営本部': '石田翔馬 / 諸隈 / 武藤',
    '出店管理': 'YMT（ヤマト）', '電源': 'Kunihiko / たなのりくん',
    '設営': 'hajime（忍）', '音響': 'yusuke ono',
    'ステージ': 'oleoreo / 岩城', '舞台監督': 'Joshua SW / ルウジ',
    'バー': '🌞Hiroto Arai / 田岡太一', 'エントランス': '＆you⭐︎ / kazuha',
    '場外P': 'Hide', 'ボランティア': '南城 / KEITA',
    'キッズ': 'akinoko', '清掃': '中道大雅',
    '食堂': '正弥 / ナカムラ ダイスケ', '物販': 'ʚ愛ɞ / MARIA',
    '広報': 'MARIA / Momoko / YMT', 'カメラ': 'takashi / Maya / Kenta',
    'シャトルバス': 'Yuto Saruwatari',
  };

  INITIAL_TASKS.forEach(t => {
    const dept = t[1];
    if (!deptMap[dept]) deptMap[dept] = { total: 0, done: 0, inProgress: 0, waiting: 0, scheduled: 0 };
    deptMap[dept].total++;
    const status = t[3];
    if (status === '完了') deptMap[dept].done++;
    else if (status === '対応中' || status === '調整中') deptMap[dept].inProgress++;
    else if (status === '待機中' || status === '保留') deptMap[dept].waiting++;
    else if (status === '予定') deptMap[dept].scheduled++;
  });

  return Object.entries(deptMap).map(([dept, d]) => {
    const pct = d.total > 0 ? Math.round(d.done / d.total * 100) : 0;
    return [
      dept,
      deptReps[dept] || '',
      d.total, d.done, d.inProgress, d.waiting, d.scheduled,
      pct + '%',
      deptNext[dept] || '',
    ];
  });
}

// ══════════════════════════════════════
// ② タスク管理シート
// ══════════════════════════════════════
function setupTaskSheet(ss) {
  const sh = ss.insertSheet('📋 全タスク');
  sh.setTabColor('#1976d2');

  const headers = ['#', '担当者', '部署', 'タスク内容', '状態', '優先度', '期日', '関連LINEグループ', 'メモ', '登録日'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 36);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);

  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  const rows = INITIAL_TASKS.map((t, i) => [
    i + 1, t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7], today
  ]);
  sh.getRange(2, 1, rows.length, 10).setValues(rows);

  // 書式
  rows.forEach((row, i) => {
    const r = i + 2;
    sh.setRowHeight(r, 24);
    // 状態色
    const statusColor = C.STATUS[row[4]] || '#ffffff';
    sh.getRange(r, 5).setBackground(statusColor).setHorizontalAlignment('center');
    // 優先度色
    const priBg = C.PRIORITY[row[5]] || '#ffffff';
    sh.getRange(r, 6).setBackground(priBg).setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    // 部署色
    const deptColor = C.DEPT[row[2]] || '#f5f5f5';
    sh.getRange(r, 3).setBackground(deptColor).setHorizontalAlignment('center');
    // 交互行色（タスク内容列）
    if (i % 2 === 1) sh.getRange(r, 4).setBackground('#fafafa');
  });

  // 列幅
  sh.setColumnWidth(1, 40);
  sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 120);
  sh.setColumnWidth(4, 340);
  sh.setColumnWidth(5, 90);
  sh.setColumnWidth(6, 72);
  sh.setColumnWidth(7, 100);
  sh.setColumnWidth(8, 180);
  sh.setColumnWidth(9, 280);
  sh.setColumnWidth(10, 90);

  sh.getRange(2, 1, rows.length, 10).setBorder(true, true, true, true, true, true);

  // フィルター
  sh.getRange(1, 1, rows.length + 1, 10).createFilter();

  return sh;
}

// ══════════════════════════════════════
// ③ カレンダーシート
// ══════════════════════════════════════
function setupCalendar(ss, month) {
  const shName = '📅 ' + month + '月カレンダー';
  const sh = ss.insertSheet(shName);
  sh.setTabColor(month === 6 ? '#1976d2' : '#7b1fa2');

  const year = 2026;
  const monthName = month + '月 ' + year;

  // タイトル
  sh.getRange('A1:G1').merge()
    .setValue('MOMENT 2026 ─ ' + monthName)
    .setBackground(C.NAVY).setFontColor(C.WHITE)
    .setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 48);

  // 曜日
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  sh.getRange(2, 1, 1, 7).setValues([days])
    .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
  days.forEach((d, i) => {
    let bg = '#f5f5f5';
    if (i === 0) bg = '#ffebee';
    if (i === 6) bg = '#e3f2fd';
    sh.getRange(2, i + 1).setBackground(bg);
  });
  sh.setRowHeight(2, 28);

  // カレンダーグリッド
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  let row = 3;
  let col = firstDay + 1;
  const cellHeight = 95;

  for (let day = 1; day <= daysInMonth; day++) {
    sh.setRowHeight(row, cellHeight);
    sh.setColumnWidth(col, 120);

    const cell = sh.getRange(row, col);
    const dow = (firstDay + day - 1) % 7;
    let bg = '#ffffff';
    if (dow === 0) bg = '#fff8f8';
    if (dow === 6) bg = '#f0f4ff';
    cell.setBackground(bg).setVerticalAlignment('top');
    cell.setWrap(true);

    // 日付
    let label = day.toString();
    const dateStr = year + '/' + String(month).padStart(2, '0') + '/' + String(day).padStart(2, '0');
    const events = SCHEDULE_DATA.filter(e => e[0] === dateStr || e[0].startsWith(dateStr));
    events.forEach(e => { label += '\n[' + e[1] + '] ' + e[2]; });
    cell.setValue(label).setFontSize(events.length > 0 ? 9 : 11);
    if (dow === 0) cell.setFontColor('#c62828');
    if (dow === 6) cell.setFontColor('#1565c0');

    // イベント背景
    if (events.length > 0) {
      const evColor = C.EVENT[events[0][1]] || '#607d8b';
      cell.setBackground(evColor + '33'); // 薄い色（透過）
      cell.setFontWeight('bold');
    }

    col++;
    if (col > 7) { col = 1; row++; }
  }

  // 最終行の高さ設定
  for (let r = 3; r <= row; r++) sh.setRowHeight(r, cellHeight);
  [1,2,3,4,5,6,7].forEach(c => sh.setColumnWidth(c, 120));

  sh.getRange(2, 1, row - 2, 7).setBorder(true, true, true, true, true, true);

  return sh;
}

// ══════════════════════════════════════
// ④ 部署別ビュー
// ══════════════════════════════════════
function setupDeptView(ss) {
  const sh = ss.insertSheet('🏢 部署別タスク');
  sh.setTabColor('#388e3c');

  const headers = ['部署', '担当者', 'タスク内容', '状態', '優先度', '期日', 'メモ'];
  sh.getRange(1, 1, 1, 7).setValues([headers])
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 32);
  sh.setFrozenRows(1);

  // 部署別にグループ化
  const byDept = {};
  INITIAL_TASKS.forEach(t => {
    if (!byDept[t[1]]) byDept[t[1]] = [];
    byDept[t[1]].push(t);
  });

  let currentRow = 2;
  Object.entries(byDept).forEach(([dept, tasks]) => {
    // 部署ヘッダー行
    const deptColor = C.DEPT[dept] || '#e0e0e0';
    sh.setRowHeight(currentRow, 28);
    sh.getRange(currentRow, 1, 1, 7).merge()
      .setValue('【 ' + dept + ' 】 ─ ' + tasks.length + '件')
      .setBackground(deptColor).setFontWeight('bold').setFontSize(12)
      .setVerticalAlignment('middle');
    currentRow++;

    tasks.forEach(t => {
      sh.setRowHeight(currentRow, 24);
      sh.getRange(currentRow, 1, 1, 7).setValues([[t[1], t[0], t[2], t[3], t[4], t[5], t[7]]]);
      sh.getRange(currentRow, 1).setBackground(deptColor).setHorizontalAlignment('center');
      sh.getRange(currentRow, 4).setBackground(C.STATUS[t[3]] || '#fff').setHorizontalAlignment('center');
      sh.getRange(currentRow, 5).setBackground(C.PRIORITY[t[4]] || '#fff').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
      currentRow++;
    });

    sh.setRowHeight(currentRow, 8);
    currentRow++;
  });

  [1,2,3,4,5,6,7].forEach((c, i) => sh.setColumnWidth(c, [120,160,300,90,70,90,280][i]));
  sh.getRange(2, 1, currentRow - 2, 7).setBorder(true, true, true, true, true, true);
  sh.getRange(1, 1, currentRow - 1, 7).createFilter();

  return sh;
}

// ══════════════════════════════════════
// ⑤ LINE取込シート
// ══════════════════════════════════════
function setupLineImport(ss) {
  const sh = ss.insertSheet('📱 LINE取込');
  sh.setTabColor('#06C755');

  // ヘッダー
  sh.getRange('A1:E1').merge()
    .setValue('📱 LINEトーク取込 → タスク・スケジュール抽出')
    .setBackground('#06C755').setFontColor(C.WHITE)
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 44);

  // 説明
  sh.getRange('A2:E2').merge()
    .setValue('① 下の「LINEトーク貼り付けエリア」にLINEのトーク履歴をCtrl+Vで貼り付け  ② 上のメニュー「MOMENT管理」→「LINE解析実行」を押す')
    .setBackground('#e8f5e9').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 32);

  // ステップガイド
  const steps = [
    ['📋', 'STEP 1', 'LINEアプリ → グループ → ☰ → トーク履歴をバックアップ → テキストファイルをPCで開く'],
    ['📋', 'STEP 2', '全文コピー（Ctrl+A → Ctrl+C）してA5以下に貼り付け'],
    ['⚙️', 'STEP 3', 'メニュー「MOMENT管理」→「LINE解析実行」をクリック'],
    ['✅', 'STEP 4', '「📋 全タスク」と「📅 6月/7月カレンダー」に自動追記されます'],
  ];
  sh.getRange(3, 1, 1, 3).setValues([['アイコン', 'ステップ', '内容']]).setFontWeight('bold').setBackground('#c8e6c9');
  steps.forEach((s, i) => sh.getRange(4 + i, 1, 1, 3).setValues([s]));
  sh.setRowHeight(8, 16);

  // 貼り付けエリア
  sh.getRange('A9:E9').merge().setValue('▼ ここにLINEトークを貼り付け（古いものは削除してOK）')
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(9, 30);

  sh.getRange('A10:E50').merge()
    .setValue('← ここにLINEトーク履歴を貼り付けてください →')
    .setBackground('#f9f9f9').setFontColor('#aaaaaa').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true).setBorder(true, true, true, true, false, false);
  sh.setRowHeight(10, 400);

  // 解析結果エリア
  sh.getRange('A52:E52').merge().setValue('▼ 解析結果（抽出されたタスク・スケジュール）')
    .setBackground('#1976d2').setFontColor(C.WHITE).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(52, 30);

  const resultHeaders = ['種別', '担当者', '内容', '日付/期限', '確認'];
  sh.getRange(53, 1, 1, 5).setValues([resultHeaders])
    .setBackground('#e3f2fd').setFontWeight('bold').setFontSize(10);

  // 列幅
  [1,2,3,4,5].forEach((c, i) => sh.setColumnWidth(c, [60,140,360,120,80][i]));

  return sh;
}

// ══════════════════════════════════════
// LINE解析エンジン
// ══════════════════════════════════════
function parseLINEText() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lineSheet = ss.getSheetByName('📱 LINE取込');
  if (!lineSheet) { SpreadsheetApp.getUi().alert('「LINE取込」シートが見つかりません。'); return; }

  const rawText = lineSheet.getRange('A10').getValue().toString();
  if (!rawText || rawText.includes('ここにLINEトーク')) {
    SpreadsheetApp.getUi().alert('LINEトークを貼り付けてください。');
    return;
  }

  const lines = rawText.split('\n');
  const extracted = [];
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');

  // タスクキーワード
  const taskKeywords = [
    'しておいて', 'お願いします', 'お願いしまっす', 'お願い致します',
    'よろしく', 'やっておいて', 'やって欲しい', 'してほしい', 'して欲しい',
    '確認お願い', '発注', '作成', '提出', '連絡',
  ];
  // 日付パターン
  const datePatterns = [
    /(\d{1,2})[\/月](\d{1,2})/g,
    /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/g,
  ];
  // 名前パターン（@メンション）
  const mentionPattern = /@([^\s　]+)/g;

  let currentSender = '';
  let currentDate = '';

  lines.forEach((line, i) => {
    // 日付行 (例: 2026.04.11 土曜日)
    const dateMatch = line.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    if (dateMatch) { currentDate = dateMatch[1] + '/' + dateMatch[2] + '/' + dateMatch[3]; return; }

    // 送信者行 (例: 15:30 HI-C メッセージ)
    const msgMatch = line.match(/^(\d{2}:\d{2}) (.+?) (.+)/);
    if (msgMatch) { currentSender = msgMatch[2]; }

    // タスク検出
    const hasTask = taskKeywords.some(kw => line.includes(kw));
    if (hasTask && line.length > 10) {
      let assignee = '';
      const mention = mentionPattern.exec(line);
      if (mention) assignee = mention[1];
      else assignee = currentSender;

      // 日付抽出
      let dueDate = '';
      datePatterns.forEach(pat => {
        pat.lastIndex = 0;
        const m = pat.exec(line);
        if (m) dueDate = m[0];
      });

      extracted.push(['タスク候補', assignee, line.trim().substring(0, 100), dueDate, '要確認']);
    }

    // ミーティング検出
    if (line.match(/MTG|ミーティング|打ち合わせ|オンライン/)) {
      let dueDate = currentDate;
      const m = line.match(/(\d{1,2})[\/月](\d{1,2})/);
      if (m) dueDate = '2026/' + m[1].padStart(2,'0') + '/' + m[2].padStart(2,'0');
      if (line.length > 10) {
        extracted.push(['MTG候補', currentSender, line.trim().substring(0, 100), dueDate, '要確認']);
      }
    }
  });

  if (extracted.length === 0) {
    SpreadsheetApp.getUi().alert('タスク・MTGが検出されませんでした。');
    return;
  }

  // 結果を書き込む
  const startRow = 54;
  lineSheet.getRange(startRow, 1, Math.max(extracted.length, 1), 5).clearContent();
  if (extracted.length > 0) {
    lineSheet.getRange(startRow, 1, extracted.length, 5).setValues(extracted);
    // 色付け
    extracted.forEach((r, i) => {
      const bg = r[0] === 'タスク候補' ? '#fff9c4' : '#e3f2fd';
      lineSheet.getRange(startRow + i, 1, 1, 5).setBackground(bg);
    });
  }

  SpreadsheetApp.getUi().alert(
    '✅ 解析完了！\n\n' +
    '検出数: ' + extracted.length + '件\n\n' +
    '「解析結果」エリアを確認して、必要なものは「📋 全タスク」シートに手動でコピーしてください。'
  );
}

// ══════════════════════════════════════
// タスク追加ヘルパー
// ══════════════════════════════════════
function addTask(担当者, 部署, タスク, 状態, 優先度, 期日, LINE名, メモ) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('📋 全タスク');
  if (!sh) return;
  const lastRow = sh.getLastRow();
  const newId = lastRow; // ヘッダー行除く
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  sh.appendRow([newId, 担当者, 部署, タスク, 状態, 優先度, 期日, LINE名, メモ, today]);
  const r = sh.getLastRow();
  sh.getRange(r, 5).setBackground(C.STATUS[状態] || '#fff').setHorizontalAlignment('center');
  sh.getRange(r, 6).setBackground(C.PRIORITY[優先度] || '#fff').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(r, 3).setBackground(C.DEPT[部署] || '#f5f5f5').setHorizontalAlignment('center');
}

// ══════════════════════════════════════
// カスタムメニュー（スプレッドシート表示時に作成）
// ══════════════════════════════════════
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎵 MOMENT管理')
    .addItem('📱 LINE解析実行', 'parseLINEText')
    .addSeparator()
    .addItem('🔄 ダッシュボード更新', 'refreshDashboard')
    .addItem('📊 状態サマリーを表示', 'showStatusSummary')
    .addToUi();
}

// ダッシュボード更新（状態変更後に呼ぶ）
function refreshDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashSheet = ss.getSheetByName('🏠 ダッシュボード');
  const taskSheet = ss.getSheetByName('📋 全タスク');
  if (!dashSheet || !taskSheet) return;

  // タスクシートから現在の状態を読む
  const data = taskSheet.getDataRange().getValues();
  const deptMap = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dept = row[2], status = row[4];
    if (!dept) continue;
    if (!deptMap[dept]) deptMap[dept] = { total:0, done:0, inProgress:0, waiting:0, scheduled:0 };
    deptMap[dept].total++;
    if (status === '完了') deptMap[dept].done++;
    else if (['対応中','調整中'].includes(status)) deptMap[dept].inProgress++;
    else if (['待機中','保留'].includes(status)) deptMap[dept].waiting++;
    else if (status === '予定') deptMap[dept].scheduled++;
  }

  // ダッシュボードの部署行を更新（行6から）
  let row = 6;
  Object.entries(deptMap).forEach(([dept, d]) => {
    const pct = d.total > 0 ? Math.round(d.done / d.total * 100) : 0;
    dashSheet.getRange(row, 3, 1, 5).setValues([[d.total, d.done, d.inProgress, d.waiting, d.scheduled]]);
    dashSheet.getRange(row, 8).setValue(pct + '%');
    const pctColor = pct >= 75 ? '#c8e6c9' : pct >= 40 ? '#fff9c4' : '#ffcdd2';
    dashSheet.getRange(row, 8).setBackground(pctColor);
    row++;
  });

  // 最終更新日時
  dashSheet.getRange('A2').setValue('📅 MOMENT 2026 / 7月3日〜5日 / 洞川キャンプ場（天川村・奈良）　　最終更新: ' +
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'));

  SpreadsheetApp.getUi().alert('✅ ダッシュボードを更新しました！');
}

// 状態サマリー表示
function showStatusSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('📋 全タスク');
  if (!sh) return;
  const data = sh.getDataRange().getValues();

  const counts = { '対応中':0, '完了':0, '未着手':0, '待機中':0, '保留':0, '予定':0, '調整中':0 };
  for (let i = 1; i < data.length; i++) {
    const s = data[i][4];
    if (counts[s] !== undefined) counts[s]++;
  }

  let msg = '📊 現在のタスク状況\n\n';
  msg += '✅ 完了: ' + counts['完了'] + '件\n';
  msg += '🔄 対応中: ' + counts['対応中'] + '件\n';
  msg += '🔵 調整中: ' + counts['調整中'] + '件\n';
  msg += '⏳ 待機中: ' + counts['待機中'] + '件\n';
  msg += '⏸ 保留: ' + counts['保留'] + '件\n';
  msg += '🗓 予定: ' + counts['予定'] + '件\n';
  msg += '🔴 未着手: ' + counts['未着手'] + '件\n';
  msg += '\n合計: ' + (data.length - 1) + '件';

  SpreadsheetApp.getUi().alert(msg);
}
