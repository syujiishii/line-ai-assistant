// Instagram Graph API ツール
// - 未返信コメント一覧の取得
// - コメントへの返信
const axios = require('axios');

const GRAPH_BASE = 'https://graph.facebook.com/v18.0';

/**
 * 自アカウントのメディア一覧から、未返信コメントを集めて返す
 * @param {number} limit 取得するコメントの最大件数（デフォルト10件）
 */
async function getInstagramComments(limit = 10) {
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  // 1. 最近のメディア（投稿）を取得
  const mediaRes = await axios.get(`${GRAPH_BASE}/${igUserId}/media`, {
    params: {
      fields: 'id,caption,permalink',
      limit: 10,
      access_token: accessToken,
    },
  });
  const mediaItems = mediaRes.data.data || [];

  // 2. 各メディアのコメント一覧を取得
  const allComments = [];
  for (const media of mediaItems) {
    try {
      const commentsRes = await axios.get(`${GRAPH_BASE}/${media.id}/comments`, {
        params: {
          fields: 'id,text,username,timestamp,replies{id}',
          access_token: accessToken,
        },
      });
      const comments = commentsRes.data.data || [];
      for (const c of comments) {
        // replies が空 = まだ自分が返信していない可能性が高い
        const hasReply = c.replies && c.replies.data && c.replies.data.length > 0;
        if (!hasReply) {
          allComments.push({
            comment_id: c.id,
            text: c.text,
            username: c.username,
            timestamp: c.timestamp,
            media_caption: (media.caption || '').slice(0, 50),
            permalink: media.permalink,
          });
        }
      }
    } catch (err) {
      // 個別の投稿でエラーが出ても全体は止めない
      console.error(`コメント取得エラー (media ${media.id}):`, err.message);
    }
    if (allComments.length >= limit) break;
  }

  if (allComments.length === 0) {
    return '未返信のコメントはありません。';
  }

  const sliced = allComments.slice(0, limit);
  const lines = sliced.map((c, i) => {
    return `[${i + 1}] @${c.username} (ID: ${c.comment_id})\n  投稿: ${c.media_caption}...\n  コメント: ${c.text}`;
  });

  return `未返信コメント ${sliced.length}件:\n\n${lines.join('\n\n')}`;
}

/**
 * 指定したコメントに返信を送信
 * @param {string} commentId 返信先のコメントID
 * @param {string} message   返信本文
 */
async function replyInstagramComment(commentId, message) {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const res = await axios.post(`${GRAPH_BASE}/${commentId}/replies`, null, {
    params: {
      message,
      access_token: accessToken,
    },
  });

  return `コメント (ID: ${commentId}) に返信しました。\n返信ID: ${res.data.id}\n本文: ${message}`;
}

module.exports = {
  getInstagramComments,
  replyInstagramComment,
};
