// knowledge_base シートを自動生成するスクリプト
//
// 使い方:
//   1. .env に Google API 認証情報が設定されていること
//   2. ターミナルで `node scripts/setup-knowledge-sheet.js` を実行
//   3. 出力されたシートIDを .env の KNOWLEDGE_SHEET_ID に追記
require('dotenv').config();

const { google } = require('googleapis');
const { getOAuth2Client } = require('../src/utils/google-auth');

// 0-indexed grid range のヘルパー
const range = (sheetId, r1, r2, c1, c2) => ({
  sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2,
});

const HEADER_BG = { red: 0.29, green: 0.33, blue: 0.41 }; // #4A5568
const WHITE = { red: 1, green: 1, blue: 1 };

async function main() {
  const auth = getOAuth2Client();
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. スプレッドシート作成
  console.log('knowledge_base シート作成中...');
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'knowledge_base', locale: 'ja_JP' },
      sheets: [{
        properties: {
          title: 'knowledge',
          gridProperties: { rowCount: 1000, columnCount: 8, frozenRowCount: 1 },
        },
      }],
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId;
  const sheetId = createRes.data.sheets[0].properties.sheetId;

  // 2. ヘッダー書き込み
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'knowledge!A1:H1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        'ID', 'Title', 'Content', 'Category', 'Source', 'UsedCount', 'LastUsed', 'CreatedAt'
      ]],
    },
  });

  // 3. 装飾
  console.log('装飾中...');
  const requests = [
    // ヘッダー行: 太字 + 背景色 + 白文字 + センター
    {
      repeatCell: {
        range: range(sheetId, 0, 1, 0, 8),
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            textFormat: { bold: true, foregroundColor: WHITE, fontSize: 11 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    // 列幅
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 80 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 200 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 400 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 120 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 200 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 5, endIndex: 6 }, properties: { pixelSize: 80 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 }, properties: { pixelSize: 120 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 7, endIndex: 8 }, properties: { pixelSize: 120 }, fields: 'pixelSize' } },
    // A〜D列: テキスト折り返し
    {
      repeatCell: {
        range: range(sheetId, 1, 1000, 0, 4),
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      },
    },
    // F列: 数値
    {
      repeatCell: {
        range: range(sheetId, 1, 1000, 5, 6),
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'NUMBER', pattern: '0' },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    },
    // G, H列: 日付
    {
      repeatCell: {
        range: range(sheetId, 1, 1000, 6, 8),
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  // 4. 結果出力
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  console.log('\n✅ knowledge_base シート作成完了');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`シートID: ${spreadsheetId}`);
  console.log(`URL: ${url}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n.env に以下を追加してください:');
  console.log(`KNOWLEDGE_SHEET_ID=${spreadsheetId}`);
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
