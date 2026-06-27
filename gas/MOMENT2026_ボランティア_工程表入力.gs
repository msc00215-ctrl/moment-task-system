/**
 * MOMENT 2026 — ①工程表スプシ ボランティア管理シート 更新スクリプト
 * 対象スプシ: 1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY（①工程表）
 * ソース: ボランティアフォーム回答（1tVEmUOELKBQTkDGew6jRmWaqqlCLwz61wIvRCKFuF_Q）
 * 103名 / 16部署 ✅確認済み ｜ ※電話・メール非掲載
 * EXCLUDE: コワセ（マホ）「スタッフに入れてはダメ」/ 大野挙汰「キャンセル」
 */

const SCHEDULE_SS_ID_VOL = '1Drp8iWZ1n2YZRid3FqLnH1hzj_Ap5LQd46ZqKauucTY';

// ─────────────────────────────────────────────
// メイン: ボランティア管理シートを更新
// ─────────────────────────────────────────────

function updateVolunteerSheet() {
  const ss = SpreadsheetApp.openById(SCHEDULE_SS_ID_VOL);

  // 既存シート名候補（どれかにマッチしたら使う）
  const candidates = ['ボランティア', '👥 ボランティア管理', 'ボランティア（WIP）', 'volunteer'];
  let sh = null;
  for (const name of candidates) {
    sh = ss.getSheetByName(name);
    if (sh) { Logger.log('既存シート「' + sh.getName() + '」を再構築します'); break; }
  }
  if (!sh) {
    sh = ss.insertSheet('ボランティア');
    Logger.log('新規シート「ボランティア」を作成しました');
  }

  sh.clear();
  if (sh.getFilter()) sh.getFilter().remove();
  sh.setTabColor('#1B5E20');

  // 列幅: 名前|フリガナ|決定ポジション|6/29|6/30|7/1|7/2|7/3|7/4|7/5|7/6|入り時刻|帰宅時刻
  [170, 130, 155, 52, 52, 52, 52, 52, 52, 52, 52, 72, 72].forEach((w, i) => sh.setColumnWidth(i + 1, w));

  // ── タイトル行 ──
  sh.getRange('A1:M1').merge()
    .setValue('👥 MOMENT 2026 — ボランティア管理（103名 ／ 16部署）');
  sh.getRange('A1:M1')
    .setBackground('#0D0D1A').setFontColor('#C9A84C').setFontSize(15).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 52);

  // ── サブタイトル ──
  sh.getRange('A2:M2').merge()
    .setValue('ソース: ボランティアフォーム回答データ ｜ ✅ = 出勤予定日 ｜ ※電話・メール非掲載 ｜ EXCLUDE: コワセ（マホ）・大野挙汰');
  sh.getRange('A2:M2')
    .setBackground('#1C1C3C').setFontColor('#C9A84C').setFontSize(9)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 26);

  // ── 列ヘッダー（行3）──
  // 正確な曜日: 6/29(月)〜7/6(月)
  const HDR = [
    '名前', 'フリガナ', '決定ポジション',
    '6/29\n(月)', '6/30\n(火)', '7/1\n(水)', '7/2\n(木)',
    '7/3\n(金)', '7/4\n(土)', '7/5\n(日)', '7/6\n(月)',
    '入り\n時刻', '帰宅\n時刻',
  ];
  sh.getRange(3, 1, 1, 13).setValues([HDR]);
  sh.getRange(3, 1, 1, 13)
    .setBackground('#2D2D6B').setFontColor('#FFFFFF').setFontSize(10).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, '#111133', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.setRowHeight(3, 42);
  sh.setFrozenRows(3);

  // ── 部署データ ──
  // days[8]: 出勤予定フラグ [6/29, 6/30, 7/1, 7/2, 7/3, 7/4, 7/5, 7/6]
  const depts = [
    {
      name: 'BAR スタッフ', bg: '#B2EBF2', fg: '#005070',
      days: [false, false, false, true, true, true, true, false],
      members: [
        'Sara', '清澤 未来', '須知 杏奈', '須山 あを', '田村 友理佳', '藤田 真由',
        '松村 潤人', '芹沢 孝哉', 'Acushla Ayla', '松本 葵', '矢部 優花', '山口 空',
        'Hao Bui', 'Jiri Swen', 'Patrick Lothoz', '佐藤 雄亮', '東宮 慎之助',
        'Natalia Ramadori', '菱川 晶', 'Planelles Leo',
      ],
    },
    {
      name: 'エントランス（受付）', bg: '#C8E6C9', fg: '#1B5E20',
      days: [false, false, false, false, true, true, true, false],
      members: [
        'Aurelia Jessica', '穴沢 有希奈', '粟井 真結', '粟井 萌絵', '伊藤 はるか',
        '宇良 匡士郎', '多田 小春', '服部 香琳', '保科 巴蓮',
        'Mykyta Kovalenko', '宮崎 恵巳', '山野 穂佳',
      ],
    },
    {
      name: 'セキュリティ', bg: '#BBDEFB', fg: '#0D47A1',
      days: [false, false, false, false, true, true, true, false],
      members: [
        'Geordie Wilson', '稲井 千夏', '猪田 由理子', '北村 美咲', '金 愛奈',
        'キム チュナ', '重里 久史', '瀬古 麗菜', '竹 春乃', '谷口 能也',
        'Ho Wai Sze', 'Malorie Stanley', '山崎 優子',
      ],
    },
    {
      name: '荷物検査', bg: '#FFF9C4', fg: '#7B5A00',
      // 7/2夜中に一部入り（スケジュール確定）
      days: [false, false, false, true, true, true, true, false],
      members: ['伊禮 心夏', '小野 陽向', '新城 弘樹', '多田 浩平', '野田 レキオ', '橋本 航'],
    },
    {
      name: '場外駐車場', bg: '#E1BEE7', fg: '#4A0E7B',
      days: [false, false, false, false, true, true, true, false],
      members: [
        '浅津 梨子', '杉木 望愛', '小川 遼馬', '石本 耀介', '鷲尾 昂世', '渡邉 龍矢',
        'サジャル アユミ ツボイ', 'コナーズ 東満寿', '小林 佳蓮', '中野 翔太',
        '末廣 啓史', '田中 愛佳', '高橋 謙仁朗',
      ],
    },
    {
      name: '場内駐車場', bg: '#F8BBD0', fg: '#880E4F',
      days: [false, false, false, false, true, true, true, false],
      members: ['鍛治 尚英', '若園 優世', '村上 圭', '関 翔馬', '米谷 航', 'アテュエニ ジュニア', '菅沼 千夏'],
    },
    {
      name: 'シャトルバス', bg: '#FFE0B2', fg: '#6B4500',
      days: [false, false, false, false, true, true, true, false],
      members: ['伊東 憲輝', '岩崎 正亨', '佐伯 安王', '大関 翠', '岡崎 佑生', '柏村 享也', '山崎 力輝夫'],
    },
    {
      name: 'アーティストケア', bg: '#FCEEF5', fg: '#7B1B5E',
      days: [false, false, false, false, true, true, true, false],
      members: ['大井 博絵', '筒井 和斗', '分藤 貴文', 'Kipp Hendricks'],
    },
    {
      name: 'アーティスト送迎', bg: '#EEF5FC', fg: '#1B4D7B',
      days: [false, false, false, false, true, true, true, false],
      members: ['東 颯太朗', '狩俣 力士'],
    },
    {
      name: 'キッズエリア', bg: '#DCEDC8', fg: '#33691E',
      days: [false, false, false, false, true, true, true, false],
      members: ['柏村 郁美', '西島 春菜', '野口 房子', '橋本 瞳衣', 'Betsie K Slaby'],
    },
    {
      name: '設営 / 撤収', bg: '#EDE7F6', fg: '#4A0E7B',
      // 設営フェーズ6/29〜7/3 ＋ 撤収7/6
      days: [true, true, true, true, true, false, false, true],
      members: ['溝口 秋平', '伊藤 楽', 'コステロ 是允', '竹内 涼平', 'Mori Silva Hugo Tadashi', '金沢 真由'],
    },
    {
      name: '舞台監督補佐', bg: '#E8EAF6', fg: '#1A1A3C',
      days: [false, false, false, true, true, true, true, false],
      members: ['田村 かれん'],
    },
    {
      name: 'カメラ / 映像', bg: '#F3E5F5', fg: '#4A0E7B',
      days: [false, false, false, false, true, true, true, false],
      members: ['jacK'],
    },
    {
      name: '出店サポート', bg: '#FFF5EE', fg: '#7B3B1B',
      days: [false, false, false, false, true, true, true, false],
      members: ['坂元 大輔', '作山 けいと', '中村 利玖'],
    },
    {
      name: '物販', bg: '#FFF9E6', fg: '#6B4500',
      days: [false, false, false, false, true, true, true, false],
      members: ['姫野 尚紀', 'コステロ 誌苑'],
    },
    {
      name: 'トイレマネージャー', bg: '#E8F8F5', fg: '#0E5C48',
      days: [false, false, false, false, true, true, true, false],
      members: ['中道 大雅'],
    },
  ];

  let row = 4;
  let no  = 1;
  const ROW_A    = '#FFFFFF';
  const ROW_B    = '#F2F2FA';
  const CHECK    = '✅';
  const DAY_BG   = '#C8E6C9';
  const DAY_FG   = '#1B5E20';

  depts.forEach(dept => {
    // ── 部署ヘッダー行 ──
    sh.getRange(row, 1, 1, 13).merge()
      .setValue('■ ' + dept.name + '（' + dept.members.length + '名）');
    sh.getRange(row, 1, 1, 13)
      .setBackground(dept.bg).setFontColor(dept.fg)
      .setFontWeight('bold').setFontSize(11)
      .setHorizontalAlignment('left').setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false, '#888888', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sh.setRowHeight(row, 38);
    row++;

    // ── メンバー行 ──
    dept.members.forEach((name, i) => {
      const vals = [
        name,          // 名前
        '',            // フリガナ（フォームデータ要確認）
        dept.name,     // 決定ポジション
        dept.days[0] ? CHECK : '',
        dept.days[1] ? CHECK : '',
        dept.days[2] ? CHECK : '',
        dept.days[3] ? CHECK : '',
        dept.days[4] ? CHECK : '',
        dept.days[5] ? CHECK : '',
        dept.days[6] ? CHECK : '',
        dept.days[7] ? CHECK : '',
        '',            // 入り時刻（要個別確認）
        '',            // 帰宅時刻（要個別確認）
      ];
      sh.getRange(row, 1, 1, 13).setValues([vals]);

      // 行の基本スタイル
      sh.getRange(row, 1, 1, 13)
        .setBackground(i % 2 === 0 ? ROW_A : ROW_B)
        .setFontColor('#0D0D1A').setVerticalAlignment('middle')
        .setBorder(true, true, true, true, true, true, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID);

      // 名前を太字
      sh.getRange(row, 1).setFontWeight('bold');

      // ✅ セルに緑背景
      for (let d = 0; d < 8; d++) {
        if (dept.days[d]) {
          sh.getRange(row, 4 + d)
            .setBackground(DAY_BG).setFontColor(DAY_FG)
            .setHorizontalAlignment('center').setFontSize(11).setFontWeight('bold');
        }
      }

      sh.setRowHeight(row, 28);
      no++;
      row++;
    });
  });

  // ── 合計行 ──
  sh.getRange(row, 1, 1, 13).merge()
    .setValue('✅ ボランティア合計 ' + (no - 1) + '名 ｜ EXCLUDE: コワセ（マホ）・大野挙汰（キャンセル） ｜ 2026/06/27時点確定');
  sh.getRange(row, 1, 1, 13)
    .setBackground('#263238').setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.setRowHeight(row, 36);

  // ── フィルター（列ヘッダーから） ──
  if (row > 3) sh.getRange(3, 1, row - 3, 13).createFilter();

  Logger.log('✅ ボランティア管理シート更新完了！ ' + (no - 1) + '名 / ' + depts.length + '部署');
  SpreadsheetApp.flush();
}
