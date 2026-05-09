// 既存の請求書テンプレートに対して、B7:B9 の値セルを左寄せにするパッチ
// （件名・支払期限・振込先 の値が日付や数値として右寄せされるのを防ぐ）
require('dotenv').config();

const { google } = require('googleapis');
const { getOAuth2Client } = require('./src/utils/google-auth');

async function main() {
  const auth = getOAuth2Client();
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheetId = process.env.INVOICE_TEMPLATE_SHEET_ID;
  console.log(`対象テンプレート: ${spreadsheetId}`);

  // シートIDを取得（請求書という名前のシート）
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets.find((s) => s.properties.title === '請求書');
  if (!sheet) throw new Error('「請求書」シートが見つかりません');
  const sheetId = sheet.properties.sheetId;

  // B7:B9 を左寄せに
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 6, endRowIndex: 9,  // 0-indexed: 7行目〜9行目
              startColumnIndex: 1, endColumnIndex: 3, // B〜C列
            },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: 'LEFT',
                verticalAlignment: 'MIDDLE',
                textFormat: { fontSize: 11 },
                padding: { left: 8, right: 8, top: 0, bottom: 0 },
              },
            },
            fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat,padding)',
          },
        },
      ],
    },
  });

  console.log('✅ パッチ適用完了！B7〜B9 が左寄せになりました');
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
