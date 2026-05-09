// 請求書テンプレートを自動生成するスクリプト（プロ仕様レイアウト）
//
// 使い方:
//   1. .env に Google API 認証情報が設定されていること
//   2. ターミナルで `node setup-invoice-template.js` を実行
//   3. 出力されたシートIDを Railway の INVOICE_TEMPLATE_SHEET_ID に設定
require('dotenv').config();

const { google } = require('googleapis');
const { getOAuth2Client } = require('./src/utils/google-auth');

// ====== ここを自分の会社情報に書き換える ======
const COMPANY_INFO = {
  name: 'まちアカ',
  postal: '〒840-0202',
  address: '佐賀県佐賀市大和町大字久池井1187-2',
  tel: 'TEL: 080-4691-8379',
  contact: '担当: 石井 柊次',
  bank: '佐賀銀行 神崎支店 普通 3120910 ｲｼｲ ｼｭｳｼﾞ',
};
// ============================================

// ヘルパー: 0-indexed の grid range
const range = (sheetId, r1, r2, c1, c2) => ({
  sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2,
});
// ヘルパー: 全方向罫線（外枠＋内側）
const allBorders = (style = 'SOLID') => ({
  top: { style }, bottom: { style }, left: { style }, right: { style },
  innerHorizontal: { style }, innerVertical: { style },
});
// ヘルパー: 外枠のみ
const outerBorders = (style = 'SOLID') => ({
  top: { style }, bottom: { style }, left: { style }, right: { style },
});

// 色定義
const GREY_LIGHT = { red: 0.95, green: 0.95, blue: 0.95 };
const GREY_LABEL = { red: 0.88, green: 0.88, blue: 0.88 };
const NAVY = { red: 0.13, green: 0.20, blue: 0.42 };
const WHITE = { red: 1, green: 1, blue: 1 };

async function main() {
  const auth = getOAuth2Client();
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. 新しいスプレッドシートを作成
  console.log('スプレッドシート作成中...');
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: '請求書テンプレート（プロ仕様）', locale: 'ja_JP' },
      sheets: [{
        properties: {
          title: '請求書',
          gridProperties: { rowCount: 40, columnCount: 6 },
        },
      }],
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId;
  const sheetId = createRes.data.sheets[0].properties.sheetId;
  console.log(`作成完了: ${spreadsheetId}`);

  // 2. 値を一括書き込み
  console.log('値を入力中...');
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        // タイトル
        { range: '請求書!A1', values: [['請　求　書']] },

        // No. / 請求日 ラベル（右側）
        { range: '請求書!D3', values: [['No.']] },
        { range: '請求書!D4', values: [['請求日']] },

        // 「下記のとおり〜」
        { range: '請求書!A6', values: [['下記のとおり、御請求申し上げます。']] },

        // 件名・支払期限・振込先 ラベル
        { range: '請求書!A7', values: [['件名']] },
        { range: '請求書!A8', values: [['支払期限']] },
        { range: '請求書!A9', values: [['振込先']] },
        { range: '請求書!B9', values: [[COMPANY_INFO.bank]] },

        // 自社情報（右側ボックス）
        { range: '請求書!D7', values: [[`${COMPANY_INFO.postal} ${COMPANY_INFO.address}`]] },
        { range: '請求書!D8', values: [[COMPANY_INFO.name]] },
        { range: '請求書!D9', values: [[COMPANY_INFO.tel]] },
        { range: '請求書!D10', values: [[COMPANY_INFO.contact]] },

        // ご請求金額 ラベル
        { range: '請求書!A12', values: [['ご請求金額']] },

        // 明細表ヘッダー
        { range: '請求書!A15:F15', values: [['引取日', '摘要', '数量', '単位', '単価', '金額']] },

        // 合計欄ラベル
        { range: '請求書!D27', values: [['小計']] },
        { range: '請求書!D28', values: [['消費税(10%)']] },
        { range: '請求書!D29', values: [['合計']] },

        // 備考
        { range: '請求書!A31', values: [['備考']] },
        { range: '請求書!A32', values: [['振込手数料はお客様の負担でお願いいたします。']] },
      ],
    },
  });

  // 3. 装飾
  console.log('装飾中（時間かかります）...');
  const requests = [];

  // === 列幅 ===
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 95 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 200 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 65 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 70 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 100 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 5, endIndex: 6 }, properties: { pixelSize: 110 }, fields: 'pixelSize' } });

  // === 行高さ ===
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 56 }, fields: 'pixelSize' } }); // タイトル
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 12 }, fields: 'pixelSize' } }); // スペース
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 2, endIndex: 5 }, properties: { pixelSize: 30 }, fields: 'pixelSize' } }); // 客先・No.
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 5, endIndex: 6 }, properties: { pixelSize: 26 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 6, endIndex: 10 }, properties: { pixelSize: 28 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 10, endIndex: 11 }, properties: { pixelSize: 16 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 11, endIndex: 13 }, properties: { pixelSize: 32 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 13, endIndex: 14 }, properties: { pixelSize: 12 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 14, endIndex: 15 }, properties: { pixelSize: 32 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 15, endIndex: 25 }, properties: { pixelSize: 26 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 25, endIndex: 26 }, properties: { pixelSize: 8 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 26, endIndex: 29 }, properties: { pixelSize: 28 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 29, endIndex: 30 }, properties: { pixelSize: 12 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 30, endIndex: 31 }, properties: { pixelSize: 28 }, fields: 'pixelSize' } });
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 31, endIndex: 33 }, properties: { pixelSize: 28 }, fields: 'pixelSize' } });

  // === タイトル A1:F1 ===
  requests.push({ mergeCells: { range: range(sheetId, 0, 1, 0, 6), mergeType: 'MERGE_ALL' } });
  requests.push({
    repeatCell: {
      range: range(sheetId, 0, 1, 0, 6),
      cell: {
        userEnteredFormat: {
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          textFormat: { fontSize: 28, bold: true, foregroundColor: NAVY },
        },
      },
      fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat)',
    },
  });

  // === 客先名ボックス A3:B5 (大きい・太枠) ===
  requests.push({ mergeCells: { range: range(sheetId, 2, 5, 0, 2), mergeType: 'MERGE_ALL' } });
  requests.push({
    repeatCell: {
      range: range(sheetId, 2, 5, 0, 2),
      cell: {
        userEnteredFormat: {
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          textFormat: { fontSize: 16, bold: true, foregroundColor: NAVY },
        },
      },
      fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat)',
    },
  });
  requests.push({ updateBorders: { range: range(sheetId, 2, 5, 0, 2), ...outerBorders('SOLID_THICK') } });

  // === No./請求日 ボックス D3:F4 ===
  // ラベル D3, D4 (グレー)
  requests.push({
    repeatCell: {
      range: range(sheetId, 2, 4, 3, 4),
      cell: {
        userEnteredFormat: {
          backgroundColor: GREY_LABEL,
          textFormat: { bold: true, foregroundColor: NAVY },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  });
  // 値 E3:F3, E4:F4
  requests.push({ mergeCells: { range: range(sheetId, 2, 3, 4, 6), mergeType: 'MERGE_ALL' } });
  requests.push({ mergeCells: { range: range(sheetId, 3, 4, 4, 6), mergeType: 'MERGE_ALL' } });
  requests.push({
    repeatCell: {
      range: range(sheetId, 2, 4, 4, 6),
      cell: {
        userEnteredFormat: {
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          textFormat: { fontSize: 11 },
        },
      },
      fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat)',
    },
  });
  requests.push({ updateBorders: { range: range(sheetId, 2, 4, 3, 6), ...allBorders('SOLID') } });

  // === A6:C6 「下記のとおり〜」 ===
  requests.push({ mergeCells: { range: range(sheetId, 5, 6, 0, 3), mergeType: 'MERGE_ALL' } });
  requests.push({
    repeatCell: {
      range: range(sheetId, 5, 6, 0, 3),
      cell: { userEnteredFormat: { textFormat: { fontSize: 11 }, verticalAlignment: 'MIDDLE' } },
      fields: 'userEnteredFormat(textFormat,verticalAlignment)',
    },
  });

  // === 件名・支払期限・振込先 ラベル A7:A9 ===
  requests.push({
    repeatCell: {
      range: range(sheetId, 6, 9, 0, 1),
      cell: {
        userEnteredFormat: {
          backgroundColor: GREY_LABEL,
          textFormat: { bold: true, foregroundColor: NAVY },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  });
  // 値セル B7:C9（結合）
  requests.push({ mergeCells: { range: range(sheetId, 6, 7, 1, 3), mergeType: 'MERGE_ALL' } });
  requests.push({ mergeCells: { range: range(sheetId, 7, 8, 1, 3), mergeType: 'MERGE_ALL' } });
  requests.push({ mergeCells: { range: range(sheetId, 8, 9, 1, 3), mergeType: 'MERGE_ALL' } });
  requests.push({
    repeatCell: {
      range: range(sheetId, 6, 9, 1, 3),
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
  });
  // 罫線 A7:C9
  requests.push({ updateBorders: { range: range(sheetId, 6, 9, 0, 3), ...allBorders('SOLID') } });

  // === 自社情報ボックス D7:F10 ===
  requests.push({ mergeCells: { range: range(sheetId, 6, 7, 3, 6), mergeType: 'MERGE_ALL' } });
  requests.push({ mergeCells: { range: range(sheetId, 7, 8, 3, 6), mergeType: 'MERGE_ALL' } });
  requests.push({ mergeCells: { range: range(sheetId, 8, 9, 3, 6), mergeType: 'MERGE_ALL' } });
  requests.push({ mergeCells: { range: range(sheetId, 9, 10, 3, 6), mergeType: 'MERGE_ALL' } });
  requests.push({
    repeatCell: {
      range: range(sheetId, 6, 10, 3, 6),
      cell: {
        userEnteredFormat: {
          verticalAlignment: 'MIDDLE',
          textFormat: { fontSize: 11 },
          padding: { left: 10, right: 8, top: 0, bottom: 0 },
        },
      },
      fields: 'userEnteredFormat(verticalAlignment,textFormat,padding)',
    },
  });
  // 会社名(D8)を太字・大きく
  requests.push({
    repeatCell: {
      range: range(sheetId, 7, 8, 3, 6),
      cell: { userEnteredFormat: { textFormat: { fontSize: 13, bold: true, foregroundColor: NAVY } } },
      fields: 'userEnteredFormat.textFormat',
    },
  });
  requests.push({ updateBorders: { range: range(sheetId, 6, 10, 3, 6), ...outerBorders('SOLID') } });

  // === ご請求金額ボックス A12:F13 ===
  requests.push({ mergeCells: { range: range(sheetId, 11, 13, 0, 2), mergeType: 'MERGE_ALL' } });
  requests.push({ mergeCells: { range: range(sheetId, 11, 13, 2, 6), mergeType: 'MERGE_ALL' } });
  // ラベル「ご請求金額」（左半分）
  requests.push({
    repeatCell: {
      range: range(sheetId, 11, 13, 0, 2),
      cell: {
        userEnteredFormat: {
          backgroundColor: NAVY,
          textFormat: { fontSize: 16, bold: true, foregroundColor: WHITE },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  });
  // 値（右半分）
  requests.push({
    repeatCell: {
      range: range(sheetId, 11, 13, 2, 6),
      cell: {
        userEnteredFormat: {
          backgroundColor: WHITE,
          textFormat: { fontSize: 22, bold: true, foregroundColor: NAVY },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          numberFormat: { type: 'CURRENCY', pattern: '¥#,##0"（税込）"' },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,numberFormat)',
    },
  });
  requests.push({ updateBorders: { range: range(sheetId, 11, 13, 0, 6), ...outerBorders('SOLID_MEDIUM') } });

  // === 明細表 ===
  // ヘッダー A15:F15
  requests.push({
    repeatCell: {
      range: range(sheetId, 14, 15, 0, 6),
      cell: {
        userEnteredFormat: {
          backgroundColor: NAVY,
          textFormat: { bold: true, foregroundColor: WHITE, fontSize: 11 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  });
  // データ行 A16:F25 通貨フォーマット & 中央揃え/右寄せ
  requests.push({
    repeatCell: {
      range: range(sheetId, 15, 25, 0, 1),
      cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', textFormat: { fontSize: 11 } } },
      fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat)',
    },
  });
  requests.push({
    repeatCell: {
      range: range(sheetId, 15, 25, 1, 2),
      cell: { userEnteredFormat: { verticalAlignment: 'MIDDLE', textFormat: { fontSize: 11 }, padding: { left: 8, right: 8, top: 0, bottom: 0 } } },
      fields: 'userEnteredFormat(verticalAlignment,textFormat,padding)',
    },
  });
  requests.push({
    repeatCell: {
      range: range(sheetId, 15, 25, 2, 4),
      cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', textFormat: { fontSize: 11 } } },
      fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat)',
    },
  });
  requests.push({
    repeatCell: {
      range: range(sheetId, 15, 25, 4, 6),
      cell: {
        userEnteredFormat: {
          horizontalAlignment: 'RIGHT',
          verticalAlignment: 'MIDDLE',
          textFormat: { fontSize: 11 },
          numberFormat: { type: 'CURRENCY', pattern: '¥#,##0' },
          padding: { left: 4, right: 8, top: 0, bottom: 0 },
        },
      },
      fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat,numberFormat,padding)',
    },
  });
  // 罫線 A15:F25
  requests.push({ updateBorders: { range: range(sheetId, 14, 25, 0, 6), ...allBorders('SOLID') } });

  // === 合計欄 D27:F29 ===
  // ラベル D27:E29 (結合 + グレー)
  requests.push({ mergeCells: { range: range(sheetId, 26, 27, 3, 5), mergeType: 'MERGE_ALL' } });
  requests.push({ mergeCells: { range: range(sheetId, 27, 28, 3, 5), mergeType: 'MERGE_ALL' } });
  requests.push({ mergeCells: { range: range(sheetId, 28, 29, 3, 5), mergeType: 'MERGE_ALL' } });
  requests.push({
    repeatCell: {
      range: range(sheetId, 26, 29, 3, 5),
      cell: {
        userEnteredFormat: {
          backgroundColor: GREY_LABEL,
          textFormat: { bold: true, foregroundColor: NAVY, fontSize: 11 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  });
  // 値 F27:F29
  requests.push({
    repeatCell: {
      range: range(sheetId, 26, 29, 5, 6),
      cell: {
        userEnteredFormat: {
          horizontalAlignment: 'RIGHT',
          verticalAlignment: 'MIDDLE',
          textFormat: { fontSize: 11 },
          numberFormat: { type: 'CURRENCY', pattern: '¥#,##0' },
          padding: { left: 4, right: 8, top: 0, bottom: 0 },
        },
      },
      fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat,numberFormat,padding)',
    },
  });
  // 合計行（F29）強調
  requests.push({
    repeatCell: {
      range: range(sheetId, 28, 29, 3, 6),
      cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14, foregroundColor: NAVY } } },
      fields: 'userEnteredFormat.textFormat',
    },
  });
  requests.push({ updateBorders: { range: range(sheetId, 26, 29, 3, 6), ...allBorders('SOLID') } });

  // === 備考 A31:F33 ===
  // ヘッダー A31:F31 (濃いグレーバー)
  requests.push({ mergeCells: { range: range(sheetId, 30, 31, 0, 6), mergeType: 'MERGE_ALL' } });
  requests.push({
    repeatCell: {
      range: range(sheetId, 30, 31, 0, 6),
      cell: {
        userEnteredFormat: {
          backgroundColor: NAVY,
          textFormat: { bold: true, foregroundColor: WHITE, fontSize: 11 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  });
  // 内容 A32:F33
  requests.push({ mergeCells: { range: range(sheetId, 31, 33, 0, 6), mergeType: 'MERGE_ALL' } });
  requests.push({
    repeatCell: {
      range: range(sheetId, 31, 33, 0, 6),
      cell: {
        userEnteredFormat: {
          textFormat: { fontSize: 11 },
          verticalAlignment: 'MIDDLE',
          padding: { left: 10, right: 8, top: 4, bottom: 4 },
        },
      },
      fields: 'userEnteredFormat(textFormat,verticalAlignment,padding)',
    },
  });
  requests.push({ updateBorders: { range: range(sheetId, 30, 33, 0, 6), ...outerBorders('SOLID') } });

  // === 全体フォント（メイリオ系） ===
  requests.push({
    repeatCell: {
      range: range(sheetId, 0, 35, 0, 6),
      cell: { userEnteredFormat: { textFormat: { fontFamily: 'Noto Sans JP' } } },
      fields: 'userEnteredFormat.textFormat.fontFamily',
    },
  });

  // 装飾を一括適用
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  // 4. リンクで誰でも閲覧できるように共有
  console.log('共有設定中...');
  const drive = google.drive({ version: 'v3', auth });
  await drive.permissions.create({
    fileId: spreadsheetId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  console.log('\n✅ プロ仕様テンプレート作成完了！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`新しい INVOICE_TEMPLATE_SHEET_ID:`);
  console.log(spreadsheetId);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`シートを確認: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
  console.log('\n次の手順:');
  console.log('1. このシートIDをコピー');
  console.log('2. Railway の INVOICE_TEMPLATE_SHEET_ID を上書き');
  console.log('3. git push でコード反映');
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
