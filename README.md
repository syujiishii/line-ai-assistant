# LINE AI 秘書 (Claude × LINE Messaging API)

LINEで話しかけるだけでAIがあなたの業務を代行する個人秘書システムです。

## できること

- 📅 **Googleカレンダー連携**
  - 「今日の予定」「明日の予定教えて」と聞けば即答
  - 「明日14時に打ち合わせ追加して」で予定登録
  - 毎朝8:00に今日の予定を自動でLINE通知
- 📄 **請求書発行**
  - 「○○株式会社にWeb制作費10万円の請求書作って」でPDFを生成
- 📸 **Instagramコメント管理**
  - 「未返信のInstagramコメント見せて」で一覧
  - AIが返信案を提案 →「OK」と言うだけで送信
- ✅ **タスク管理**
  - 「タスク追加: 〇〇 優先度高」で登録
  - 「タスク一覧」で優先度順に表示
  - 「タスク3完了」でチェック
- 🧵 **Threads自動投稿（NEW）**
  - LINEで「覚えとって：[内容/YouTube URL]」と送るだけでネタ帳に蓄積
  - 朝7:00 / 昼11:30 / 夕16:30 にAIが投稿案3つをLINE Flexで提案
  - ボタンタップで案を選択 → 9:00 / 12:00 / 18:00 に自動投稿
  - 深夜2:00 に過去30日のエンゲージメントを自動収集→ヒット投稿を学習素材に

---

## 技術スタック

- Node.js (Express)
- Anthropic Claude API (Tool Use)
  - 既存秘書ロジック: `claude-opus-4-7`
  - 投稿生成 / 知識要約: `claude-sonnet-4-5`（Prompt Caching 活用、ttl 1時間）
- LINE Messaging API（Flex Message + postback）
- Google Calendar / Sheets / Drive API
- Instagram Graph API
- Threads Graph API（v1.0、フォールバックモード対応）
- node-cron（Asia/Tokyo）
- youtube-transcript（YouTube字幕取得）
- デプロイ: Railway もしくは Render（無料枠で運用可能）

---

## ディレクトリ構成

```
line-ai-assistant/
├── index.js                 ← エントリポイント (Express)
├── package.json
├── .env.example
├── .gitignore
├── README.md
└── src/
    ├── claude.js            ← Claude Tool Use ループ
    ├── line-handler.js      ← LINEイベント処理
    ├── cron-jobs.js         ← 毎朝8時通知
    ├── tools/
    │   ├── index.js         ← ツール定義 + ディスパッチャ
    │   ├── calendar.js      ← Googleカレンダー
    │   ├── invoice.js       ← 請求書 (Sheets→PDF)
    │   ├── instagram.js     ← Instagramコメント
    │   └── tasks.js         ← タスク管理 (Sheets)
    └── utils/
        └── google-auth.js   ← Google OAuth2 クライアント
```

---

## 1. 必要なAPIキーの取得方法

このアプリを動かすには **8種類** のAPIキー/IDが必要です。順番に取得していきます。

### 1-1. LINE Messaging API のキー (2つ)

1. [LINE Developers Console](https://developers.line.biz/console/) にログイン
2. 「新規プロバイダー作成」 → プロバイダー名は何でもOK
3. プロバイダー画面で「**Messaging API** チャネルを作成」
   - チャネル名・チャネル説明・大業種・小業種・メールアドレスを入力
4. 作成したチャネルの設定画面を開く
5. **「Basic settings」** タブ
   - 一番下の「**Channel secret**」 → これが `LINE_CHANNEL_SECRET`
6. **「Messaging API」** タブ
   - 「**Channel access token (long-lived)**」の右にある「Issue」ボタンを押して発行
   - 表示された文字列が `LINE_CHANNEL_ACCESS_TOKEN`
7. 同じ「Messaging API」タブで以下も設定
   - **Webhook URL**: 後ほどデプロイ後に `https://あなたのドメイン/webhook` を設定
   - **Use webhook**: ON
   - **Auto-reply messages**: OFF
   - **Greeting messages**: OFF（任意）
8. **「Your user ID」** をコピー → これが `LINE_USER_ID`（朝8時の通知先）
9. **QRコード** を表示してスマホのLINEで友だち追加しておく

### 1-2. Anthropic Claude API キー (1つ)

1. [Anthropic Console](https://console.anthropic.com/) にログイン（アカウントがなければ登録）
2. 左メニュー **「API Keys」** → **「Create Key」**
3. 名前を付けて発行 → 表示されたキーが `ANTHROPIC_API_KEY`
4. 利用にはクレジット購入が必要です（最低$5から、課金画面はSettings→Billing）

### 1-3. Google API のキー (3つ)

カレンダー/Sheets/Drive を使うために OAuth クライアントを作成し、リフレッシュトークンを取得します。

#### (a) Google Cloud プロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 上部のプロジェクトプルダウン → 「新しいプロジェクト」 → プロジェクト名を入力して作成
3. 作成したプロジェクトを選択

#### (b) APIの有効化

1. 左メニュー「APIとサービス」 → 「ライブラリ」
2. 以下の3つを順番に有効化（検索して「有効にする」を押す）
   - **Google Calendar API**
   - **Google Sheets API**
   - **Google Drive API**

#### (c) OAuth同意画面の設定

1. 「APIとサービス」 → 「OAuth同意画面」
2. ユーザータイプ「**外部**」 → 作成
3. アプリ情報（アプリ名・サポートメール・デベロッパー連絡先）を入力 → 保存
4. スコープは追加せずに「保存して続行」
5. **テストユーザー** に自分のGoogleアカウントを追加 → 保存

#### (d) OAuthクライアントIDの作成

1. 「APIとサービス」 → 「認証情報」 → 「**+ 認証情報を作成**」 → 「**OAuth クライアント ID**」
2. アプリケーションの種類: **ウェブアプリケーション**
3. **承認済みのリダイレクトURI** に次を追加: `https://developers.google.com/oauthplayground`
4. 作成すると **クライアントID** と **クライアントシークレット** が表示
   - これが `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET`

#### (e) リフレッシュトークンの取得

1. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) を開く
2. 右上の **歯車アイコン** ⚙️ をクリック
   - 「**Use your own OAuth credentials**」にチェック
   - 上で取得した **Client ID / Client Secret** を入力
3. 左側のスコープ入力欄に以下を **1行ずつ** 入力（複数選択）して **Authorize APIs** をクリック
   ```
   https://www.googleapis.com/auth/calendar
   https://www.googleapis.com/auth/spreadsheets
   https://www.googleapis.com/auth/drive
   ```
4. Googleアカウントでログイン・許可
5. 「**Exchange authorization code for tokens**」をクリック
6. 表示された **Refresh token** が `GOOGLE_REFRESH_TOKEN`

> ※ OAuth同意画面が「テスト中」の場合、リフレッシュトークンは7日で失効することがあります。長期運用するなら同意画面を「本番環境」に切り替えてください。

#### (f) 請求書テンプレート用 Google Sheets の準備

1. [Google Sheets](https://sheets.google.com/) で新規スプレッドシート作成
2. 例として以下のレイアウトに整える
   ```
   A1: 請求書           B1:
   A2: 請求先           B2: （ここに会社名が入る）
   A3: 件名             B3: （ここに件名が入る）
   A4: 金額             B4: （ここに金額が入る）
   A5: 発行日           B5: （ここに日付が入る）
   ```
   見栄えはお好みで装飾してください（B2〜B5 の位置だけは合わせる必要があります）。
3. URLの中央にある長い文字列がシートID:
   `https://docs.google.com/spreadsheets/d/【ここがID】/edit`
   → これが `INVOICE_TEMPLATE_SHEET_ID`

#### (g) タスク管理用 Google Sheets の準備

1. 別のスプレッドシートを新規作成
2. 1行目に以下のヘッダーを入力
   ```
   A1: タスク名
   B1: 優先度
   C1: 期限
   D1: 状態
   ```
3. URLからシートIDをコピー → `TASKS_SHEET_ID`

### 1-4. Instagram Graph API のキー (2つ)

> ⚠️ Instagramビジネスアカウント + 紐づくFacebookページが必要です（個人アカウントでは利用不可）。

1. お使いのInstagramアカウントを **プロアカウント（ビジネス）** に切り替え
2. [Facebookページ](https://www.facebook.com/pages/create/) を作成し、Instagramアカウントと連携
3. [Meta for Developers](https://developers.facebook.com/) でアプリを作成
   - 「マイアプリ」 → 「アプリを作成」 → 種類「ビジネス」
4. アプリのダッシュボードで「**Instagram Graph API**」を製品として追加
5. [Graph API Explorer](https://developers.facebook.com/tools/explorer/) を開く
   - アプリを選択
   - **User or Page** で「Get User Access Token」 →スコープに以下を追加
     - `instagram_basic`
     - `instagram_manage_comments`
     - `pages_show_list`
     - `pages_read_engagement`
     - `business_management`
   - Generate Access Token → これが短期トークン
6. 短期トークンを **長期トークン** に変換
   - Graph API Explorerで `me/accounts` を叩いて、対象FacebookページのアクセストークンとPage IDを取得
   - そのページトークンを使って:
     ```
     GET /{page-id}?fields=instagram_business_account
     ```
     → 返ってきた `instagram_business_account.id` が `INSTAGRAM_BUSINESS_ACCOUNT_ID`
   - ページアクセストークン (長期) を `INSTAGRAM_ACCESS_TOKEN` として使います
7. 長期トークンへの変換 (任意・推奨):
   ```
   GET https://graph.facebook.com/v18.0/oauth/access_token
       ?grant_type=fb_exchange_token
       &client_id={app-id}
       &client_secret={app-secret}
       &fb_exchange_token={short-lived-token}
   ```

---

## 2. ローカルでの動作確認

```bash
# 1. リポジトリ取得
git clone <あなたのリポジトリURL>
cd line-ai-assistant

# 2. 依存パッケージ
npm install

# 3. .env を作成
cp .env.example .env
# その後エディタで .env を開いて、上で取得した値を貼り付け

# 4. 起動
npm start
```

ローカルでLINE Webhookを試す場合は `ngrok` などのトンネリングツールが必要です。

```bash
ngrok http 3000
# 表示された https://xxxx.ngrok.io/webhook を
# LINE Developers Console → Messaging API → Webhook URL に設定
```

---

## 3. Railway へのデプロイ手順

最も手軽な無料ホスティング先として Railway を推奨します（24時間稼働）。

### ステップ 1: GitHubに公開

1. GitHubで新しいリポジトリを作成
2. ローカルから push
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-name>/line-ai-assistant.git
   git push -u origin main
   ```
   ※ `.env` は `.gitignore` で除外されます。絶対にコミットしないでください。

### ステップ 2: Railway でプロジェクト作成

1. [Railway](https://railway.app/) にGitHubアカウントでログイン
2. 「**New Project**」 → 「**Deploy from GitHub repo**」 → 上記リポジトリを選択
3. Railwayが自動的に Node.js プロジェクトを認識し、初回デプロイが走ります

### ステップ 3: 環境変数を設定

1. プロジェクト画面 → **Variables** タブ
2. `Raw Editor` を開いて、`.env.example` の中身を貼り付け
3. 各値を実際のキー/IDに書き換え
4. `PORT` は Railway が自動で渡してくれるので不要（書いても無視されます）

### ステップ 4: 公開URLを取得

1. **Settings** タブ → **Networking** → 「**Generate Domain**」
2. 発行されたURL（例: `https://line-ai-assistant-production.up.railway.app`）をコピー

### ステップ 5: LINE Webhook を本番URLに変更

1. LINE Developers Console → Messaging API設定
2. **Webhook URL** に `https://〜〜.up.railway.app/webhook` を設定
3. 「**Verify**」ボタンで200応答が返ればOK
4. **Use webhook** を ON

### ステップ 6: 動作確認

LINEで自分のBotに「**今日の予定教えて**」と送ってみてください。
カレンダーの予定が返ってきたら成功です 🎉

---

## 4. Render でデプロイする場合（参考）

1. [Render](https://render.com/) でGitHub連携してログイン
2. 「**New** → **Web Service**」 → 上記リポジトリを選択
3. 設定値:
   - Environment: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: **Free**
4. **Environment** タブで `.env.example` の各値を登録
5. デプロイ完了後に表示される `https://〜.onrender.com/webhook` を LINE の Webhook URL に登録

> ※ Renderの無料プランは15分アクセスがないとスリープします。朝8時のcronを正常に動かすには、
> 別途 [UptimeRobot](https://uptimerobot.com/) などで定期的にヘルスチェック (`/`) を叩く設定がおすすめです。
> Railwayはスリープしないので、cron運用は Railway の方が安定します。

---

## 5. トラブルシュート

| 症状 | 対処 |
|------|------|
| LINEに返信が来ない | Webhook URL に `/webhook` まで入っているか確認 / Railway の Logs を確認 |
| Webhook Verify が失敗する | `LINE_CHANNEL_SECRET` が正しいか確認、サーバーが起動しているか確認 |
| `invalid_grant` エラー | `GOOGLE_REFRESH_TOKEN` が失効しています。OAuth Playground で再発行してください |
| Instagramコメントが取れない | アクセストークンの権限不足。`instagram_manage_comments` を含めて再発行 |
| 朝の通知が来ない | `LINE_USER_ID` が空 / Bot を友だち追加していない可能性 |
| 「エラーが発生しました。もう一度お試しください」が返る | サーバーログ（Railway Logs）でスタックトレースを確認 |

---

## 6. ライセンス

MIT

---

## 7. Threads自動投稿モジュール 動作確認手順

### 7-1. シート自動作成

```bash
node scripts/setup-knowledge-sheet.js
node scripts/setup-posts-log-sheet.js
```

出力されたシートIDを `.env` に追記:

```
KNOWLEDGE_SHEET_ID=1xxx...
POSTS_LOG_SHEET_ID=1yyy...
```

### 7-2. ペルソナ編集

`config/persona.md` を自分の言葉で書き換える（投稿の質を決める最重要ファイル）。

### 7-3. ローカルテスト

```bash
# 1. 知識保存テスト
node -e "require('./src/tools').executeTool('save_knowledge', {input: 'テストメモ：早起きは三文の徳'}).then(console.log)"

# 2. 投稿案生成テスト
node -e "require('./src/tools').executeTool('generate_post_proposals', {slot: 'morning'}).then(console.log)"

# 3. 投稿（フォールバックモード）
node -e "require('./src/tools').executeTool('post_to_threads', {slot: 'morning'}).then(console.log)"
```

### 7-4. LINE経由のテスト

LINEで送信:
```
覚えとって：今日の学び：行動が9割
```
→ 「📚 ...として保存したで」と返信が来る。

### 7-5. cron動作確認

`npm start` でアプリ起動 → 起動ログにcron時刻一覧が出る:

```
[cron] スケジューラ起動:
  - 毎朝8:00 予定通知
  - 07:00/11:30/16:30 投稿案生成
  - 09:00/12:00/18:00 Threads投稿実行
  - 2:00 メトリクス収集
```

### 7-6. 本番Threads APIに切替

`.env` で:

```
THREADS_FALLBACK_MODE=false
THREADS_USER_ID=<取得したID>
THREADS_ACCESS_TOKEN=<長期トークン>
```

→ Railway再デプロイで反映。

### 7-7. テスト実行

```bash
npm test
```

12テスト全てパスすればOK。

---

## 8. Threadsモジュール アーキテクチャ概要

```
LINE Webhook ──► message ──► claude.js (Tool Useループ) ──► save_knowledge / etc.
            └─► postback ─► line-handler.handlePostback ─► select_proposal etc.

cron 07:00/11:30/16:30 ──► generate_post_proposals ──► proposal-generator.js
                                                          ├─ persona.md (Cache 1h)
                                                          ├─ ヒット投稿例 (Cache 1h)
                                                          ├─ 知識候補 (UsedCount昇順)
                                                          └─ Sonnet 4.5 → JSON

cron 09:00/12:00/18:00 ──► post_to_threads ──► threads-client.js
                                                  ├─ Fallback: コピペテキスト
                                                  └─ API: container作成→30秒待機→publish

cron 02:00 ──► collect_metrics ──► Threads insights API ──► posts_log 更新
                                                              └─ M列: エンゲ率自動計算
                                                              └─ N列: ✓自動マーク (>=3%)
```

