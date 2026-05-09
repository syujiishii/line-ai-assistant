// 請求書作成ツール（プロ仕様テンプレート対応版）
// テンプレートをコピー → 各セルに値を書き込み → PDFリンクを返す
const { google } = require('googleapis');
const dayjs = require('dayjs');
const { getOAuth2Client } = require('../utils/google-auth');

/**
 * 請求書を作成して、PDFのリンクを返す
 *
 * テンプレートのセル配置（setup-invoice-template.js が生成するレイアウト）:
 *   A3       : 請求先名（ + " 御中"） ※A3:B5 結合
 *   E3       : 請求No.
 *   E4       : 請求日
 *   B7       : 件名
 *   B8       : 支払期限
 *   A16-F16  : 明細1行目（引取日 / 摘要 / 数量 / 単位 / 単価 / 金額）
 *   C12      : ご請求金額（合計税込）※C12:F13 結合
 *   F27      : 小計
 *   F28      : 消費税
 *   F29      : 合計
 *
 * @param {string} clientName 請求先名（例: いしい）
 * @param {string} subject    件名
 * @param {number} amount     金額（円、税込総額）
 * @param {string} issueDate  発行日（YYYY-MM-DD）省略時は今日
 */
async function createInvoice(clientName, subject, amount, issueDate) {
  const auth = getOAuth2Client();
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  const dateStr = issueDate || dayjs().format('YYYY-MM-DD');
  const newTitle = `請求書_${clientName}_${dateStr}`;

  // 金額計算（amount は税込総額として扱う）
  const total = Math.floor(Number(amount));
  const subtotal = Math.floor(total / 1.1); // 税抜
  const tax = total - subtotal;             // 消費税

  // 請求番号（発行日YYYYMMDD-001 形式）
  const invoiceNo = dayjs(dateStr).format('YYYYMMDD') + '-001';

  // 支払期限（発行日から30日後）
  const dueDate = dayjs(dateStr).add(30, 'day').format('YYYY-MM-DD');

  // 1. テンプレートをコピー
  const copyRes = await drive.files.copy({
    fileId: process.env.INVOICE_TEMPLATE_SHEET_ID,
    requestBody: {
      name: newTitle,
      ...(process.env.INVOICE_DRIVE_FOLDER_ID
        ? { parents: [process.env.INVOICE_DRIVE_FOLDER_ID] }
        : {}),
    },
  });
  const newSheetId = copyRes.data.id;

  // 2. 各セルに値を書き込み
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: newSheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        // 上部: 請求先 / 請求No. / 請求日
        { range: '請求書!A3', values: [[`${clientName} 御中`]] },
        { range: '請求書!E3', values: [[invoiceNo]] },
        { range: '請求書!E4', values: [[dateStr]] },

        // 件名 / 支払期限
        { range: '請求書!B7', values: [[subject]] },
        { range: '請求書!B8', values: [[dueDate]] },

        // ご請求金額（税込合計）
        { range: '請求書!C12', values: [[total]] },

        // 明細1行目
        { range: '請求書!A16', values: [[dateStr]] },
        { range: '請求書!B16', values: [[subject]] },
        { range: '請求書!C16', values: [[1]] },
        { range: '請求書!D16', values: [['件']] },
        { range: '請求書!E16', values: [[subtotal]] },
        { range: '請求書!F16', values: [[subtotal]] },

        // 合計欄
        { range: '請求書!F27', values: [[subtotal]] },
        { range: '請求書!F28', values: [[tax]] },
        { range: '請求書!F29', values: [[total]] },
      ],
    },
  });

  // 3. リンクで誰でも閲覧できるように共有
  await drive.permissions.create({
    fileId: newSheetId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  // 4. PDFエクスポートURL（A4縦・余白小・グリッド非表示）
  const pdfUrl =
    `https://docs.google.com/spreadsheets/d/${newSheetId}/export?format=pdf` +
    `&portrait=true&size=A4&fitw=true` +
    `&gridlines=false&printtitle=false&sheetnames=false` +
    `&top_margin=0.4&bottom_margin=0.4&left_margin=0.5&right_margin=0.5` +
    `&range=A1:F33`;

  return `請求書を作成しました 📄\n` +
    `請求先: ${clientName} 様\n` +
    `件名: ${subject}\n` +
    `金額: ¥${total.toLocaleString()}（税込）\n` +
    `発行日: ${dateStr}\n` +
    `支払期限: ${dueDate}\n\n` +
    `▼ PDFダウンロード\n${pdfUrl}`;
}

module.exports = { createInvoice };
