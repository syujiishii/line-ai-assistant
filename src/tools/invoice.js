// 請求書作成ツール
// 流れ: テンプレートSheetをコピー → 必要事項を書き込み → PDFエクスポートURLを発行
const { google } = require('googleapis');
const dayjs = require('dayjs');
const { getOAuth2Client } = require('../utils/google-auth');

/**
 * 請求書を作成して、PDFのリンクを返す
 *
 * テンプレートシートのレイアウト想定:
 *   B2: 請求先名（会社名）
 *   B3: 件名
 *   B4: 金額
 *   B5: 発行日
 *
 * @param {string} clientName 請求先名
 * @param {string} subject    件名
 * @param {number} amount     金額（円）
 * @param {string} issueDate  発行日（YYYY-MM-DD）省略時は今日
 */
async function createInvoice(clientName, subject, amount, issueDate) {
  const auth = getOAuth2Client();
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  const dateStr = issueDate || dayjs().format('YYYY-MM-DD');
  const newTitle = `請求書_${clientName}_${dateStr}`;

  // 1. テンプレートをコピー
  const copyRes = await drive.files.copy({
    fileId: process.env.INVOICE_TEMPLATE_SHEET_ID,
    requestBody: {
      name: newTitle,
      // フォルダ指定があれば移動先を指定
      ...(process.env.INVOICE_DRIVE_FOLDER_ID
        ? { parents: [process.env.INVOICE_DRIVE_FOLDER_ID] }
        : {}),
    },
  });
  const newSheetId = copyRes.data.id;

  // 2. 内容を書き込み（B2〜B5）
  await sheets.spreadsheets.values.update({
    spreadsheetId: newSheetId,
    range: 'B2:B5',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        [clientName],
        [subject],
        [amount],
        [dateStr],
      ],
    },
  });

  // 3. 誰でもリンクで閲覧できるように共有設定（任意）
  //    LINEから開けるようにするためのもの。社外秘にしたい場合はこのブロックを削除してください
  await drive.permissions.create({
    fileId: newSheetId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  // 4. PDFエクスポートURLを生成
  // Google Drive の export エンドポイントで PDF として取得可能
  const pdfUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}/export?format=pdf&portrait=true`;

  return `請求書を作成しました。\n請求先: ${clientName}\n件名: ${subject}\n金額: ¥${Number(amount).toLocaleString()}\n発行日: ${dateStr}\n\nPDFダウンロード:\n${pdfUrl}`;
}

module.exports = { createInvoice };
