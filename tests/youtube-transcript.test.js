// YouTube URL/ID 抽出ロジックの単体テスト
const { test } = require('node:test');
const assert = require('node:assert');

const { extractVideoId, isYouTubeUrl } = require('../src/youtube-transcript');

test('extractVideoId: 各種URL形式から動画ID抽出', () => {
  assert.strictEqual(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('extractVideoId: 不正な入力で null', () => {
  assert.strictEqual(extractVideoId(''), null);
  assert.strictEqual(extractVideoId('just text'), null);
  assert.strictEqual(extractVideoId('https://google.com/'), null);
  assert.strictEqual(extractVideoId(null), null);
});

test('isYouTubeUrl: 判定OK', () => {
  assert.strictEqual(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'), true);
  assert.strictEqual(isYouTubeUrl('https://example.com/'), false);
  assert.strictEqual(isYouTubeUrl(''), false);
});
