// Threads Graph API ラッパー
// 本番モード: API投稿 / フォールバックモード: コピペテキスト返却
const axios = require('axios');

const GRAPH_BASE = 'https://graph.threads.net/v1.0';
const SLEEP_MS = 30 * 1000; // Meta推奨の30秒待機

function isFallbackMode() {
  if (process.env.THREADS_FALLBACK_MODE === 'true') return true;
  if (!process.env.THREADS_ACCESS_TOKEN || !process.env.THREADS_USER_ID) return true;
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Threadsへ投稿
 * @returns
 *   フォールバック: { mode: 'fallback', text, message }
 *   本番:           { mode: 'api', threadsPostId, url }
 */
async function postToThreads(text) {
  if (isFallbackMode()) {
    return {
      mode: 'fallback',
      text,
      message: 'これコピーしてThreadsに投稿してな↓',
    };
  }

  const userId = process.env.THREADS_USER_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;

  try {
    // Step 1: メディアコンテナ作成
    const containerRes = await axios.post(
      `${GRAPH_BASE}/${userId}/threads`,
      null,
      {
        params: {
          media_type: 'TEXT',
          text,
          access_token: token,
        },
      }
    );
    const creationId = containerRes.data.id;
    if (!creationId) throw new Error('container作成に失敗（idなし）');

    // Step 2: Meta推奨の30秒待機
    await sleep(SLEEP_MS);

    // Step 3: 公開
    const publishRes = await axios.post(
      `${GRAPH_BASE}/${userId}/threads_publish`,
      null,
      {
        params: {
          creation_id: creationId,
          access_token: token,
        },
      }
    );
    const threadsPostId = publishRes.data.id;
    if (!threadsPostId) throw new Error('publishレスポンスにIDなし');

    // 投稿URL（permalink取得）
    let url = '';
    try {
      const permRes = await axios.get(`${GRAPH_BASE}/${threadsPostId}`, {
        params: { fields: 'permalink', access_token: token },
      });
      url = permRes.data.permalink || '';
    } catch (_e) {
      // permalink取得失敗してもfatalではない
    }

    return { mode: 'api', threadsPostId, url };
  } catch (err) {
    const status = err.response && err.response.status;
    const msg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;

    if (status === 401) {
      throw new Error(`THREADS_ACCESS_TOKEN が無効/失効: ${msg}`);
    }
    if (status === 429) {
      throw new Error(`Threads APIレート制限: ${msg}`);
    }
    throw new Error(`Threads投稿エラー: ${msg}`);
  }
}

/**
 * 投稿のメトリクス取得
 * @returns { likes, replies, reposts, views }
 */
async function getPostMetrics(threadsPostId) {
  if (isFallbackMode()) {
    return { likes: 0, replies: 0, reposts: 0, views: 0, mode: 'fallback' };
  }

  const token = process.env.THREADS_ACCESS_TOKEN;
  try {
    const res = await axios.get(`${GRAPH_BASE}/${threadsPostId}/insights`, {
      params: {
        metric: 'likes,replies,reposts,views',
        access_token: token,
      },
    });
    const data = res.data.data || [];
    const result = { likes: 0, replies: 0, reposts: 0, views: 0 };
    for (const item of data) {
      const value = (item.values && item.values[0] && item.values[0].value) || 0;
      if (item.name === 'likes') result.likes = value;
      else if (item.name === 'replies') result.replies = value;
      else if (item.name === 'reposts') result.reposts = value;
      else if (item.name === 'views') result.views = value;
    }
    return result;
  } catch (err) {
    const status = err.response && err.response.status;
    const msg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`metrics取得失敗 (${status}): ${msg}`);
  }
}

module.exports = {
  postToThreads,
  getPostMetrics,
  isFallbackMode,
};
