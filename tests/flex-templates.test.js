// flex-templates の出力構造確認テスト
const { test } = require('node:test');
const assert = require('node:assert');

const {
  buildProposalsMessage,
  buildPostedNotification,
  buildKnowledgeSavedMessage,
  slotLabel,
} = require('../src/flex-templates');

test('buildProposalsMessage: カルーセル構造を生成', () => {
  const proposals = [
    { id: 'POST001', text: 'テスト案1', type: '体験談型' },
    { id: 'POST002', text: 'テスト案2', type: '気づき型' },
    { id: 'POST003', text: 'テスト案3', type: '問いかけ型' },
  ];
  const msg = buildProposalsMessage(proposals, 'morning');
  assert.strictEqual(msg.type, 'flex');
  assert.strictEqual(msg.contents.type, 'carousel');
  // 3案 + 再生成/スキップバブルで4個
  assert.strictEqual(msg.contents.contents.length, 4);
  // ボタンの postback data に select:POST001 が含まれる
  const firstBubble = msg.contents.contents[0];
  const btn = firstBubble.footer.contents[0];
  assert.strictEqual(btn.action.data, 'select:POST001');
});

test('buildPostedNotification: fallback と api でヘッダー違う', () => {
  const fb = buildPostedNotification({ mode: 'fallback', text: 'テスト' });
  assert.match(fb.altText, /コピペ/);
  const api = buildPostedNotification({ mode: 'api', text: 'テスト', url: 'https://threads.net/x' });
  assert.match(api.altText, /投稿完了/);
});

test('buildKnowledgeSavedMessage: タイトル含む', () => {
  const msg = buildKnowledgeSavedMessage('テスト題', '気づき', '要約文');
  assert.strictEqual(msg.type, 'flex');
  assert.match(msg.altText, /テスト題/);
});

test('slotLabel: 既知のスロット', () => {
  assert.match(slotLabel('morning'), /朝/);
  assert.match(slotLabel('noon'), /昼/);
  assert.match(slotLabel('evening'), /夕/);
});
