// LINE AI 秘書アプリ エントリポイント
require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');

const { handleEvent, lineConfig } = require('./src/line-handler');
const { startCronJobs } = require('./src/cron-jobs');

const app = express();

// ヘルスチェック用（Railway/Render の死活監視に使えます）
app.get('/', (_req, res) => {
  res.send('LINE AI Assistant is running.');
});

// LINE Webhook
// line.middleware は署名検証を行ってくれる（生のbodyが必要なため express.json() より前に置く）
app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
  try {
    // 全イベントを並列処理
    await Promise.all((req.body.events || []).map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error('Webhook処理エラー:', err);
    // LINE側へは200を返さないとリトライされ続けるので注意
    res.status(200).end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
  // cron 起動
  startCronJobs();
});
