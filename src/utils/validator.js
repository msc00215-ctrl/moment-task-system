/**
 * 入力検証ユーティリティ
 * 不完全な LINE 入力 / OpenAI レスポンスをここで吸収する。
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * LINE Webhook イベントから安全にテキストメッセージを取り出す
 * @returns {{ text: string, replyToken: string, userId: string } | null}
 */
function extractTextEvent(event) {
  if (!event || event.type !== 'message') return null;
  if (!event.message || event.message.type !== 'text') return null;
  const text = (event.message.text || '').trim();
  const replyToken = event.replyToken;
  const userId = event.source?.userId;
  if (!text || !replyToken) return null;
  return { text, replyToken, userId };
}

/**
 * OpenAI が返したオブジェクトを正規化する。
 * - 想定外の型 / 欠損は null に置換 (例外は投げない → 部分情報でも登録できる)
 */
function normalizeExtractedTask(raw) {
  if (!raw || typeof raw !== 'object') {
    return { task: null, assignee: null, department: null, deadline: null, area: null, priority: '中', status: '未着手' };
  }
  return {
    task:       typeof raw.task       === 'string' && raw.task.trim()       ? raw.task.trim()       : null,
    assignee:   typeof raw.assignee   === 'string' && raw.assignee.trim()   ? raw.assignee.trim()   : null,
    department: typeof raw.department === 'string' && raw.department.trim() ? raw.department.trim() : null,
    deadline:   ISO_DATE.test(raw.deadline)                                  ? raw.deadline          : null,
    area:       typeof raw.area       === 'string' && raw.area.trim()       ? raw.area.trim()       : null,
    priority:   typeof raw.priority   === 'string' && raw.priority.trim()   ? raw.priority.trim()   : '中',
    status:     typeof raw.status     === 'string' && raw.status.trim()     ? raw.status.trim()     : '未着手',
  };
}

/**
 * task が抽出できたかの最低要件チェック。
 * task 文字列がなければ登録不可。
 */
function isTaskRegisterable(extracted) {
  return !!(extracted && extracted.task);
}

module.exports = { extractTextEvent, normalizeExtractedTask, isTaskRegisterable };
