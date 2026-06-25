/**
 * セキュリティユーティリティ
 * - 個人情報マスキング
 * - データ参照コマンドの検出
 * - レート制限
 */

// ─── 個人情報マスキング ───────────────────────────────

const PHONE_RE = /(\b0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}\b)/g;
const EMAIL_RE = /[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/g;
const ADDR_RE  = /〒?\d{3}[-\s]?\d{4}/g; // 郵便番号

function maskPII(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(PHONE_RE, '***-****-****')
    .replace(EMAIL_RE, '****@****.***')
    .replace(ADDR_RE,  '〒***-****');
}

// ─── データ参照コマンド検出（Botでの情報取得を拒否）────

const DATA_QUERY_PATTERNS = [
  /タスク(一覧|リスト|見せて|教えて|確認して|出して)/,
  /誰が(担当|やってる|やっている|対応)/,
  /(何件|何個|いくつ)(タスク|登録)/,
  /(.+)さんの(担当|タスク|連絡先|電話)/,
  /(連絡先|電話番号|住所|メール).*(教えて|見せて)/,
  /スプレッドシート.*(見せて|教えて|URL)/,
  /登録(済み|した)タスク/,
  /全部(見せて|教えて|出して)/,
];

function isDataQuery(text) {
  if (!text) return false;
  return DATA_QUERY_PATTERNS.some(p => p.test(text));
}

// ─── レート制限（1ユーザー・1分間・10件まで）──────────

const rateLimitMap = new Map();
const RATE_LIMIT  = 10;
const RATE_WINDOW = 60_000; // 1分

function checkRateLimit(userId) {
  const now   = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;

  entry.count++;
  return true;
}

// 古いエントリを定期クリア（メモリリーク防止）
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

module.exports = { maskPII, isDataQuery, checkRateLimit };
