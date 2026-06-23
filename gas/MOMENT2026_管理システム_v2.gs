/**
 * MOMENT 2026 統合管理システム v2
 * ================================================
 * 【使い方】
 * 1. script.google.com で新しいプロジェクトを作成
 * 2. このコードを全選択して貼り付け（Ctrl+A → Ctrl+V）
 * 3. 関数選択欄で「createManagementSystem」を選んで ▶ 実行
 * 4. 実行ログ（表示 > 実行ログ）に出るURLをブックマーク
 *
 * 【シート構成】
 * 🏠 ダッシュボード  📋 全タスク  📅 6月/7月カレンダー
 * 🏢 部署別タスク   👥 スタッフ入り情報  🍚 賄い情報
 * 📱 LINE取込      🔗 関連シートリンク
 * ================================================
 */

// ══════════════════════════════════════════════════
// カラー定数
// ══════════════════════════════════════════════════
const C = {
  NAVY:  '#0a1628', WHITE: '#ffffff', LIGHT: '#f5f8ff',
  STATUS: {
    '対応中': '#fff9c4', '完了': '#c8e6c9', '未着手': '#ffcdd2',
    '待機中': '#e3f2fd', '保留':  '#ede7f6', '予定':  '#e0f7fa', '調整中': '#fff3e0',
  },
  PRIORITY: { '高': '#ef5350', '中': '#ffa726', '低': '#66bb6a' },
  DEPT: {
    '全体': '#e8eaf6',       '運営本部': '#e8eaf6',    '出店管理': '#e3f2fd',
    '電源': '#fff9c4',       '設営': '#fce4ec',        '音響': '#ede7f6',
    'ステージ': '#f3e5f5',   '舞台監督': '#f3e5f5',    'バー': '#e1f5fe',
    'エントランス': '#e8f5e9','場外P': '#dcedc8',       'ボランティア': '#f3e5f5',
    'キッズ': '#e0f7fa',     '清掃': '#dcedc8',        '食堂': '#fff8e1',
    '物販': '#fce4ec',       '広報': '#fce4ec',        'カメラ': '#f5f5f5',
    'シャトルバス': '#e0f2f1','警備': '#ffccbc',
  },
  EVENT: {
    'MTG': '#1976d2',        'ロケハン': '#388e3c',    '設営': '#f57f17',
    '設営・工事': '#e64a19', '本番DAY1': '#7b1fa2',   '本番DAY2': '#6a1b9a',
    '本番DAY3': '#4a148c',   '撤収': '#455a64',        '作業期限': '#c62828',
    '本番': '#7b1fa2',
  },
};

// ══════════════════════════════════════════════════
// 関連Google Sheetsリンク
// ══════════════════════════════════════════════════
const SHEETS_LINKS = [
  {
    name: '📊 MOMENT 2026 管理マスターシート',
    url:  'https://docs.google.com/spreadsheets/d/13uakCf1IbqxuSVRhrcDoiG6cC6xLU333oeXSeQiFemQ/edit',
    desc: '全体統括マスター。全部署の管理情報が集約',
    color: '#1a237e',
  },
  {
    name: '🏪 MOMENT 2026 出店管理マスター',
    url:  'https://docs.google.com/spreadsheets/d/1ULD9TcMRJDMF1k-I4CBJEX3M_DT2TRLohTQ-xugZTCA/edit',
    desc: '出店ブース管理・出店者情報・レイアウト',
    color: '#1b5e20',
  },
  {
    name: '🎤 MOMENT 2026 アーティスト管理【国内回答】',
    url:  'https://docs.google.com/spreadsheets/d/1h7HV6ZfnDElblK4nJ_dbtKgAOaNnB1olv2A7946GjYo/edit',
    desc: 'アーティスト情報・タイムテーブル・対応状況',
    color: '#4a148c',
  },
  {
    name: '📋 MOMENT 2026 タスク・スケジュール管理システム',
    url:  'https://docs.google.com/spreadsheets/d/1kPCg1fbYfRxrWs7VwALrLAOo4oqONGgLAn3grhYvUfQ/edit',
    desc: 'タスク・スケジュール管理（旧バージョン）',
    color: '#01579b',
  },
  {
    name: '🙋 ボランティアスタッフ募集（回答）',
    url:  'https://docs.google.com/spreadsheets/d/1tVEmUOELKBQTkDGew6jRmWaqqlCLwz61wIvRCKFuF_Q/edit',
    desc: 'ボランティア応募フォーム回答一覧（約120名）',
    color: '#880e4f',
  },
];

// ══════════════════════════════════════════════════
// スタッフ入り情報データ（翔馬君リクエストへの回答）
// 列順: [チーム名, 代表者/担当, 連絡先, スタッフ人数, 車両台数, 車両詳細, 入り日時, 備考, ステータス]
// ══════════════════════════════════════════════════
const STAFF_ARRIVAL = [
  // --- 確定済み ---
  ['音響(SOL)', '小野裕介（yusuke）', '-', '-', '4台', '2tロングワイド×1、軽トラ×1、乗用車1-2台', '7/1(水) 午前', '※2tロングは道幅NG→積み替え必要。レオが軽トラ同行', '確定'],
  ['ストレッチテントC', '岩城真人', '09065394643', '3名', '2台', '普通車×2（予定）', '6/30(火) AM10:00', '関東から。ロケハン不参加→図面で確認済み', '確定'],
  ['オレオ(ステージ)', 'oleoreo', '09099894168', '10名前後', '6台', '3t車×1＋乗用車5台程度', '6/30(火) 午前中', '日によって変動あり。スピーカー台製作も担当', '確定'],
  ['CRACKWORKS(VJ)', 'モリグチハルキ', '08070215444', '2名', '1台', '乗用車×1', '7/2(木) 16:00頃', 'VJ担当。電源15A×2（ステージ）確認済み', '確定'],
  ['舞台監督 ジョシュア', 'Joshua SW', '09060609437', '未定', '未定', '-', '7/3(金) AM11時 〜 7/6(月) PM13時', '舞台監督。滞在型', '確定'],
  ['Samaya Design', '田中エティエンヌ', '090-4454-8262', '8名', '3-4台', '詳細未回答', '6/29(月)夜 or 6/30(火)朝', '翔馬経由で確認', '調整中'],
  ['ZIGN', '中村則夫', '08054295747', '6名', '3台', '詳細未回答', '6/29(月)夜', '翔馬経由で確認', '確定'],
  ['ウタリ', '大池拓磨', '09094310746', '4名', '2台', 'ハイエース×1＋4t or 3tトラック×1', '7/1(水)PM or 7/2(木)早朝', '要最終確認', '調整中'],
  ['フラワーチーム', '大倉ユウ', '08053585432', '6-8名', '3-4台', '詳細未回答', '7/1(水) 11:00', 'フラワー装飾担当', '確定'],
  ['Haruka Kanata', '松村貴子', '090-6827-4577', '6名', '3台', '詳細未回答', '7/1(水)', '要最終確認', '調整中'],
  ['センスオブワンダー', '山脇シュウヘイ', '08038380480', '4名', '2台', '詳細未回答', '7/1(水) PM18:00', '', '確定'],
  ['舞台監督 ルウジ', 'ルウジ', '-', '未定', '未定', '-', '7/1(水)〜7/2(木)', '舞台監督サポート', '確定'],
  // --- 追加枠（回答待ち・未確定） ---
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
  ['', '', '', '', '', '', '', '', '未確認'],
];

// ══════════════════════════════════════════════════
// 賄い情報
// ══════════════════════════════════════════════════
const MEAL_SCHEDULE = [
  // [日付, 食事, 担当者, 時間, 食数目安, 備考]
  ['7/3(金) DAY1前日', '昼食', 'はっしゃん', '12:00〜', '設営スタッフ分', '設営人数に応じて'],
  ['7/3(金) DAY1前日', '夕食', 'はっしゃん', '18:00〜', '設営スタッフ分', ''],
  ['7/4(土) DAY1', '昼食', 'ナカムラ ダイスケ', '12:00〜', '約150食', '無くなり次第終了'],
  ['7/4(土) DAY1', '夕食', 'ナカムラ ダイスケ', '18:00〜', '約150食', '無くなり次第終了'],
  ['7/5(日) DAY2', '昼食', 'はっしゃん', '12:00〜', '約150食', '無くなり次第終了'],
  ['7/5(日) DAY2', '夕食', 'ナカムラ ダイスケ', '18:00〜', '約150食', '無くなり次第終了'],
  ['7/6(月) DAY3', '朝食', 'マサヤ（正弥）', '朝', '撤収スタッフ分', 'アフターパーティー明け'],
];

const MEAL_EQUIPMENT = [
  // [品目, 数量, 状態, 調達方法, 備考]
  ['ガスボンベ 10kg', '3本', '調達済み', '購入', '二口バルブ4ホース・五徳3連とセット'],
  ['ガス炊飯器（5升）', '1台', '調達済み', 'レンタル', '正弥が手配'],
  ['保温ジャー（5升）', '1台', '調達済み', 'レンタル', ''],
  ['長机', '2枚', '調達済み', 'レンタル', '配膳台として使用'],
  ['調理器具一式', '一式', '確認中', '', '大鍋・お玉・菜箸等'],
  ['食器・使い捨て容器', '150人分', '確認中', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
];

// ══════════════════════════════════════════════════
// タスクデータ（全LINEグループから抽出）
// 列順: [担当者, 部署, タスク内容, 状態, 優先度, 期日, 関連LINE, メモ]
// ══════════════════════════════════════════════════
const INITIAL_TASKS = [
  // ── 電源・音響 ──
  ['たなのりくん', '電源', 'ステージ側 分電盤レンタル確認・見積もり作成', '対応中', '高', '', 'ステージ音響&電源', '妹尾からの返答待ち。レンタルか弊社用意か確定後に準備'],
  ['妹尾 真行', '電源', '分電盤レンタル費用確認→たなのりくんへ返答', '対応中', '高', '2026/06/07', 'ステージ音響&電源', '土日中に確認予定'],
  ['yusuke ono', '音響', 'スピーカー台スタッキングフレーム寸法確認→hajimeへ連携', '対応中', '高', '', 'ステージグループ', 'hajimeと仕様決定して製作依頼'],
  ['yusuke ono', '音響', 'd&bシステム詳細（シリーズ・数量）確定・グループ共有', '対応中', '高', '', 'mmt2026音響グループ', 'Fix後に各担当へ展開。MTG設定必要'],
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
  ['Shusui Tanaka', 'エントランス', '荷物検査チーム体制確認・HI-Cと打ち合わせ', '対応中', '高', '', '荷物検査', 'HI-Cが沖縄から帰国後MTG'],
  // ── 場外駐車場 ──
  ['Hide', '場外P', '場外駐車場シフト完成', '対応中', '高', '', '場外P', 'ゆうさんがざっくり作ってくれた。詳細詰め必要'],
  ['Hide', '場外P', '場外改善案実施：場外でテントチケット全種類もぎり対応', '対応中', '高', '2026/07/01', '場外P', '昨年は場内でもぎり→混乱。今年は場外で全種類対応。テント貼り付け用テント券も準備'],
  ['Hide', '場外P', '駐車券（紙）用意：名前・電話番号×2記載フォーマット作成', '対応中', '高', '', '場外P', 'docomo以外対応。同乗者含め2番号。ダッシュボードに置いてもらう'],
  ['Hide', '場外P', 'ボランティア20名確定（場外P担当）', '対応中', '高', '', '場外P', 'Hideが算出済み（5/1）'],
  // ── 警備 ──
  ['YUTO', '警備', '警備備品調達：タープ×3・送風機×3・イス×4・クーラーボックス×3', '対応中', '高', '2026/06/30', 'mmt2026 警備&駐車整理', '保冷剤・ミネラルウォーターも人数分'],
  ['YUTO', '警備', 'カラーコーン・コーンバー大量調達（陀羅尼助前・関係者P入口含む）', '対応中', '高', '2026/06/30', 'mmt2026 警備&駐車整理', '昨年はビニール紐→見えにくい。今年はトラロープ&杭も'],
  ['YUTO', '警備', '各駐車場看板製作設置（P-A・P-B・オートキャンプ・場外・矢印）', '対応中', '高', '2026/06/30', 'mmt2026 警備&駐車整理', 'お客様が一目で分かるように。案内矢印も必要'],
  ['YUTO', '警備', 'トラロープ&杭調達（ビニール紐からの変更）', '対応中', '中', '2026/06/30', 'mmt2026 警備&駐車整理', '場外Pは水はけ悪い→雨でビニール紐は不可'],
  ['青木 陽平', '警備', '警備員5名手配（駐車場・エントランス・管理棟・Uターン・休憩）', '完了', '高', '', 'mmt2026 警備&駐車整理', '全日本警備保障。配置時間：DAY1 9-22時、DAY2 9-20時、DAY3 10-17時'],
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
  ['Yuto Saruwatari', 'シャトルバス', 'シャトルバスドライバー6名確定・シフト作成', '対応中', '高', '', 'シャトルバスCore', '1人1日8h×3日=24h。6人で合計144h確保。小寺さん20h実績'],
  // ── 出店管理 ──
  ['YMT', '出店管理', '出店ボランティア2名確定（サクヤマ ケイト・ナカムラ リク）', '完了', '中', '', '出店グループ', 'ボランティア采配MTGで確定'],
  ['YMT', '出店管理', '出店管理マスターシート最終更新', '完了', '高', '2026/05/28', '出店グループ', 'マスターシートの出店管理タブに全店舗まとめ完了'],
  // ── 全体 ──
  ['HI-C', '全体', '沖縄ツアー後帰阪・洞川ロケハン段取り', '予定', '高', '2026/06/09', '全体', '6/4〜沖縄→6/9帰阪後洞川'],
  ['HI-C', '全体', '帯状疱疹回復・各MTG対応再開', '対応中', '高', '', '全体', '病院通院中。月曜帰阪後本格始動'],
  ['妹尾 真行', '全体', 'MOMENT2026 組織図・マスター資料更新', '対応中', '中', '', '全体', 'Discordにまとめ。ジュニア連携'],
];

// ══════════════════════════════════════════════════
// スケジュールデータ
// ══════════════════════════════════════════════════
const SCHEDULE_DATA = [
  ['2026/06/08', 'MTG', '舞台監督MTG（オンライン）', 'HI-C、Joshua SW、ルウジ', 'オンライン', 'Joshua息子が手足口病 → 月曜22:30以降でリスケ'],
  ['2026/06/09', 'ロケハン', '洞川ロケハン（12時現地集合）', 'HI-C、masato morokuma、武藤剛亘', '洞川キャンプ場', '武藤の車。電波なし注意。HI-Cはそのまま現地泊'],
  ['2026/06/09', '作業期限', 'ボランティア保留分アサイン決定', 'HI-C、KEITA、南城', '', 'HI-C帰国後に決定'],
  ['2026/06/15以降', 'MTG', '電源・配電計画MTG', '妹尾/YMT/たなのりくん/Kunihiko', 'オンライン or 現地', '分電盤・ケーブル本数・ルート確定。発注へ'],
  ['2026/06/27', 'MTG', '設営MTG（22時〜）', 'HI-C、妹尾、hajime', 'オンライン', '発注品最終決定。約1ヶ月前'],
  ['2026/06/30', '設営', '設営1日目（11人）/ ストレッチテント設営', '設営チーム + 岩城(ストレッチテント)', '洞川キャンプ場', 'ストレッチテントC 6/30 10:00入り。オレオ午前中入り'],
  ['2026/07/01', '設営', '設営2日目（13人）/ 音響チーム入り', '設営チーム + yusuke ono', '洞川キャンプ場', 'yusuke: 2tロング→積み替え。レオが軽トラで同行。フラワー11時入り'],
  ['2026/07/02', '設営・工事', '設営3日目（15人）/ 電気工事 / 街灯設置', '設営+Very(たなのりくん)+後藤電機', '洞川キャンプ場', '電気工事：Very担当。街灯のみ：後藤電機。VJ（CRACKWORKS）16時頃入り'],
  ['2026/07/03', '本番DAY1', 'MOMENT 2026 DAY1', '全員', '洞川キャンプ場', '9:00 Gate Open / 14:00〜 音楽 / 翌4:00 終了。キッズ12:00-18:30。Joshua 11時入り'],
  ['2026/07/04', '本番DAY2', 'MOMENT 2026 DAY2', '全員', '洞川キャンプ場', '9:00 Gate Open / 11:00〜 音楽 / 翌7:00 終了。キッズ10:00-18:30'],
  ['2026/07/05', '本番DAY3', 'MOMENT 2026 DAY3 + After Party', '全員', '洞川キャンプ場', '9:00 Gate Open / 10:00〜 音楽 / After18:00-1:00。キッズ10:00-17:00'],
  ['2026/07/06', '撤収', '撤収1日目（25人以上）', '撤収チーム', '洞川キャンプ場', 'ストレッチテントボランティア4名'],
  ['2026/07/07', '撤収', '撤収2日目', '撤収チーム', '洞川キャンプ場', ''],
];

// ══════════════════════════════════════════════════
// メイン関数 ── ここを選んで実行 ▶
// ══════════════════════════════════════════════════
function createManagementSystem() {
  const ss = SpreadsheetApp.create('MOMENT 2026 統合管理システム v2');

  const dashboard  = setupDashboard(ss);
  const taskSheet  = setupTaskSheet(ss);
  const cal6       = setupCalendar(ss, 6);
  const cal7       = setupCalendar(ss, 7);
  const deptSheet  = setupDeptView(ss);
  const staffSheet = setupStaffSheet(ss);
  const mealSheet  = setupMealSheet(ss);
  const lineSheet  = setupLineImport(ss);
  const linksSheet = setupLinksSheet(ss);

  const def = ss.getSheetByName('シート1');
  if (def) ss.deleteSheet(def);

  ss.setActiveSheet(dashboard);
  ss.moveActiveSheet(1);

  const url = ss.getUrl();
  console.log('✅ 作成完了！URLをブックマーク → ' + url);
  Logger.log('作成完了: ' + url);
  return ss;
}

// ══════════════════════════════════════════════════
// ① ダッシュボード（リンク付き強化版）
// ══════════════════════════════════════════════════
function setupDashboard(ss) {
  const sh = ss.insertSheet('🏠 ダッシュボード');
  sh.setTabColor(C.NAVY);

  // タイトル
  sh.setRowHeight(1, 60);
  sh.getRange('A1:J1').merge()
    .setValue('🎵 MOMENT 2026 統合管理システム')
    .setBackground(C.NAVY).setFontColor(C.WHITE)
    .setFontSize(22).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  sh.getRange('A2:J2').merge()
    .setValue('📅 MOMENT 2026 ／ 7月3日〜5日 ／ 洞川キャンプ場（天川村・奈良）　最終更新: ' +
      Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'))
    .setBackground('#1a3060').setFontColor('#a8c4ff')
    .setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 28);

  // ── 関連シートリンクバナー ──
  sh.setRowHeight(3, 10);
  sh.getRange('A4:J4').merge()
    .setValue('🔗 関連シートへのクイックアクセス')
    .setBackground('#263238').setFontColor('#eceff1')
    .setFontSize(12).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(4, 28);

  SHEETS_LINKS.forEach((link, i) => {
    const col = i + 1;
    sh.setColumnWidth(col, 200);
    sh.setRowHeight(5, 44);
    sh.getRange(5, col)
      .setFormula('=HYPERLINK("' + link.url + '","' + link.name + '")')
      .setBackground(link.color).setFontColor(C.WHITE)
      .setFontSize(9).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setWrap(true);
  });

  // ── 部署ステータス ──
  sh.setRowHeight(6, 12);
  sh.getRange('A7').setValue('📊 部署別タスク進捗')
    .setFontSize(13).setFontWeight('bold').setFontColor(C.NAVY);
  sh.setRowHeight(7, 28);

  const cardH = ['部署', '担当者(代表)', '総数', '✅完了', '🔄対応中', '⏳保留/待機', '🗓予定', '進捗%', '次のアクション'];
  sh.getRange(8, 1, 1, cardH.length).setValues([cardH])
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(8, 30);

  const depts = buildDeptSummary();
  depts.forEach((row, i) => {
    const r = 9 + i;
    sh.setRowHeight(r, 24);
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    sh.getRange(r, 1).setBackground(C.DEPT[row[0]] || '#f5f5f5').setFontWeight('bold');
    const pct = parseFloat(row[7]) || 0;
    const pctBg = pct >= 75 ? '#c8e6c9' : pct >= 40 ? '#fff9c4' : '#ffcdd2';
    sh.getRange(r, 8).setBackground(pctBg).setHorizontalAlignment('center');
    if (i % 2 === 1) {
      for (let c = 2; c <= 9; c++) sh.getRange(r, c).setBackground('#fafafa');
    }
  });

  [1,2,3,4,5,6,7,8].forEach((c, i) =>
    sh.setColumnWidth(c, [140,170,60,60,70,80,60,70][i]));
  sh.setColumnWidth(9, 320);

  // ── 直近スケジュール ──
  const sRow = 10 + depts.length;
  sh.setRowHeight(sRow, 12);
  sh.getRange(sRow + 1, 1).setValue('📅 直近スケジュール')
    .setFontSize(13).setFontWeight('bold').setFontColor(C.NAVY);
  sh.setRowHeight(sRow + 1, 28);

  const sH = ['日付', '種別', '内容', '参加者', '場所', 'メモ'];
  sh.getRange(sRow + 2, 1, 1, 6).setValues([sH])
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(sRow + 2, 30);

  const today = new Date();
  const upcoming = SCHEDULE_DATA.filter(r => {
    try { return new Date(r[0]) >= today || r[0].includes('以降'); } catch(e) { return true; }
  }).slice(0, 9);

  upcoming.forEach((row, i) => {
    const r = sRow + 3 + i;
    sh.setRowHeight(r, 26);
    sh.getRange(r, 1, 1, 6).setValues([row]);
    const typeC = C.EVENT[row[1]] || '#607d8b';
    sh.getRange(r, 2).setBackground(typeC).setFontColor(C.WHITE).setFontWeight('bold').setHorizontalAlignment('center');
    if (i % 2 === 1) sh.getRange(r, 1, 1, 6).setBackground('#fafafa');
  });

  sh.getRange(8, 1, 1 + depts.length, 9).setBorder(true, true, true, true, true, true);
  sh.getRange(sRow + 2, 1, 1 + upcoming.length, 6).setBorder(true, true, true, true, true, true);
  sh.setFrozenRows(8);

  return sh;
}

function buildDeptSummary() {
  const deptNext = {
    '全体': 'HI-C帰国後(6/9〜)に各部署MTG再開',
    '運営本部': 'ロケハン6/9 → インカム発注 → 本部シフト確定',
    '出店管理': 'マスターシート更新済み。ボランティア2名確定済み',
    '電源': '分電盤レンタル返答待ち → 発注へ（急ぎ）',
    '設営': '見積もり提出 → 6/27MTGで最終発注確定',
    '音響': 'd&bシステム詳細Fix → スピーカー台製作 → 7/1入り',
    'ステージ': 'スピーカー台製作（単管）→ 7/1入りで最終位置決め',
    '舞台監督': 'MTGリスケ。Joshua回復後→月曜オンライン',
    'バー': 'メニュー作成→コップ発注→バーテン連絡',
    'エントランス': '管理表完成→荷物検査チームと擦り合わせ',
    '場外P': '改善案実施（テントチケット場外対応）・シフト完成・ボランティア20名確定',
    '警備': '備品調達→看板製作→警備員5名手配（完了）',
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
    '全体': 'HI-C / 妹尾 真行',           '運営本部': '石田翔馬 / 諸隈 / 武藤',
    '出店管理': 'YMT（ヤマト）',             '電源': 'Kunihiko / たなのりくん',
    '設営': 'hajime（忍）',                 '音響': 'yusuke ono / kan2',
    'ステージ': 'oleoreo / 岩城',           '舞台監督': 'Joshua SW / ルウジ',
    'バー': '🌞Hiroto Arai / 田岡太一',     'エントランス': '＆you⭐︎ / kazuha',
    '場外P': 'Hide',                        '警備': 'YUTO / 青木陽平（全日本警備）',
    'ボランティア': '南城 / KEITA',          'キッズ': 'akinoko',
    '清掃': '中道大雅',                      '食堂': '正弥 / ナカムラ ダイスケ',
    '物販': 'ʚ愛ɞ / MARIA',               '広報': 'MARIA / Momoko / YMT',
    'カメラ': 'takashi / Maya / Kenta',     'シャトルバス': 'Yuto Saruwatari',
  };

  const deptMap = {};
  INITIAL_TASKS.forEach(t => {
    const d = t[1];
    if (!deptMap[d]) deptMap[d] = { total:0, done:0, inProgress:0, waiting:0, scheduled:0 };
    deptMap[d].total++;
    const s = t[3];
    if (s === '完了') deptMap[d].done++;
    else if (['対応中','調整中'].includes(s)) deptMap[d].inProgress++;
    else if (['待機中','保留'].includes(s)) deptMap[d].waiting++;
    else if (s === '予定') deptMap[d].scheduled++;
  });

  return Object.entries(deptMap).map(([dept, d]) => {
    const pct = d.total > 0 ? Math.round(d.done / d.total * 100) : 0;
    return [dept, deptReps[dept] || '', d.total, d.done, d.inProgress, d.waiting, d.scheduled, pct + '%', deptNext[dept] || ''];
  });
}

// ══════════════════════════════════════════════════
// ② タスク管理シート
// ══════════════════════════════════════════════════
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
  const rows = INITIAL_TASKS.map((t, i) => [i + 1, t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7], today]);
  sh.getRange(2, 1, rows.length, 10).setValues(rows);

  rows.forEach((row, i) => {
    const r = i + 2;
    sh.setRowHeight(r, 24);
    sh.getRange(r, 5).setBackground(C.STATUS[row[4]] || '#fff').setHorizontalAlignment('center');
    sh.getRange(r, 6).setBackground(C.PRIORITY[row[5]] || '#fff').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(r, 3).setBackground(C.DEPT[row[2]] || '#f5f5f5').setHorizontalAlignment('center');
    if (i % 2 === 1) sh.getRange(r, 4).setBackground('#fafafa');
  });

  [1,2,3,4,5,6,7,8,9,10].forEach((c, i) =>
    sh.setColumnWidth(c, [40,160,120,340,90,72,100,180,280,90][i]));
  sh.getRange(2, 1, rows.length, 10).setBorder(true, true, true, true, true, true);
  sh.getRange(1, 1, rows.length + 1, 10).createFilter();

  return sh;
}

// ══════════════════════════════════════════════════
// ③ カレンダーシート
// ══════════════════════════════════════════════════
function setupCalendar(ss, month) {
  const sh = ss.insertSheet('📅 ' + month + '月カレンダー');
  sh.setTabColor(month === 6 ? '#1976d2' : '#7b1fa2');

  const year = 2026;
  sh.getRange('A1:G1').merge()
    .setValue('MOMENT 2026 ─ ' + month + '月 ' + year)
    .setBackground(C.NAVY).setFontColor(C.WHITE)
    .setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 48);

  const days = ['日', '月', '火', '水', '木', '金', '土'];
  sh.getRange(2, 1, 1, 7).setValues([days]).setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
  days.forEach((d, i) => {
    sh.getRange(2, i + 1).setBackground(i === 0 ? '#ffebee' : i === 6 ? '#e3f2fd' : '#f5f5f5');
  });
  sh.setRowHeight(2, 28);

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  let row = 3, col = firstDay + 1;

  for (let day = 1; day <= daysInMonth; day++) {
    sh.setRowHeight(row, 95);
    sh.setColumnWidth(col, 120);
    const cell = sh.getRange(row, col);
    const dow = (firstDay + day - 1) % 7;
    cell.setBackground(dow === 0 ? '#fff8f8' : dow === 6 ? '#f0f4ff' : '#ffffff')
      .setVerticalAlignment('top').setWrap(true);

    const dateStr = year + '/' + String(month).padStart(2,'0') + '/' + String(day).padStart(2,'0');
    const events = SCHEDULE_DATA.filter(e => e[0] === dateStr || e[0].startsWith(dateStr));
    let label = day.toString();
    events.forEach(e => { label += '\n[' + e[1] + '] ' + e[2]; });
    cell.setValue(label).setFontSize(events.length > 0 ? 9 : 11);
    if (dow === 0) cell.setFontColor('#c62828');
    if (dow === 6) cell.setFontColor('#1565c0');
    if (events.length > 0) {
      cell.setBackground((C.EVENT[events[0][1]] || '#607d8b') + '33').setFontWeight('bold');
    }

    col++;
    if (col > 7) { col = 1; row++; }
  }
  for (let r = 3; r <= row; r++) sh.setRowHeight(r, 95);
  sh.getRange(2, 1, row - 2, 7).setBorder(true, true, true, true, true, true);
  return sh;
}

// ══════════════════════════════════════════════════
// ④ 部署別ビュー
// ══════════════════════════════════════════════════
function setupDeptView(ss) {
  const sh = ss.insertSheet('🏢 部署別タスク');
  sh.setTabColor('#388e3c');

  const headers = ['部署', '担当者', 'タスク内容', '状態', '優先度', '期日', 'メモ'];
  sh.getRange(1, 1, 1, 7).setValues([headers])
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 32);
  sh.setFrozenRows(1);

  const byDept = {};
  INITIAL_TASKS.forEach(t => {
    if (!byDept[t[1]]) byDept[t[1]] = [];
    byDept[t[1]].push(t);
  });

  let cr = 2;
  Object.entries(byDept).forEach(([dept, tasks]) => {
    const dc = C.DEPT[dept] || '#e0e0e0';
    sh.setRowHeight(cr, 28);
    sh.getRange(cr, 1, 1, 7).merge()
      .setValue('【 ' + dept + ' 】 ─ ' + tasks.length + '件')
      .setBackground(dc).setFontWeight('bold').setFontSize(12).setVerticalAlignment('middle');
    cr++;
    tasks.forEach(t => {
      sh.setRowHeight(cr, 24);
      sh.getRange(cr, 1, 1, 7).setValues([[t[1], t[0], t[2], t[3], t[4], t[5], t[7]]]);
      sh.getRange(cr, 1).setBackground(dc).setHorizontalAlignment('center');
      sh.getRange(cr, 4).setBackground(C.STATUS[t[3]] || '#fff').setHorizontalAlignment('center');
      sh.getRange(cr, 5).setBackground(C.PRIORITY[t[4]] || '#fff').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
      cr++;
    });
    sh.setRowHeight(cr, 8);
    cr++;
  });

  [1,2,3,4,5,6,7].forEach((c, i) => sh.setColumnWidth(c, [120,160,300,90,70,90,280][i]));
  sh.getRange(2, 1, cr - 2, 7).setBorder(true, true, true, true, true, true);
  sh.getRange(1, 1, cr - 1, 7).createFilter();
  return sh;
}

// ══════════════════════════════════════════════════
// ⑤ スタッフ入り情報シート（翔馬君リクエスト対応）
// ══════════════════════════════════════════════════
function setupStaffSheet(ss) {
  const sh = ss.insertSheet('👥 スタッフ入り情報');
  sh.setTabColor('#e65100');

  // タイトル
  sh.getRange('A1:I1').merge()
    .setValue('👥 スタッフ入り情報 ── チーム別 人数・車両・入り時間')
    .setBackground('#bf360c').setFontColor(C.WHITE)
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 44);

  sh.getRange('A2:I2').merge()
    .setValue('📌 翔馬のリクエストへの回答まとめ ／ 追加情報は下の空欄に随時記入 ／ LINEグループで確認できた情報を転記')
    .setBackground('#fbe9e7').setFontSize(10).setHorizontalAlignment('center');
  sh.setRowHeight(2, 24);

  // ヘッダー
  const headers = ['チーム名', '代表者/担当', '連絡先', 'スタッフ人数', '車両台数', '車両詳細', '入り日時', '備考', 'ステータス'];
  sh.getRange(3, 1, 1, headers.length).setValues([headers])
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(3, 32);
  sh.setFrozenRows(3);

  // データ書き込み
  const statusColors = {
    '確定': '#c8e6c9', '調整中': '#fff9c4', '未確認': '#ffcdd2', '': '#f5f5f5',
  };

  STAFF_ARRIVAL.forEach((row, i) => {
    const r = 4 + i;
    sh.setRowHeight(r, 28);
    if (row[0]) { // データあり
      sh.getRange(r, 1, 1, 9).setValues([row]);
      const sc = statusColors[row[8]] || '#fff';
      sh.getRange(r, 9).setBackground(sc).setHorizontalAlignment('center').setFontWeight('bold');
      if (i % 2 === 0 && row[0]) sh.getRange(r, 1, 1, 8).setBackground('#fafafa');
    } else { // 空行（追加枠）
      sh.getRange(r, 9).setBackground('#ffcdd2').setValue('未確認').setHorizontalAlignment('center');
    }
  });

  // 列幅
  const widths = [160, 140, 130, 90, 80, 220, 150, 240, 80];
  widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange(3, 1, 1 + STAFF_ARRIVAL.length, 9).setBorder(true, true, true, true, true, true);
  sh.getRange(3, 1, 1 + STAFF_ARRIVAL.length, 9).createFilter();

  // 車両集計セクション
  const sumRow = 4 + STAFF_ARRIVAL.length + 2;
  sh.getRange(sumRow, 1, 1, 9).merge()
    .setValue('📊 車両台数・人数サマリー（確定分のみ）')
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(sumRow, 30);

  const confirmed = STAFF_ARRIVAL.filter(r => r[8] === '確定' && r[0]);
  let totalStaff = 0, totalCars = 0;
  confirmed.forEach(r => {
    const s = r[3].replace(/名|人|前後/g, '').split('-')[0];
    const c = r[4].replace(/台|程度/g, '').split('+').length;
    if (!isNaN(parseInt(s))) totalStaff += parseInt(s);
    totalCars += parseInt(r[4]) || 1;
  });

  sh.getRange(sumRow + 1, 1, 1, 3).setValues([['確定チーム数', '確定スタッフ合計(参考)', '確定車両合計(参考)']]).setFontWeight('bold').setBackground('#e3f2fd');
  sh.getRange(sumRow + 2, 1, 1, 3).setValues([[confirmed.length + 'チーム', totalStaff + '名以上', totalCars + '台以上']]).setFontSize(13).setFontWeight('bold');
  sh.setRowHeight(sumRow + 2, 32);

  return sh;
}

// ══════════════════════════════════════════════════
// ⑥ 賄い情報シート
// ══════════════════════════════════════════════════
function setupMealSheet(ss) {
  const sh = ss.insertSheet('🍚 賄い情報');
  sh.setTabColor('#ff8f00');

  sh.getRange('A1:F1').merge()
    .setValue('🍚 賄い情報 ── スタッフ賄いシフト・機材・担当者')
    .setBackground('#e65100').setFontColor(C.WHITE)
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 44);

  // 担当者
  sh.getRange('A2:F2').merge()
    .setValue('🧑‍🍳 主担当: 正弥（マサヤ） ／ ナカムラ ダイスケ ／ はっしゃん')
    .setBackground('#fff3e0').setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center');
  sh.setRowHeight(2, 28);

  // 提供ルール
  sh.getRange('A3:F3').merge()
    .setValue('🕐 提供時間: 12:00〜 と 18:00〜（約150食がなくなるまで）　※設営期間は人数に合わせて対応')
    .setBackground('#fbe9e7').setFontSize(11).setHorizontalAlignment('center');
  sh.setRowHeight(3, 24);

  // ── シフト表 ──
  sh.setRowHeight(4, 12);
  sh.getRange('A5').setValue('📅 賄いシフト表').setFontSize(13).setFontWeight('bold').setFontColor('#bf360c');
  sh.setRowHeight(5, 28);

  const sHeaders = ['日付', '食事区分', '担当者', '提供時間', '食数目安', '備考'];
  sh.getRange(6, 1, 1, 6).setValues([sHeaders])
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(6, 30);
  sh.setFrozenRows(6);

  MEAL_SCHEDULE.forEach((row, i) => {
    const r = 7 + i;
    sh.setRowHeight(r, 26);
    sh.getRange(r, 1, 1, 6).setValues([row]);
    const nameColors = {
      'はっしゃん': '#e3f2fd', 'ナカムラ ダイスケ': '#e8f5e9', 'マサヤ（正弥）': '#fff9c4',
    };
    sh.getRange(r, 3).setBackground(nameColors[row[2]] || '#fafafa').setHorizontalAlignment('center').setFontWeight('bold');
    if (i % 2 === 1) sh.getRange(r, 1, 1, 6).setBackground('#fafafa');
  });

  sh.getRange(6, 1, 1 + MEAL_SCHEDULE.length, 6).setBorder(true, true, true, true, true, true);

  // ── 機材リスト ──
  const eqRow = 8 + MEAL_SCHEDULE.length;
  sh.setRowHeight(eqRow, 12);
  sh.getRange(eqRow + 1, 1).setValue('🔧 機材・消耗品リスト').setFontSize(13).setFontWeight('bold').setFontColor('#bf360c');
  sh.setRowHeight(eqRow + 1, 28);

  const eqH = ['品目', '数量', '調達状況', '調達方法', '備考'];
  sh.getRange(eqRow + 2, 1, 1, 5).setValues([eqH])
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(eqRow + 2, 30);

  MEAL_EQUIPMENT.forEach((row, i) => {
    const r = eqRow + 3 + i;
    sh.setRowHeight(r, 24);
    sh.getRange(r, 1, 1, 5).setValues([row]);
    const sc = row[2] === '調達済み' ? '#c8e6c9' : row[2] === '確認中' ? '#fff9c4' : '#ffcdd2';
    sh.getRange(r, 3).setBackground(sc).setHorizontalAlignment('center').setFontWeight('bold');
    if (i % 2 === 1) sh.getRange(r, 1, 1, 5).setBackground('#fafafa');
  });

  sh.getRange(eqRow + 2, 1, 1 + MEAL_EQUIPMENT.length, 5).setBorder(true, true, true, true, true, true);

  // ── メモ ──
  const nRow = eqRow + 4 + MEAL_EQUIPMENT.length;
  sh.getRange(nRow, 1, 1, 6).merge()
    .setValue('📝 その他メモ・追加情報')
    .setBackground('#fff3e0').setFontWeight('bold').setFontSize(11);
  sh.setRowHeight(nRow, 26);

  const notes = [
    ['ガスセット', '二口バルブ4ホース・五徳3連 ─ 正弥が手配済み'],
    ['食材調達', '前日仕込み: 正弥が段取り。食材費は当日精算予定'],
    ['アレルギー対応', '特定のアレルギー情報は事前に把握する'],
    ['廃棄・清掃', 'ゴミ分別・鍋洗い担当を事前に決めておく'],
    ['', ''],
    ['', ''],
    ['', ''],
  ];
  notes.forEach((note, i) => {
    const r = nRow + 1 + i;
    sh.setRowHeight(r, 24);
    sh.getRange(r, 1, 1, 2).setValues([note]);
    sh.getRange(r, 1).setFontWeight('bold').setBackground('#fff8e1');
    if (i % 2 === 1) sh.getRange(r, 2).setBackground('#fafafa');
  });

  [1,2,3,4,5,6].forEach((c, i) => sh.setColumnWidth(c, [160,100,130,100,100,200][i]));

  return sh;
}

// ══════════════════════════════════════════════════
// ⑦ LINE取込シート（改良版 ── TXTファイル貼り付け対応）
// ══════════════════════════════════════════════════
function setupLineImport(ss) {
  const sh = ss.insertSheet('📱 LINE取込');
  sh.setTabColor('#06C755');

  sh.getRange('A1:F1').merge()
    .setValue('📱 LINEトーク取込 ── TXTファイル貼り付けで自動解析')
    .setBackground('#06C755').setFontColor(C.WHITE)
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 44);

  // 手順（TXTファイル対応版）
  const steps = [
    ['📁', 'STEP 1', 'LINEアプリ → グループ → ☰（右上） → トーク履歴をバックアップ → .txt ファイルをPCに保存'],
    ['📝', 'STEP 2', 'PCでそのtxtファイルをメモ帳（テキストエディタ）で開く → Ctrl+A で全選択 → Ctrl+C でコピー'],
    ['📋', 'STEP 3', '下の「▼ LINEトーク貼り付けエリア」のセル(A10)をクリックして Ctrl+V で貼り付け'],
    ['⚙️', 'STEP 4', '上のメニュー「🎵 MOMENT管理」→「📱 LINE解析実行」をクリック'],
    ['✅', 'STEP 5', '解析結果（行54以下）を確認 → 必要なタスクを「📋 全タスク」シートに手動追記'],
  ];

  sh.getRange('A2:F2').merge()
    .setValue('⚠️ LINEアプリからの直接コピーは取りこぼしあり！必ずTXTファイルをPCで開いてから全選択コピーしてください')
    .setBackground('#ffcdd2').setFontSize(11).setFontWeight('bold').setHorizontalAlignment('center');
  sh.setRowHeight(2, 28);

  sh.getRange(3, 1, 1, 3).setValues([['アイコン', 'ステップ', '手順内容']])
    .setFontWeight('bold').setBackground('#c8e6c9').setFontSize(11);
  sh.setRowHeight(3, 28);
  steps.forEach((s, i) => {
    sh.getRange(4 + i, 1, 1, 3).setValues([s]);
    sh.setRowHeight(4 + i, 26);
    if (i % 2 === 0) sh.getRange(4 + i, 1, 1, 3).setBackground('#f9fbe7');
  });

  sh.setRowHeight(9, 14);
  sh.getRange('A10:F10').merge()
    .setValue('▼ ここにLINEトークを貼り付け（複数グループ分を連続して貼ってOK。古い内容は削除してから）')
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(10, 32);

  sh.getRange('A11').setValue('← ここをクリックして Ctrl+V で貼り付け →')
    .setBackground('#f9f9f9').setFontColor('#aaaaaa').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('top')
    .setWrap(true);
  sh.getRange('A11:F51').merge().setBorder(true, true, true, true, false, false);
  sh.setRowHeight(11, 500);

  sh.getRange('A53:F53').merge()
    .setValue('▼ 解析結果（ここにタスク・MTG候補が抽出されます）')
    .setBackground('#1976d2').setFontColor(C.WHITE).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(53, 30);

  const rH = ['種別', '担当者(推定)', '内容（抜粋）', '日付/期限', '元テキスト行', '確認'];
  sh.getRange(54, 1, 1, 6).setValues([rH])
    .setBackground('#e3f2fd').setFontWeight('bold').setFontSize(10);
  sh.setRowHeight(54, 26);

  // グループ名入力欄
  sh.getRange('A52').setValue('LINEグループ名（任意）:').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('B52').setValue('').setBackground('#fffde7').setBorder(true, true, true, true, false, false);

  [1,2,3,4,5,6].forEach((c, i) => sh.setColumnWidth(c, [70,150,360,120,200,80][i]));
  return sh;
}

// ══════════════════════════════════════════════════
// ⑧ 関連シートリンクシート
// ══════════════════════════════════════════════════
function setupLinksSheet(ss) {
  const sh = ss.insertSheet('🔗 関連シートリンク');
  sh.setTabColor('#263238');

  sh.getRange('A1:D1').merge()
    .setValue('🔗 MOMENT 2026 関連Google Sheetsリンク一覧')
    .setBackground('#263238').setFontColor(C.WHITE)
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 44);

  sh.getRange('A2:D2').merge()
    .setValue('下のリンクをクリックすると各管理シートに直接アクセスできます')
    .setBackground('#eceff1').setFontSize(11).setHorizontalAlignment('center');
  sh.setRowHeight(2, 24);

  const headers = ['シート名', 'リンク（クリックで開く）', '用途・内容', '最終更新'];
  sh.getRange(3, 1, 1, 4).setValues([headers])
    .setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold').setFontSize(12)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(3, 34);

  SHEETS_LINKS.forEach((link, i) => {
    const r = 4 + i;
    sh.setRowHeight(r, 48);
    sh.getRange(r, 1).setValue(link.name).setBackground(link.color).setFontColor(C.WHITE)
      .setFontWeight('bold').setFontSize(11).setVerticalAlignment('middle').setWrap(true);
    sh.getRange(r, 2)
      .setFormula('=HYPERLINK("' + link.url + '","🔗 ' + link.name + ' を開く")')
      .setBackground('#e3f2fd').setFontColor('#1565c0').setFontWeight('bold')
      .setFontSize(12).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(r, 3).setValue(link.desc).setBackground('#fafafa').setFontSize(11).setVerticalAlignment('middle').setWrap(true);
    sh.getRange(r, 4).setValue('').setBackground('#fafafa').setHorizontalAlignment('center');
    if (i % 2 === 0) sh.getRange(r, 3).setBackground('#f5f5f5');
  });

  sh.getRange(3, 1, 1 + SHEETS_LINKS.length, 4).setBorder(true, true, true, true, true, true);
  [1,2,3,4].forEach((c, i) => sh.setColumnWidth(c, [280,280,320,120][i]));

  // Antigravity メモ欄
  const agRow = 5 + SHEETS_LINKS.length + 1;
  sh.setRowHeight(agRow - 1, 16);
  sh.getRange(agRow, 1, 1, 4).merge()
    .setValue('💡 Antigravityとの連携について ── 詳細を追記してください')
    .setBackground('#fff9c4').setFontSize(12).setFontWeight('bold');
  sh.setRowHeight(agRow, 30);
  sh.getRange(agRow + 1, 1, 1, 4).merge()
    .setValue('Antigravityはどのツール/アプリですか？\n連携方法が決まったらここに手順・URLを記入してください')
    .setBackground('#fffde7').setFontSize(11).setWrap(true);
  sh.setRowHeight(agRow + 1, 60);

  return sh;
}

// ══════════════════════════════════════════════════
// LINE解析エンジン（改良版）
// ══════════════════════════════════════════════════
function parseLINEText() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lineSheet = ss.getSheetByName('📱 LINE取込');
  if (!lineSheet) { SpreadsheetApp.getUi().alert('「LINE取込」シートが見つかりません。'); return; }

  const rawText = lineSheet.getRange('A11').getValue().toString();
  const groupName = lineSheet.getRange('B52').getValue().toString() || 'LINEグループ';

  if (!rawText || rawText.includes('ここをクリック')) {
    SpreadsheetApp.getUi().alert('LINEトークを貼り付けてください（A11セル）。');
    return;
  }

  const lines = rawText.split('\n');
  const extracted = [];

  const taskKeywords = [
    'しておいて','お願いします','お願いしまっす','お願い致します','よろしく',
    'やっておいて','やって欲しい','してほしい','して欲しい','確認お願い',
    '発注','作成','提出','連絡','確認してほしい','教えてほしい','決めてほしい',
    'お願い', 'やっといて', 'しといて',
  ];

  let currentSender = '';
  let currentDate = '';
  let currentMsg = '';

  lines.forEach((line, idx) => {
    // 日付行
    const dateM = line.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    if (dateM) { currentDate = dateM[1] + '/' + dateM[2] + '/' + dateM[3]; return; }

    // メッセージ行（HH:MM 送信者 メッセージ）
    const msgM = line.match(/^(\d{2}:\d{2})\s+([^\s].+?)\s{2,}(.+)/);
    if (msgM) {
      currentSender = msgM[2];
      currentMsg = msgM[3];
    } else if (line.match(/^(\d{2}:\d{2})\s+(.+)/)) {
      const m2 = line.match(/^(\d{2}:\d{2})\s+(.+)/);
      currentSender = '';
      currentMsg = m2[2];
    } else {
      currentMsg = line;
    }

    // タスク検出
    const hasTask = taskKeywords.some(kw => line.includes(kw));
    if (hasTask && line.length > 8 && !line.match(/^\d{4}\.\d{2}\.\d{2}/)) {
      // @メンション → 担当者
      const mentionM = line.match(/@([^\s　@]+)/);
      const assignee = mentionM ? mentionM[1] : currentSender;

      // 日付抽出
      let dueDate = '';
      const dm = line.match(/(\d{1,2})[\/月](\d{1,2})/);
      if (dm) dueDate = '2026/' + dm[1].padStart(2,'0') + '/' + dm[2].padStart(2,'0');

      extracted.push([
        'タスク候補', assignee,
        line.trim().substring(0, 120),
        dueDate,
        currentDate + ' ' + (currentSender || ''),
        groupName,
      ]);
    }

    // MTG検出
    if (line.match(/MTG|ミーティング|打ち合わせ|オンライン.{0,10}ミーティング/i) && line.length > 8) {
      let dueDate = currentDate;
      const dm = line.match(/(\d{1,2})[\/月](\d{1,2})/);
      if (dm) dueDate = '2026/' + dm[1].padStart(2,'0') + '/' + dm[2].padStart(2,'0');
      extracted.push([
        'MTG候補', currentSender,
        line.trim().substring(0, 120),
        dueDate,
        currentDate + ' ' + currentSender,
        groupName,
      ]);
    }

    // スタッフ情報・人数検出
    if (line.match(/(\d+)\s*名|(\d+)\s*人|(\d+)\s*台/) && line.length > 8) {
      extracted.push([
        'スタッフ情報', currentSender,
        line.trim().substring(0, 120),
        currentDate,
        currentDate + ' ' + currentSender,
        groupName,
      ]);
    }
  });

  if (extracted.length === 0) {
    SpreadsheetApp.getUi().alert('タスク・MTGが検出されませんでした。\n\nTXTファイルを正しく貼り付けているか確認してください。');
    return;
  }

  const startRow = 55;
  lineSheet.getRange(startRow, 1, Math.max(extracted.length, 1), 6).clearContent();
  lineSheet.getRange(startRow, 1, extracted.length, 6).setValues(extracted);

  const typeColors = { 'タスク候補': '#fff9c4', 'MTG候補': '#e3f2fd', 'スタッフ情報': '#e8f5e9' };
  extracted.forEach((r, i) => {
    lineSheet.getRange(startRow + i, 1, 1, 6).setBackground(typeColors[r[0]] || '#ffffff');
  });

  SpreadsheetApp.getUi().alert(
    '✅ 解析完了！\n\n' +
    'グループ: ' + groupName + '\n' +
    '検出数: ' + extracted.length + '件\n' +
    '　タスク候補: ' + extracted.filter(r => r[0] === 'タスク候補').length + '件\n' +
    '　MTG候補: ' + extracted.filter(r => r[0] === 'MTG候補').length + '件\n' +
    '　スタッフ情報: ' + extracted.filter(r => r[0] === 'スタッフ情報').length + '件\n\n' +
    '行55以下の解析結果を確認して「📋 全タスク」シートに手動追記してください。'
  );
}

// ══════════════════════════════════════════════════
// タスク追加ヘルパー
// ══════════════════════════════════════════════════
function addTask(担当者, 部署, タスク, 状態, 優先度, 期日, LINE名, メモ) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('📋 全タスク');
  if (!sh) return;
  const lastRow = sh.getLastRow();
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  sh.appendRow([lastRow, 担当者, 部署, タスク, 状態, 優先度, 期日, LINE名, メモ, today]);
  const r = sh.getLastRow();
  sh.getRange(r, 5).setBackground(C.STATUS[状態] || '#fff').setHorizontalAlignment('center');
  sh.getRange(r, 6).setBackground(C.PRIORITY[優先度] || '#fff').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(r, 3).setBackground(C.DEPT[部署] || '#f5f5f5').setHorizontalAlignment('center');
}

// ══════════════════════════════════════════════════
// カスタムメニュー
// ══════════════════════════════════════════════════
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎵 MOMENT管理')
    .addItem('📱 LINE解析実行', 'parseLINEText')
    .addSeparator()
    .addItem('🔄 ダッシュボード更新', 'refreshDashboard')
    .addItem('📊 状態サマリーを表示', 'showStatusSummary')
    .addSeparator()
    .addItem('👥 スタッフシート開く', 'openStaffSheet')
    .addItem('🍚 賄いシート開く', 'openMealSheet')
    .addToUi();
}

function openStaffSheet() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('👥 スタッフ入り情報');
  if (sh) SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sh);
}

function openMealSheet() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('🍚 賄い情報');
  if (sh) SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sh);
}

// ══════════════════════════════════════════════════
// ダッシュボード更新
// ══════════════════════════════════════════════════
function refreshDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashSheet = ss.getSheetByName('🏠 ダッシュボード');
  const taskSheet  = ss.getSheetByName('📋 全タスク');
  if (!dashSheet || !taskSheet) return;

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

  let row = 9;
  Object.entries(deptMap).forEach(([dept, d]) => {
    const pct = d.total > 0 ? Math.round(d.done / d.total * 100) : 0;
    dashSheet.getRange(row, 3, 1, 5).setValues([[d.total, d.done, d.inProgress, d.waiting, d.scheduled]]);
    dashSheet.getRange(row, 8).setValue(pct + '%');
    dashSheet.getRange(row, 8).setBackground(pct >= 75 ? '#c8e6c9' : pct >= 40 ? '#fff9c4' : '#ffcdd2');
    row++;
  });

  dashSheet.getRange('A2').setValue(
    '📅 MOMENT 2026 ／ 7月3日〜5日 ／ 洞川キャンプ場（天川村・奈良）　最終更新: ' +
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'));

  SpreadsheetApp.getUi().alert('✅ ダッシュボードを更新しました！');
}

// ══════════════════════════════════════════════════
// 状態サマリー表示
// ══════════════════════════════════════════════════
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

  SpreadsheetApp.getUi().alert(
    '📊 現在のタスク状況\n\n' +
    '✅ 完了:   ' + counts['完了']    + '件\n' +
    '🔄 対応中: ' + counts['対応中']  + '件\n' +
    '🔵 調整中: ' + counts['調整中']  + '件\n' +
    '⏳ 待機中: ' + counts['待機中']  + '件\n' +
    '⏸ 保留:   ' + counts['保留']    + '件\n' +
    '🗓 予定:   ' + counts['予定']    + '件\n' +
    '🔴 未着手: ' + counts['未着手']  + '件\n' +
    '\n合計: ' + (data.length - 1) + '件'
  );
}
