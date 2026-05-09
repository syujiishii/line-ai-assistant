// LINE Messaging API のイベントハンドラ
const line = require('@line/bot-sdk');
const { chat } = require('./claude');

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const lineClient = new line.Client(lineConfig);

const ERROR_MESSAGE = 'エラーが発生しました。もう一度お試しください';

/**
 * LINE Webhookイベントを処理する
 */
async function handleEvent(event) {
  // テキストメッセージ以外（スタンプ、画像など）は無視
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const userMessage = event.message.text;
  const userId = event.source.userId;
  console.log(`[LINE] from ${userId}: ${userMessage}`);

  let replyText;
  try {
    replyText = await chat(userMessage);
  } catch (err) {
    console.error('Claude処理エラー:', err);
    replyText = ERROR_MESSAGE;
  }

  // LINEの1メッセージ上限は5000文字。念のため切り詰め
  if (replyText.length > 4900) {
    replyText = replyText.slice(0, 4900) + '\n…(省略)';
  }

  try {
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: replyText,
    });
  } catch (err) {
    console.error('LINE返信エラー:', err);
  }
}

/**
 * 指定ユーザーへ能動的にメッセージを送る（cron通知などで使用）
 */
async function pushToUser(userId, text) {
  if (!userId) {
    console.warn('LINE_USER_ID が未設定のためプッシュ通知をスキップしました');
    return;
  }
  try {
    await lineClient.pushMessage(userId, { type: 'text', text });
  } catch (err) {
    console.error('LINE pushエラー:', err);
  }
}

module.exports = {
  handleEvent,
  pushToUser,
  lineConfig,
};
