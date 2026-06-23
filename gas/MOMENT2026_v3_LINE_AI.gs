/**
 * MOMENT 2026 v3 — LINE AI解析モジュール
 * ================================================
 * このファイルを v2 と同じ GAS プロジェクトに追加してください。
 * v2 の parseLINEText() は使用しなくなります（削除しなくてもOK、onOpen で新関数を呼ぶため）。
 *
 * 【セットアップ】
 * 1. GASエディタ上部メニュー「プロジェクトの設定」→「スクリプトプロパティ」
 * 2. プロパティ名: OPENAI_API_KEY  /  値: sk-xxxx...
 * または シート上メニュー「🎵 MOMENT管理」→「⚙️ OpenAI APIキー設定」で入力
 * ================================================
 */

// ══════════════════════════════════════════════════
// MOMENT 2026 コンテキスト付き システムプロンプト
// ══════════════════════════════════════════════════
const MOMENT_SYSTEM_PROMPT = `あなたはMOMENT 2026の運営タスク管理AIです。
LINEグループのトーク履歴を分析し、タスク・MTG・重要情報を正確に抽出してください。

【イベント基本情報】
イベント名: MOMENT 2026
開催日: 2026年7月3日(土)〜5日(月)
会場: 洞川キャンプ場（天川村・奈良）
設営: 6/30〜7/2、撤収: 7/6〜7/7

【スタッフ一覧（表示名 → 部署）】
HI-C → 全体（主催）
妹尾 真行 → 全体（共同主催・総合統括）
YMT / ヤマト → 出店管理
石田翔馬 → 運営本部（統括マネージャー）
masato morokuma / 諸隈 → 運営本部
武藤剛亘 → 運営本部
＆you⭐︎ → エントランス（統括）
kazuha tanaka → エントランス
Shusui Tanaka / 秋水 → エントランス（荷物検査）
Hide → 場外P
YUTO → 警備
青木 陽平 → 警備（全日本警備保障）
南城 祐介 → ボランティア
KEITA → ボランティア
Joshua SW / ジョシュア → 舞台監督
ルウジ → 舞台監督（サポート）
yusuke ono / yusukeくん / レオ → 音響（メインPA）
kan2 → 音響（バーフロア）
Kunihiko Harada / 原田 → 電源（統括）
たなのりくん → 電源（Very）
yoshinobu nakamura / 中村 → 電源（Very）
後藤電機 → 街灯
Shu YAMAWAKI / 山脇 → 演出（レーザー・照明）
Haruki Moriguchi / モリグチ → 演出（VJ）
oleoreo / オレオ → ステージ（デコレーション）
岩城真人 → ステージ（ストレッチテント）
hajime / 忍 → 設営（統括・Shinovi Creation）
🌞Hiroto Arai / ヒロト → バー（マネージャー）
田岡太一 → バー
yu1 → バー
MARIA / マリア → 広報・アーティストケア
Momoko / ももこ → 広報
ʚ愛ɞ → 物販
akinoko → キッズ
中道大雅 / タイガ → 清掃
正弥 / マサヤ / はっしゃん → 食堂
ナカムラ ダイスケ / だいすけ → 食堂
Yuto Saruwatari → シャトルバス
takashi hamada → カメラ
Maya Saito / マヤ → カメラ
Kenta Ikegami → カメラ

【タスク種別の定義】
タスク: 誰かへの依頼・確認・作業指示（「〜してください」「〜お願い」「〜確認して」「〜やっといて」「〜発注して」「〜作って」）
MTG: ミーティング・打ち合わせ・オンライン会議の設定・案内
情報共有: 重要な情報・決定事項・注意喚起（タスクではないが記録価値あり）

【優先度の判断基準】
高: 本番に直接影響・期限が直近（1週間以内）・未解決だと他作業がブロックされる
中: 重要だが2週間程度の余裕がある・他作業への影響が限定的
低: あると良い・余裕があればやる・情報共有系

【ステータスの判断】
完了: 「完了しました」「〜しました」「〜済み」「OKもらった」「了解です」など完了報告が返ってきている
対応中: 「確認中」「調整中」「今やってます」「準備中」など作業中を示す言葉
予定: 具体的な日時が確定して未実施
調整中: 日程・条件が決まっていない段階
未着手: 新規依頼でまだ反応がない

【抽出ルール（厳守）】
1. 同じ内容の重複依頼は最新の1件にまとめる
2. 挨拶・スタンプ・「了解」「ありがとう」だけのメッセージは無視
3. 担当者が明示されていない場合はメッセージ送信者を担当者とする
4. @メンションがある場合はメンションされた人を担当者とする
5. スタッフ一覧の「表示名」に一番近い表記に名前を揃える（例: "ヒロトさん" → "🌞Hiroto Arai"）
6. タスク内容は「何を・誰が・どうする」が分かるよう具体的に記述する
7. 複数タスクが1メッセージに含まれる場合は個別に分けて抽出する

【出力形式 — JSONのみ、説明文・前置き・コードブロック絶対禁止】
{"tasks":[{"type":"タスク|MTG|情報共有","assignee":"担当者名","department":"部署名","content":"具体的なタスク内容","deadline":"YYYY/MM/DD or null","priority":"高|中|低","status":"未着手|対応中|完了|予定|調整中","note":"補足情報（不要なら空文字）"}]}`;

// ══════════════════════════════════════════════════
// OpenAI API 呼び出しヘルパー
// ══════════════════════════════════════════════════
function callOpenAI_(userText) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OpenAI APIキーが未設定です。\nメニュー「🎵 MOMENT管理」→「⚙️ OpenAI APIキー設定」で入力してください。');
  }

  const payload = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: MOMENT_SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 2000,
  });

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    payload: payload,
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('OpenAI APIエラー (HTTP ' + code + '): ' + response.getContentText());
  }

  const body = JSON.parse(response.getContentText());
  const content = body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  if (!content) throw new Error('OpenAI の応答が空でした。');

  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error('OpenAI の応答が JSON ではありません: ' + content.substring(0, 200));
  }
}

// ══════════════════════════════════════════════════
// LINE .txt エクスポートを構造化メッセージ配列に変換
// ══════════════════════════════════════════════════
function parseLINETxtToMessages_(rawText) {
  const lines = rawText.split('\n');
  const messages = [];
  let currentDate = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('[LINE]') || trimmed.startsWith('保存日時') || trimmed.startsWith('LINE')) continue;

    // 日付行: "2026.06.18(木)"
    const dateMatch = trimmed.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    if (dateMatch) {
      currentDate = dateMatch[1] + '/' + dateMatch[2] + '/' + dateMatch[3];
      continue;
    }

    // タブ区切り形式: "14:30\t送信者\tメッセージ"
    const tabParts = line.split('\t');
    if (tabParts.length >= 3 && /^\d{2}:\d{2}$/.test(tabParts[0].trim())) {
      const msg = tabParts.slice(2).join('\t').trim();
      if (msg && msg !== '（写真）' && msg !== '（スタンプ）' && msg !== '（動画）' && msg !== '（ファイル）') {
        messages.push({
          date: currentDate,
          time: tabParts[0].trim(),
          sender: tabParts[1].trim(),
          message: msg,
        });
      }
      continue;
    }

    // スペース区切り形式: "14:30  送信者  メッセージ"
    const spaceMatch = trimmed.match(/^(\d{2}:\d{2})\s{2,}(.+?)\s{2,}(.+)/);
    if (spaceMatch) {
      const msg = spaceMatch[3].trim();
      if (msg && msg !== '（写真）' && msg !== '（スタンプ）') {
        messages.push({
          date: currentDate,
          time: spaceMatch[1],
          sender: spaceMatch[2].trim(),
          message: msg,
        });
      }
    }
  }

  return messages;
}

// ══════════════════════════════════════════════════
// AI駆動 LINE解析（メインエントリー）
// ══════════════════════════════════════════════════
function parseLINEWithAI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lineSheet = ss.getSheetByName('📱 LINE取込');
  if (!lineSheet) {
    SpreadsheetApp.getUi().alert('「📱 LINE取込」シートが見つかりません。');
    return;
  }

  const rawText = lineSheet.getRange('A11').getValue().toString();
  const groupName = lineSheet.getRange('B52').getValue().toString() || '不明';

  if (!rawText || rawText.includes('ここをクリック') || rawText.trim() === '') {
    SpreadsheetApp.getUi().alert('LINEトークを A11 セルに貼り付けてください。\nまたはメニューから「DriveファイルからインポートQQ」を使ってください。');
    return;
  }

  const messages = parseLINETxtToMessages_(rawText);
  if (messages.length === 0) {
    SpreadsheetApp.getUi().alert(
      'メッセージを解析できませんでした。\n\n' +
      '【確認事項】\n' +
      '・LINEアプリ → グループ → ☰ → トーク履歴をバックアップ\n' +
      '・PCでtxtファイルを開き Ctrl+A → Ctrl+C でコピー\n' +
      '・直接アプリからコピーではなく、必ずtxtファイル経由で'
    );
    return;
  }

  // バッチ処理（30件ずつ OpenAI に送る）
  const BATCH_SIZE = 30;
  const allTasks = [];
  const totalBatches = Math.ceil(messages.length / BATCH_SIZE);

  SpreadsheetApp.getUi().alert(
    '🤖 AI解析を開始します\n\n' +
    'グループ: ' + groupName + '\n' +
    'メッセージ数: ' + messages.length + '件\n' +
    'バッチ数: ' + totalBatches + '回（各バッチ数秒かかります）\n\n' +
    'OKを押すと開始します。'
  );

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const batchText = batch
      .map(m => '[' + m.date + ' ' + m.time + '] ' + m.sender + ': ' + m.message)
      .join('\n');

    try {
      const result = callOpenAI_(
        'グループ名: ' + groupName + '\n\n以下のLINEトーク履歴からタスク・MTG・重要情報を抽出してください:\n\n' + batchText
      );
      if (result.tasks && Array.isArray(result.tasks)) {
        allTasks.push(...result.tasks);
      }
    } catch (err) {
      SpreadsheetApp.getUi().alert('バッチ ' + (Math.floor(i / BATCH_SIZE) + 1) + '/' + totalBatches + ' でエラー:\n' + err.message);
      return;
    }

    if (i + BATCH_SIZE < messages.length) Utilities.sleep(1200);
  }

  if (allTasks.length === 0) {
    SpreadsheetApp.getUi().alert('タスク・MTG候補が検出されませんでした。\nトーク内容にタスク性のある発言が含まれているか確認してください。');
    return;
  }

  // 解析結果をシートに書き込む
  const C_LOCAL = typeof C !== 'undefined' ? C : { STATUS: {}, PRIORITY: {} };
  const startRow = 55;
  const headerRow = 54;

  const headers = ['種別', '担当者', '部署', 'タスク内容', '期日', '優先度', '状態', 'メモ', '元グループ', '✓取込'];
  lineSheet.getRange(headerRow, 1, 1, headers.length).setValues([headers])
    .setBackground('#1976d2').setFontColor('#ffffff').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  lineSheet.setRowHeight(headerRow, 28);

  // 既存データをクリア
  const existingRows = lineSheet.getLastRow() - startRow + 1;
  if (existingRows > 0) {
    lineSheet.getRange(startRow, 1, existingRows, headers.length).clearContent().clearFormat();
  }

  const typeColors = { 'タスク': '#fff9c4', 'MTG': '#e3f2fd', '情報共有': '#e8f5e9' };
  const statusBg = { '対応中': '#fff9c4', '完了': '#c8e6c9', '未着手': '#ffcdd2', '待機中': '#e3f2fd', '保留': '#ede7f6', '予定': '#e0f7fa', '調整中': '#fff3e0' };
  const priorityBg = { '高': '#ef5350', '中': '#ffa726', '低': '#66bb6a' };

  allTasks.forEach((t, i) => {
    const r = startRow + i;
    lineSheet.setRowHeight(r, 26);
    const row = [
      t.type || 'タスク',
      t.assignee || '',
      t.department || '',
      t.content || '',
      t.deadline || '',
      t.priority || '中',
      t.status || '未着手',
      t.note || '',
      groupName,
      '',
    ];
    lineSheet.getRange(r, 1, 1, row.length).setValues([row]);
    lineSheet.getRange(r, 1, 1, row.length).setBackground(typeColors[row[0]] || '#ffffff');
    lineSheet.getRange(r, 6).setBackground(priorityBg[row[5]] || '#ffa726').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    lineSheet.getRange(r, 7).setBackground(statusBg[row[6]] || '#ffffff').setHorizontalAlignment('center');
  });

  lineSheet.getRange(headerRow, 1, 1 + allTasks.length, headers.length).setBorder(true, true, true, true, true, true);

  const taskCount = allTasks.filter(t => t.type === 'タスク').length;
  const mtgCount = allTasks.filter(t => t.type === 'MTG').length;
  const infoCount = allTasks.filter(t => t.type === '情報共有').length;

  SpreadsheetApp.getUi().alert(
    '✅ AI解析完了！\n\n' +
    'グループ: ' + groupName + '\n' +
    'メッセージ: ' + messages.length + '件 → タスク抽出: ' + allTasks.length + '件\n' +
    '  📋 タスク: ' + taskCount + '件\n' +
    '  📅 MTG: ' + mtgCount + '件\n' +
    '  ℹ️ 情報共有: ' + infoCount + '件\n\n' +
    '行' + startRow + '以下の結果を確認し、J列（✓取込）に ✓ を入力した行が\n' +
    '「📋 全タスクへ一括取込」で全タスクシートに追加されます。'
  );
}

// ══════════════════════════════════════════════════
// Drive URL からLINE .txtを直接インポート
// ══════════════════════════════════════════════════
function importFromDriveUrl() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lineSheet = ss.getSheetByName('📱 LINE取込');
  if (!lineSheet) return;

  // B9 セルの値を先に見る
  let fileUrl = lineSheet.getRange('B9').getValue().toString().trim();

  if (!fileUrl) {
    const ui = SpreadsheetApp.getUi();
    const result = ui.prompt(
      '📁 DriveファイルURL',
      'LINE exportの .txt ファイルの Google Drive URL を入力:',
      ui.ButtonSet.OK_CANCEL
    );
    if (result.getSelectedButton() !== ui.Button.OK) return;
    fileUrl = result.getResponseText().trim();
  }

  if (!fileUrl) return;

  // URL から ファイルID を抽出
  const idMatch = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) {
    SpreadsheetApp.getUi().alert(
      'Google Drive の共有URLを入力してください。\n例: https://drive.google.com/file/d/xxxxxxxxxxxxxxxx/view'
    );
    return;
  }

  try {
    const file = DriveApp.getFileById(idMatch[1]);
    const content = file.getBlob().getDataAsString('UTF-8');

    // 貼り付けエリアに展開
    lineSheet.getRange('A11').setValue(content);

    // グループ名をファイル名から推定（「LINE_グループ名_日付.txt」形式を想定）
    const guessedGroup = file.getName()
      .replace(/\.txt$/i, '')
      .replace(/^LINE_?/i, '')
      .replace(/_\d{8}.*$/, '')
      .trim();
    if (guessedGroup) lineSheet.getRange('B52').setValue(guessedGroup);

    SpreadsheetApp.getUi().alert('✅ 「' + file.getName() + '」を読み込みました。\nAI解析を開始します。');
    parseLINEWithAI();

  } catch (e) {
    SpreadsheetApp.getUi().alert(
      'ファイルの読み込みに失敗しました。\n\n' +
      '・Driveファイルの共有設定を「リンクを知っている全員」にしてください\n' +
      '・またはこのGoogleアカウントのDriveにファイルがあることを確認してください\n\n' +
      'エラー詳細: ' + e.message
    );
  }
}

// ══════════════════════════════════════════════════
// 確認済み行を 全タスクシートへ一括取込
// ══════════════════════════════════════════════════
function bulkImportTasks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lineSheet = ss.getSheetByName('📱 LINE取込');
  const taskSheet = ss.getSheetByName('📋 全タスク');
  if (!lineSheet || !taskSheet) return;

  const lastRow = lineSheet.getLastRow();
  if (lastRow < 55) {
    SpreadsheetApp.getUi().alert('解析結果がありません。先に「LINE解析実行（AI）」を実行してください。');
    return;
  }

  const data = lineSheet.getRange(55, 1, lastRow - 54, 10).getValues();
  // J列（index 9）に ✓ / yes / true / 1 が入っている行を対象
  const toImport = data.filter(row => {
    const check = String(row[9]).trim().toLowerCase();
    return check === '✓' || check === 'yes' || check === '○' || check === '1' || check === 'true';
  });

  if (toImport.length === 0) {
    SpreadsheetApp.getUi().alert('取込対象がありません。\nJ列（✓取込）に ✓ を入力した行が取込対象になります。');
    return;
  }

  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  const statusBg = { '対応中': '#fff9c4', '完了': '#c8e6c9', '未着手': '#ffcdd2', '待機中': '#e3f2fd', '保留': '#ede7f6', '予定': '#e0f7fa', '調整中': '#fff3e0' };
  const priorityBg = { '高': '#ef5350', '中': '#ffa726', '低': '#66bb6a' };
  const deptBg = typeof C !== 'undefined' ? C.DEPT : {};

  let counter = taskSheet.getLastRow();
  toImport.forEach(row => {
    // 列順: #, 担当者, 部署, タスク内容, 状態, 優先度, 期日, 関連LINEグループ, メモ, 登録日
    taskSheet.appendRow([
      counter,
      row[1],   // 担当者
      row[2],   // 部署
      row[3],   // タスク内容
      row[6],   // 状態
      row[5],   // 優先度
      row[4],   // 期日
      row[8],   // 元グループ
      row[7],   // メモ
      today,
    ]);
    const r = taskSheet.getLastRow();
    taskSheet.getRange(r, 5).setBackground(statusBg[row[6]] || '#ffffff').setHorizontalAlignment('center');
    taskSheet.getRange(r, 6).setBackground(priorityBg[row[5]] || '#ffa726').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    taskSheet.getRange(r, 3).setBackground(deptBg[row[2]] || '#f5f5f5').setHorizontalAlignment('center');
    counter++;
  });

  SpreadsheetApp.getUi().alert('✅ ' + toImport.length + '件を「📋 全タスク」に取り込みました！');
}

// ══════════════════════════════════════════════════
// OpenAI APIキー設定ダイアログ
// ══════════════════════════════════════════════════
function setupOpenAIKey() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    '⚙️ OpenAI APIキー設定',
    'OpenAI APIキーを入力してください（sk- で始まるもの）:\n※入力値はスクリプトプロパティに安全に保存されます',
    ui.ButtonSet.OK_CANCEL
  );
  if (result.getSelectedButton() !== ui.Button.OK) return;
  const key = result.getResponseText().trim();
  if (!key.startsWith('sk-')) {
    ui.alert('APIキーは "sk-" で始まる必要があります。\nOpenAI ダッシュボードで確認してください。');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('OPENAI_API_KEY', key);
  ui.alert('✅ APIキーを保存しました！\n以後、AI解析機能が使えるようになります。');
}

// ══════════════════════════════════════════════════
// LINE取込シートのUI更新（Drive URL入力欄を追加）
// v2の setupLineImport() を置き換える場合は、この関数を
// createManagementSystem() から呼ぶよう変更してください。
// 既存シートに手動で欄を追加する場合は updateLineImportSheet() を実行。
// ══════════════════════════════════════════════════
function updateLineImportSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('📱 LINE取込');
  if (!sh) {
    SpreadsheetApp.getUi().alert('「📱 LINE取込」シートが見つかりません。');
    return;
  }

  // Drive URL 入力欄を行8〜9に挿入（既存内容を下にシフト）
  sh.insertRowsBefore(8, 3);

  sh.getRange('A8:F8').merge()
    .setValue('📁 【推奨】DriveファイルURL入力 ── LINEエクスポートの.txtファイルをDriveに置いてURLをB9に貼り付け → 「DriveからインポートQQ」')
    .setBackground('#e3f2fd').setFontColor('#0d47a1').setFontWeight('bold')
    .setFontSize(11).setHorizontalAlignment('left').setVerticalAlignment('middle');
  sh.setRowHeight(8, 30);

  sh.getRange('A9').setValue('Drive URL:')
    .setFontWeight('bold').setHorizontalAlignment('right').setVerticalAlignment('middle');
  sh.getRange('B9:F9').merge()
    .setValue('')
    .setBackground('#fffde7')
    .setBorder(true, true, true, true, false, false);
  sh.setRowHeight(9, 30);

  sh.getRange('A10:F10').merge()
    .setValue('📝 【手動】上のDrive URLを使わない場合は、下の貼り付けエリアに直接 LINEトーク（.txtの中身）を貼り付けてください')
    .setBackground('#f3e5f5').setFontSize(10).setHorizontalAlignment('center');
  sh.setRowHeight(10, 22);

  SpreadsheetApp.getUi().alert('✅ LINE取込シートにDrive URL入力欄を追加しました！');
}

// ══════════════════════════════════════════════════
// v3 カスタムメニュー（v2 の onOpen を上書き）
// ══════════════════════════════════════════════════
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎵 MOMENT管理')
    .addItem('🤖 LINE解析実行（AI）', 'parseLINEWithAI')
    .addItem('📁 DriveファイルからインポートQQ', 'importFromDriveUrl')
    .addItem('✅ 確認済みを全タスクへ一括取込', 'bulkImportTasks')
    .addSeparator()
    .addItem('🔄 ダッシュボード更新', 'refreshDashboard')
    .addItem('📊 状態サマリーを表示', 'showStatusSummary')
    .addSeparator()
    .addItem('👥 スタッフシート開く', 'openStaffSheet')
    .addItem('🍚 賄いシート開く', 'openMealSheet')
    .addSeparator()
    .addItem('🔧 LINE取込シートにDrive欄を追加', 'updateLineImportSheet')
    .addItem('⚙️ OpenAI APIキー設定', 'setupOpenAIKey')
    .addToUi();
}
