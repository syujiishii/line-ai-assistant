// YouTube URLから文字起こし（字幕）を取得するヘルパー
//
// `youtube-transcript` パッケージを利用。日本語字幕優先、なければ英語にフォールバック。
const { YoutubeTranscript } = require('youtube-transcript');

/**
 * YouTube URL/ID から動画IDを抽出
 */
function extractVideoId(input) {
  if (!input) return null;
  // 既にIDっぽい場合
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  // URLの場合
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = input.match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * URLがYouTubeか判定
 */
function isYouTubeUrl(input) {
  return extractVideoId(input) !== null;
}

/**
 * YouTube URLから文字起こし取得
 * @param {string} url
 * @returns {Promise<{ ok: true, videoId, text } | { ok: false, error, message }>}
 */
async function getTranscript(url) {
  const videoId = extractVideoId(url);
  if (!videoId) {
    return { ok: false, error: 'invalid_url', message: 'YouTube URLとして認識できませんでした' };
  }

  // 日本語→英語の順で試行
  const langOrder = ['ja', 'en'];
  let lastErr = null;

  for (const lang of langOrder) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      if (items && items.length > 0) {
        const text = items.map((it) => it.text).join(' ').replace(/\s+/g, ' ').trim();
        return { ok: true, videoId, lang, text };
      }
    } catch (err) {
      lastErr = err;
    }
  }

  // フォールバック: 言語指定なしで取得
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId);
    if (items && items.length > 0) {
      const text = items.map((it) => it.text).join(' ').replace(/\s+/g, ' ').trim();
      return { ok: true, videoId, lang: 'auto', text };
    }
  } catch (err) {
    lastErr = err;
  }

  return {
    ok: false,
    error: 'transcript_unavailable',
    message: `字幕を取得できませんでした (${lastErr ? lastErr.message : 'unknown'})`,
  };
}

module.exports = {
  extractVideoId,
  isYouTubeUrl,
  getTranscript,
};
