// Google API用のOAuth2クライアントを生成するユーティリティ
// リフレッシュトークン方式でアクセストークンを自動更新します
const { google } = require('googleapis');

/**
 * 認証済みのOAuth2クライアントを返す
 * Calendar / Sheets / Drive すべてで共通利用できます
 */
function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
    // redirect_uri は refresh_token フローでは不要
  );

  // リフレッシュトークンをセットしておけば、
  // SDKが必要に応じて新しいアクセストークンを自動取得します
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return oauth2Client;
}

module.exports = { getOAuth2Client };
