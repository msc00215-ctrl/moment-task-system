/**
 * 構造化ログ (Cloud Logging 互換)
 * - severity / message / 任意フィールドを JSON 出力
 * - Cloud Logging が自動で severity を解釈
 */
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level(label) {
      // Cloud Logging 互換マッピング
      const map = {
        trace: 'DEBUG',
        debug: 'DEBUG',
        info: 'INFO',
        warn: 'WARNING',
        error: 'ERROR',
        fatal: 'CRITICAL',
      };
      return { severity: map[label] || 'DEFAULT' };
    },
  },
  messageKey: 'message',
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

module.exports = { logger };
