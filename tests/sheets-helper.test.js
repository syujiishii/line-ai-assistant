// sheets-helper の純粋ロジック単体テスト
// （Google API を呼ばないユーティリティ部分のみ検証）
const { test } = require('node:test');
const assert = require('node:assert');

const { columnLetterToIndex, indexToColumnLetter } = require('../src/sheets-helper');

test('columnLetterToIndex: A→0, D→3, Z→25, AA→26', () => {
  assert.strictEqual(columnLetterToIndex('A'), 0);
  assert.strictEqual(columnLetterToIndex('D'), 3);
  assert.strictEqual(columnLetterToIndex('Z'), 25);
  assert.strictEqual(columnLetterToIndex('AA'), 26);
  assert.strictEqual(columnLetterToIndex('AB'), 27);
});

test('indexToColumnLetter: 0→A, 3→D, 25→Z, 26→AA', () => {
  assert.strictEqual(indexToColumnLetter(0), 'A');
  assert.strictEqual(indexToColumnLetter(3), 'D');
  assert.strictEqual(indexToColumnLetter(25), 'Z');
  assert.strictEqual(indexToColumnLetter(26), 'AA');
  assert.strictEqual(indexToColumnLetter(27), 'AB');
});

test('round-trip: letter ↔ index', () => {
  for (const l of ['A', 'M', 'Z', 'AA', 'AZ', 'BA', 'ZZ']) {
    assert.strictEqual(indexToColumnLetter(columnLetterToIndex(l)), l);
  }
});
