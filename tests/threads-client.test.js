// threads-client のフォールバックモード動作確認
const { test } = require('node:test');
const assert = require('node:assert');

// 環境変数をテスト用にセット（モジュール読み込み前）
const ORIGINAL_ENV = { ...process.env };

test('THREADS_FALLBACK_MODE=true なら fallback で返る', async () => {
  process.env.THREADS_FALLBACK_MODE = 'true';
  delete process.env.THREADS_USER_ID;
  delete process.env.THREADS_ACCESS_TOKEN;

  // require.cache をクリアして再読み込み
  const mod = require('../src/threads-client');
  assert.strictEqual(mod.isFallbackMode(), true);

  const result = await mod.postToThreads('テスト投稿');
  assert.strictEqual(result.mode, 'fallback');
  assert.strictEqual(result.text, 'テスト投稿');
  assert.match(result.message, /コピー/);

  // 環境変数を元に戻す
  process.env = { ...ORIGINAL_ENV };
});

test('THREADS_USER_ID/TOKEN 未設定 → 強制 fallback', async () => {
  process.env.THREADS_FALLBACK_MODE = 'false';
  delete process.env.THREADS_USER_ID;
  delete process.env.THREADS_ACCESS_TOKEN;

  // モジュールキャッシュをクリア
  delete require.cache[require.resolve('../src/threads-client')];
  const mod = require('../src/threads-client');
  assert.strictEqual(mod.isFallbackMode(), true);

  process.env = { ...ORIGINAL_ENV };
});
