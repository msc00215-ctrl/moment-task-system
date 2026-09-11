/**
 * MOMENT 2026 — Gmail 請求書 → LINE グループ転送スクリプト
 *
 * セットアップ手順:
 * 1. GASエディタ → 「プロジェクトのプロパティ」→「スクリプトプロパティ」に以下を設定:
 *    ・LINE_CHANNEL_ACCESS_TOKEN  … LINEチャネルアクセストークン（既存値をコピー）
 *    ・LINE_INVOICE_GROUP_ID      … 転送先グループID（例: C1a2b3c4d5e6f7...）
 *      ※グループIDの探し方: ②スプシの「📱 LINEリアルタイム」シートの groupId 列を確認
 *
 * 2. Gmailに「LINE転送済み」ラベルが自動作成される（初回実行時）
 *
 * 3. トリガー設定:
 *    GASエディタ → トリガー → 「checkInvoiceEmails」→ 時間主導型 → 5分ごと
 *
 * 検知条件（以下いずれかを件名に含む + 添付ファイルあり + 未読）:
 *   請求書 / invoice / Invoice / 請求 / 見積書 / 見積
 */

// ─── 定数 ────────────────────────────────────────────
const INV_LINE_TOKEN   = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '';
const INV_GROUP_ID     = PropertiesService.getScriptProperties().getProperty('LINE_INVOICE_GROUP_ID')     || '';
const DONE_LABEL_NAME  = 'LINE転送済み';
const DRIVE_FOLDER_NAME = '📧 LINE転送_請求書';

// 検索クエリ（件名キーワード）
const INVOICE_QUERY = [
  'has:attachment',
  'is:unread',
  '-label:' + DONE_LABEL_NAME,
  '(subject:請求書 OR subject:invoice OR subject:Invoice',
  ' OR subject:請求 OR subject:見積書 OR subject:見積)',
].join(' ');

// ─── メイン処理 ─────────────────────────────────────
/**
 * 請求書メールをチェックして LINE に転送する
 * （time-driven トリガーで 5 分ごとに実行）
 */
function checkInvoiceEmails() {
  if (!INV_LINE_TOKEN) { Logger.log('LINE_CHANNEL_ACCESS_TOKEN 未設定'); return; }
  if (!INV_GROUP_ID)   { Logger.log('LINE_INVOICE_GROUP_ID 未設定'); return; }

  const threads = GmailApp.search(INVOICE_QUERY, 0, 20);
  if (threads.length === 0) return;

  const doneLabel = _getOrCreateLabel(DONE_LABEL_NAME);
  const folder    = _getOrCreateFolder(DRIVE_FOLDER_NAME);

  threads.forEach(thread => {
    let forwarded = false;

    thread.getMessages().forEach(msg => {
      if (!msg.isUnread()) return;

      const attachments = msg.getAttachments();
      if (attachments.length === 0) { msg.markRead(); return; }

      const sender  = msg.getFrom();
      const subject = msg.getSubject();
      const dateStr = Utilities.formatDate(msg.getDate(), 'Asia/Tokyo', 'M/d HH:mm');

      // ヘッダーテキスト
      _pushText(
        `📧 請求書が届いたで！\n` +
        `━━━━━━━━━━━━━━━\n` +
        `差出人: ${sender}\n` +
        `件名: ${subject}\n` +
        `受信: ${dateStr}`
      );

      // 添付ファイルを処理
      attachments.forEach(att => {
        const name = att.getName();
        const mime = att.getContentType();

        try {
          if (mime === 'application/pdf') {
            // PDF → Drive にアップロード → リンク送信
            const file = folder.createFile(att);
            file.setName(`[請求書] ${name}`);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            _pushText(`📄 ${name}\n${file.getUrl()}`);

          } else if (mime.startsWith('image/')) {
            // 画像 → Drive にアップロード → インライン送信
            const file = folder.createFile(att);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            const url = `https://drive.google.com/uc?export=view&id=${file.getId()}`;
            _pushImage(url);

          } else {
            // その他ファイル → リンクのみ
            const file = folder.createFile(att);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            _pushText(`📎 ${name}（${mime}）\n${file.getUrl()}`);
          }
        } catch (e) {
          Logger.log(`添付処理失敗 [${name}]: ${e.message}`);
          _pushText(`⚠️ 添付処理に失敗したで: ${name}`);
        }
      });

      msg.markRead();
      forwarded = true;
    });

    if (forwarded) thread.addLabel(doneLabel);
  });
}

// ─── LINE Push ───────────────────────────────────────
function _pushText(text) {
  _linePost({ to: INV_GROUP_ID, messages: [{ type: 'text', text }] });
}

function _pushImage(url) {
  _linePost({
    to: INV_GROUP_ID,
    messages: [{
      type: 'image',
      originalContentUrl: url,
      previewImageUrl:    url,
    }],
  });
}

function _linePost(payload) {
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method:           'POST',
    contentType:      'application/json',
    headers:          { Authorization: `Bearer ${INV_LINE_TOKEN}` },
    payload:          JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200) {
    Logger.log(`LINE Push 失敗 [${code}]: ${res.getContentText()}`);
  }
}

// ─── Drive / Label ヘルパー ──────────────────────────
function _getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function _getOrCreateFolder(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

// ─── 手動テスト用 ─────────────────────────────────────
/**
 * テスト用: GASエディタから直接実行して動作確認
 * → 実際の請求書メールがない場合はダミーテキストを送信
 */
function testSendLineMessage() {
  if (!INV_LINE_TOKEN || !INV_GROUP_ID) {
    Logger.log('スクリプトプロパティが未設定');
    return;
  }
  _pushText('✅ Gmail→LINE 転送スクリプトのテストやで！\nこのメッセージが届いてれば設定OK🎉');
}
