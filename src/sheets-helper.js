// Google Sheets 共通操作ヘルパー
// knowledge_base / posts_log の操作で共通利用する関数群
const { google } = require('googleapis');
const { getOAuth2Client } = require('./utils/google-auth');

function getSheetsClient() {
  const auth = getOAuth2Client();
  return google.sheets({ version: 'v4', auth });
}

/**
 * 指定シートに新規行を追加（末尾に append）
 * @param {string} spreadsheetId
 * @param {string} sheetName    例: 'knowledge' / 'posts'
 * @param {Array<any>} values   1行分の値の配列
 */
async function appendRow(spreadsheetId, sheetName, values) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
}

/**
 * 指定範囲を上書き更新
 */
async function updateRange(spreadsheetId, range, values) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

/**
 * 指定範囲の行データ取得
 * @returns {Array<Array<any>>} 行ごとの配列
 */
async function getRows(spreadsheetId, range) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return res.data.values || [];
}

/**
 * 指定sheetNameのA列でID検索→該当行の(rowIndex, row)を返す
 * 見つからなければnull
 * rowIndexは1-indexed（実際のシート行番号）
 */
async function findRowById(spreadsheetId, sheetName, id) {
  const rows = await getRows(spreadsheetId, `${sheetName}!A:Z`);
  // ヘッダー行はスキップ。rowIndex=2から始まる
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      return { rowIndex: i + 1, row: rows[i] };
    }
  }
  return null;
}

/**
 * ID指定で特定列のセルを更新
 * @param {string} columnLetter  例: 'D' (Status列)
 */
async function updateCellByIdAndColumn(spreadsheetId, sheetName, id, columnLetter, value) {
  const found = await findRowById(spreadsheetId, sheetName, id);
  if (!found) {
    throw new Error(`ID ${id} が ${sheetName} に見つかりません`);
  }
  await updateRange(
    spreadsheetId,
    `${sheetName}!${columnLetter}${found.rowIndex}`,
    [[value]]
  );
  return found;
}

/**
 * 連番付きID生成
 * 例: prefix='KB' で既存の最大が KB007 なら → KB008
 *     既存ゼロなら → KB001
 */
async function generateNextId(spreadsheetId, sheetName, prefix) {
  const rows = await getRows(spreadsheetId, `${sheetName}!A:A`);
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const cell = rows[i][0] || '';
    const m = cell.match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  const next = (maxNum + 1).toString().padStart(3, '0');
  return `${prefix}${next}`;
}

/**
 * 列文字を数値indexに（0-indexed）
 * 'A' → 0, 'D' → 3, 'AA' → 26
 */
function columnLetterToIndex(letter) {
  let idx = 0;
  for (let i = 0; i < letter.length; i++) {
    idx = idx * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return idx - 1;
}

/**
 * 数値index→列文字
 */
function indexToColumnLetter(index) {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

module.exports = {
  appendRow,
  updateRange,
  getRows,
  findRowById,
  updateCellByIdAndColumn,
  generateNextId,
  columnLetterToIndex,
  indexToColumnLetter,
};
