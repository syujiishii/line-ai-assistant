// Claude API クライアント（Tool Use ループ実装）
//
// LINEから受け取ったメッセージを Claude に渡し、必要に応じて
// ツール実行を挟みながら最終的な返答テキストを得ます。
const Anthropic = require('@anthropic-ai/sdk');
const { toolDefinitions, executeTool } = require('./tools');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Claude モデル ID（claude-api スキルの指針通り Opus 4.7 を使用）
const MODEL_ID = 'claude-opus-4-7';

const SYSTEM_PROMPT = `あなたは日本語で応答する有能なAI秘書です。
ユーザーのLINEメッセージを受け取り、必要に応じて以下のツールを使って業務を支援します。

【できること】
- Googleカレンダーの予定確認・追加
- 請求書の作成（PDF発行）
- Instagramの未返信コメント確認・返信案の提案・送信
- タスクの追加・優先度順の確認・完了処理

【応答ルール】
- 日本語で、簡潔で親しみやすいトーンで返答してください
- 日付の相対表現（今日/明日/明後日）はJST(Asia/Tokyo)基準で解釈してください
- ツールを使った場合は、その結果をユーザーに分かりやすくまとめて返してください
- 不明な点はユーザーに確認してください`;

/**
 * ユーザーのメッセージを処理して、返信テキストを返す
 * @param {string} userMessage LINEからのテキスト
 * @returns {Promise<string>}
 */
async function chat(userMessage) {
  const messages = [
    { role: 'user', content: userMessage },
  ];

  // Tool Use ループ: stop_reason が end_turn になるまで回す
  // 暴走防止のため最大10ラウンドまで
  for (let i = 0; i < 10; i++) {
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      // Opus 4.7 は adaptive thinking のみサポート
      thinking: { type: 'adaptive' },
      messages,
    });

    // assistantの返答（tool_use ブロックを含む可能性あり）を会話履歴に追加
    messages.push({ role: 'assistant', content: response.content });

    // 終端条件: もう道具を使う必要がない = 最終回答
    if (response.stop_reason === 'end_turn') {
      // テキストブロックを連結して返す
      const textBlocks = response.content.filter((b) => b.type === 'text');
      return textBlocks.map((b) => b.text).join('\n').trim() || '（応答がありませんでした）';
    }

    // tool_use なら全ての tool_use ブロックに対してツールを実行
    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter((b) => b.type === 'tool_use');
      const toolResults = [];

      for (const tu of toolUses) {
        try {
          const result = await executeTool(tu.name, tu.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: String(result),
          });
        } catch (err) {
          console.error(`ツール実行エラー (${tu.name}):`, err);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: `エラー: ${err.message}`,
            is_error: true,
          });
        }
      }

      // ツール実行結果を user メッセージとして渡す
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // その他のstop_reason（max_tokens等）はループを抜ける
    const textBlocks = response.content.filter((b) => b.type === 'text');
    return textBlocks.map((b) => b.text).join('\n').trim() || '（応答が途中で終了しました）';
  }

  return '処理が長くなりすぎました。もう一度お試しください。';
}

module.exports = { chat };
