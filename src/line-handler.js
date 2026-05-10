// LINE Messaging API のイベントハンドラ
const line = require('@line/bot-sdk');
const { chat } = require('./claude');
const {
  selectProposalRaw,
  generateProposalsRaw,
} = require('./tools/threads-post');
const { buildProposalsMessage, slotLabel } = require('./flex-templates');

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
  // postback（Flex Messageのボタン押下）
  if (event.type === 'postback') {
    return await handlePostback(event);
  }

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
 * postback イベント処理
 *  data 例:
 *    "select:POST007"     → その案を採用
 *    "regenerate:morning" → 別案を再生成
 *    "skip:morning"       → スロットスキップ
 */
async function handlePostback(event) {
  const data = (event.postback && event.postback.data) || '';
  console.log(`[LINE postback] ${data}`);

  try {
    if (data.startsWith('select:')) {
      const postId = data.slice('select:'.length);
      const message = await selectProposalRaw(postId);
      await lineClient.replyMessage(event.replyToken, { type: 'text', text: message });
      return;
    }

    if (data.startsWith('regenerate:')) {
      const slot = data.slice('regenerate:'.length) || 'morning';
      // ack的に先に短いメッセージ
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: '別案つくるで。ちょい待ち...',
      });
      // 生成→pushで送る
      const result = await generateProposalsRaw(slot);
      if (result.proposals && result.proposals.length > 0) {
        await lineClient.pushMessage(
          event.source.userId,
          buildProposalsMessage(result.proposals, slot),
        );
      } else {
        await lineClient.pushMessage(event.source.userId, {
          type: 'text', text: '案を生成できんかったわ。知識ベース確認して。',
        });
      }
      return;
    }

    if (data.startsWith('skip:')) {
      const slot = data.slice('skip:'.length);
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: `${slotLabel(slot)}はスキップやな。次に期待やで。`,
      });
      return;
    }

    // 未知の postback
    await lineClient.replyMessage(event.replyToken, {
      type: 'text', text: '不明なアクションやで',
    });
  } catch (err) {
    console.error('postback処理エラー:', err);
    try {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: `${ERROR_MESSAGE}（${err.message || err}）`,
      });
    } catch (_e) { /* replyToken切れの場合などは無視 */ }
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
  handlePostback,
  pushToUser,
  lineConfig,
  lineClient,
};
