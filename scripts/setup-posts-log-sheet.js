// posts_log シートを自動生成するスクリプト
//
// 使い方:
//   1. .env に Google API 認証情報が設定されていること
//   2. ターミナルで `node scripts/setup-posts-log-sheet.js` を実行
//   3. 出力されたシートIDを .env の POSTS_LOG_SHEET_ID に追記
require('dotenv').config();

const { google } = require('googleapis');
const { getOAuth2Client } = require('../src/utils/google-auth');

const range = (sheetId, r1, r2, c1, c2) => ({
  sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2,
});

const HEADER_BG = { red: 0.29, green: 0.33, blue: 0.41 };
const WHITE = { red: 1, green: 1, blue: 1 };
const ROW_COUNT = 1001; // 1ヘッダー + 1000データ行

async function main() {
  const auth = getOAuth2Client();
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('posts_log シート作成中...');
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'posts_log', locale: 'ja_JP' },
      sheets: [{
        properties: {
          title: 'posts',
          gridProperties: { rowCount: ROW_COUNT, columnCount: 14, frozenRowCount: 1 },
        },
      }],
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId;
  const sheetId = createRes.data.sheets[0].properties.sheetId;

  // ヘッダー
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'posts!A1:N1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        'ID', 'Content', 'Slot', 'Status', 'SourceKnowledgeID',
        'ProposedAt', 'PostedAt', 'ThreadsPostID',
        'Likes', 'Replies', 'Reposts', 'Views',
        'EngagementRate', 'Hit',
      ]],
    },
  });

  // M列(EngagementRate) と N列(Hit) に1000行分の数式を入れる
  const formulaRows = [];
  for (let i = 2; i <= 1001; i++) {
    formulaRows.push([
      `=IF(L${i}>0, ROUND((I${i}+J${i}+K${i})/L${i}*100, 2), 0)`,
      `=IF(M${i}>=3, "✓", "")`,
    ]);
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'posts!M2:N1001',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: formulaRows },
  });

  // 装飾
  console.log('装飾中...');
  const requests = [
    // ヘッダー行
    {
      repeatCell: {
        range: range(sheetId, 0, 1, 0, 14),
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
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 380 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 90 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 100 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 130 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 5, endIndex: 7 }, properties: { pixelSize: 130 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 7, endIndex: 8 }, properties: { pixelSize: 160 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 8, endIndex: 12 }, properties: { pixelSize: 70 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 12, endIndex: 13 }, properties: { pixelSize: 110 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 13, endIndex: 14 }, properties: { pixelSize: 50 }, fields: 'pixelSize' } },
    // B列(Content): 折り返し + 上揃え
    {
      repeatCell: {
        range: range(sheetId, 1, ROW_COUNT, 1, 2),
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      },
    },
    // C列(Slot)、D列(Status): センター
    {
      repeatCell: {
        range: range(sheetId, 1, ROW_COUNT, 2, 4),
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } },
        fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
      },
    },
    // F, G列: 日時フォーマット
    {
      repeatCell: {
        range: range(sheetId, 1, ROW_COUNT, 5, 7),
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'DATE_TIME', pattern: 'yyyy-mm-dd hh:mm' },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    // I, J, K, L列: 数値
    {
      repeatCell: {
        range: range(sheetId, 1, ROW_COUNT, 8, 12),
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'NUMBER', pattern: '#,##0' },
            horizontalAlignment: 'RIGHT',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    // M列: 数値（小数点2位）
    {
      repeatCell: {
        range: range(sheetId, 1, ROW_COUNT, 12, 13),
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'NUMBER', pattern: '0.00' },
            horizontalAlignment: 'RIGHT',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    // N列(Hit): センター
    {
      repeatCell: {
        range: range(sheetId, 1, ROW_COUNT, 13, 14),
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { bold: true, foregroundColor: { red: 0.0, green: 0.6, blue: 0.0 } },
          },
        },
        fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat)',
      },
    },
    // C列(Slot)のデータ検証ドロップダウン
    {
      setDataValidation: {
        range: range(sheetId, 1, ROW_COUNT, 2, 3),
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'morning' },
              { userEnteredValue: 'noon' },
              { userEnteredValue: 'evening' },
            ],
          },
          showCustomUi: true,
          strict: true,
        },
      },
    },
    // D列(Status)のデータ検証
    {
      setDataValidation: {
        range: range(sheetId, 1, ROW_COUNT, 3, 4),
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'proposed' },
              { userEnteredValue: 'scheduled' },
              { userEnteredValue: 'posted' },
              { userEnteredValue: 'skipped' },
            ],
          },
          showCustomUi: true,
          strict: true,
        },
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  console.log('\n✅ posts_log シート作成完了');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`シートID: ${spreadsheetId}`);
  console.log(`URL: ${url}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n.env に以下を追加してください:');
  console.log(`POSTS_LOG_SHEET_ID=${spreadsheetId}`);
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
