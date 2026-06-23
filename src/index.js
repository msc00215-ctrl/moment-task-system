/**
 * Express サーバー（Render 用エントリーポイント）
 * rawBody を req.rawBody に保存して LINE 署名検証に使う
 */
const express = require('express');
const { handleWebhook } = require('./handlers/lineWebhook');
const { logger } = require('./utils/logger');

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.get('/health', (_req, res) => res.send('OK'));

app.post('/webhook', async (req, res) => {
  const startedAt = Date.now();
  try {
    await handleWebhook(req, res);
  } catch (error) {
    logger.error({ err: error.message }, '想定外の Webhook エラー');
    if (!res.headersSent) res.status(200).send('OK');
  } finally {
    logger.info({ durationMs: Date.now() - startedAt }, 'Webhook 処理完了');
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => logger.info({ port: PORT }, 'MOMENT LINE Bot 起動'));
