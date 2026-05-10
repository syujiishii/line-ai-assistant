// Threads投稿モジュール用のツール定義 + ハンドラ
// Claude Tool Use から呼ばれる5つのツールを実装
const Anthropic = require('@anthropic-ai/sdk');
const dayjs = require('dayjs');

const sheetsHelper = require('../sheets-helper');
const proposalGenerator = require('../proposal-generator');
const youtubeTranscript = require('../youtube-transcript');
const threadsClient = require('../threads-client');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SUMMARIZE_MODEL = 'claude-sonnet-4-5';

// ============== ツール定義 ==============
const threadsTools = [
  {
    name: 'save_knowledge',
    description: 'ユーザーが「覚えとって」と送った内容を知識ベースに保存する。URLならYouTube文字起こし→要約、テキストなら構造化して保存。',
    input_schema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'URLまたはテキスト' },
        user_note: { type: 'string', description: 'ユーザーの追記メモ（任意）' },
      },
      required: ['input'],
    },
  },
  {
    name: 'generate_post_proposals',
    description: '指定された時間帯（morning/noon/evening）のThreads投稿案を3つ生成する。',
    input_schema: {
      type: 'object',
      properties: {
        slot: { type: 'string', enum: ['morning', 'noon', 'evening'] },
      },
      required: ['slot'],
    },
  },
  {
    name: 'select_proposal',
    description: 'ユーザーが選択した投稿案を予約状態にする（Status: scheduled）。',
    input_schema: {
      type: 'object',
      properties: {
        post_id: { type: 'string', description: '投稿ID（POST001など）' },
      },
      required: ['post_id'],
    },
  },
  {
    name: 'post_to_threads',
    description: '予約済み（scheduled状態）の投稿をThreadsに投稿する（時刻トリガー用）。',
    input_schema: {
      type: 'object',
      properties: {
        slot: { type: 'string', enum: ['morning', 'noon', 'evening'] },
      },
      required: ['slot'],
    },
  },
  {
    name: 'collect_metrics',
    description: '過去30日のThreads投稿の反応データ（Likes/Replies/Reposts/Views）を取得して posts_log を更新する。',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ============== ハンドラ実装 ==============

/**
 * URLっぽい文字列か判定（http/https）
 */
function looksLikeUrl(s) {
  return /^https?:\/\//i.test((s || '').trim());
}

/**
 * Claudeで知識を要約・構造化
 * 戻り値: { title, content, category }
 */
async function summarizeKnowledge(rawText, userNote) {
  const prompt = `以下の内容を、Threads投稿のネタ帳として保存できるよう構造化してください。

【入力】
${rawText}

${userNote ? `【ユーザーのメモ】\n${userNote}\n` : ''}

【出力フォーマット】（JSONのみ、コードブロック不要）
{
  "title": "30文字以内の短いタイトル",
  "content": "本質エッセンスを200〜400文字で要約",
  "category": "気づき/学び/体験/名言/データ/その他 のいずれか"
}`;

  const res = await anthropic.messages.create({
    model: SUMMARIZE_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  const textBlock = res.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('要約レスポンス空');
  const m = textBlock.text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(m ? m[0] : textBlock.text);
  return {
    title: parsed.title || '無題',
    content: parsed.content || rawText.slice(0, 400),
    category: parsed.category || 'その他',
  };
}

/**
 * save_knowledge: 知識ベースに追加
 */
async function handleSaveKnowledge({ input, user_note }) {
  const sheetId = process.env.KNOWLEDGE_SHEET_ID;
  if (!sheetId) {
    return 'KNOWLEDGE_SHEET_ID が未設定です。`node scripts/setup-knowledge-sheet.js` でシート作成してください。';
  }

  let rawText = input;
  let source = '';

  // YouTubeなら文字起こし取得
  if (looksLikeUrl(input) && youtubeTranscript.isYouTubeUrl(input)) {
    source = input;
    const tr = await youtubeTranscript.getTranscript(input);
    if (tr.ok) {
      rawText = tr.text;
    } else {
      return `YouTube文字起こしを取得できませんでした: ${tr.message}`;
    }
  } else if (looksLikeUrl(input)) {
    source = input;
    // YouTube以外のURLはとりあえず本文をそのまま使う
    rawText = input + (user_note ? `\n${user_note}` : '');
  }

  // Claudeで構造化
  const summary = await summarizeKnowledge(rawText, user_note);

  // ID生成
  const id = await sheetsHelper.generateNextId(sheetId, 'knowledge', 'KB');
  const today = dayjs().format('YYYY-MM-DD');

  await sheetsHelper.appendRow(sheetId, 'knowledge', [
    id,                  // A: ID
    summary.title,       // B: Title
    summary.content,     // C: Content
    summary.category,    // D: Category
    source,              // E: Source
    0,                   // F: UsedCount
    '',                  // G: LastUsed
    today,               // H: CreatedAt
  ]);

  return `📚 「${summary.title}」として保存したで（${id} / カテゴリ: ${summary.category}）`;
}

/**
 * generate_post_proposals: 投稿案3つ生成
 */
async function handleGenerateProposals({ slot }) {
  const result = await proposalGenerator.generateProposals({ slot });
  // Tool呼び出しの戻り値は文字列なので、構造を要約して返す
  // ※実際にはcron経由でFlex Messageを送るので、Tool経由の場合はテキスト要約のみ
  const summary = result.proposals.map((p, i) =>
    `案${i + 1} [${p.id}] (${p.type}) ${p.text}`
  ).join('\n');
  return `${slot}スロットの投稿案を${result.proposals.length}つ生成・記録しました\n\n${summary}`;
}

/**
 * select_proposal: 選択した案をscheduledに
 */
async function handleSelectProposal({ post_id }) {
  const sheetId = process.env.POSTS_LOG_SHEET_ID;
  if (!sheetId) return 'POSTS_LOG_SHEET_ID が未設定です';

  const found = await sheetsHelper.findRowById(sheetId, 'posts', post_id);
  if (!found) return `投稿ID ${post_id} が見つかりません`;

  // Status を scheduled に
  await sheetsHelper.updateCellByIdAndColumn(sheetId, 'posts', post_id, 'D', 'scheduled');

  // SourceKnowledgeID から KB の UsedCount/LastUsed を更新
  const sourceKbId = found.row[4];
  const kbSheetId = process.env.KNOWLEDGE_SHEET_ID;
  if (sourceKbId && kbSheetId) {
    try {
      const kb = await sheetsHelper.findRowById(kbSheetId, 'knowledge', sourceKbId);
      if (kb) {
        const currentUsed = parseInt(kb.row[5] || '0', 10);
        await sheetsHelper.updateRange(
          kbSheetId,
          `knowledge!F${kb.rowIndex}:G${kb.rowIndex}`,
          [[currentUsed + 1, dayjs().format('YYYY-MM-DD')]]
        );
      }
    } catch (e) {
      console.warn('[select_proposal] KB更新スキップ:', e.message);
    }
  }

  // 同じslotの他のproposed案をskipped扱いに
  try {
    const slot = found.row[2]; // C列
    const allRows = await sheetsHelper.getRows(sheetId, 'posts!A2:D');
    for (let i = 0; i < allRows.length; i++) {
      const r = allRows[i];
      if (r[0] && r[0] !== post_id && r[2] === slot && r[3] === 'proposed') {
        await sheetsHelper.updateCellByIdAndColumn(sheetId, 'posts', r[0], 'D', 'skipped');
      }
    }
  } catch (e) {
    console.warn('[select_proposal] 他案skipped化スキップ:', e.message);
  }

  // 投稿時刻アナウンス文
  const postTimes = (process.env.POST_TIMES || '09:00,12:00,18:00').split(',');
  const slot = found.row[2];
  const slotTimeMap = { morning: postTimes[0], noon: postTimes[1], evening: postTimes[2] };
  const postTime = slotTimeMap[slot] || '次の投稿時刻';

  return `おっけー、${postTime}に投稿するで（${post_id}）`;
}

/**
 * post_to_threads: 予約済み投稿を実行
 */
async function handlePostToThreads({ slot }) {
  const sheetId = process.env.POSTS_LOG_SHEET_ID;
  if (!sheetId) return 'POSTS_LOG_SHEET_ID が未設定です';

  // scheduled かつ slot 一致のものを探す（最新1件）
  const rows = await sheetsHelper.getRows(sheetId, 'posts!A2:N');
  const target = rows
    .map((r, i) => ({ rowIndex: i + 2, r }))
    .filter(({ r }) => r[0] && r[2] === slot && r[3] === 'scheduled')
    .pop(); // 末尾(最新)

  if (!target) {
    return `${slot}スロットに予約済み投稿がありません（スキップ）`;
  }

  const postId = target.r[0];
  const text = target.r[1];

  const result = await threadsClient.postToThreads(text);
  const postedAt = dayjs().format('YYYY-MM-DD HH:mm');

  if (result.mode === 'fallback') {
    // フォールバック時: ThreadsPostID は manual_YYYYMMDD_HHMM
    const manualId = `manual_${dayjs().format('YYYYMMDD_HHmm')}`;
    await sheetsHelper.updateRange(
      sheetId,
      `posts!D${target.rowIndex}:H${target.rowIndex}`,
      [['posted', target.r[4] || '', postedAt, manualId, '']],
    );
    return JSON.stringify({
      mode: 'fallback',
      post_id: postId,
      text,
      message: result.message,
    });
  }

  // 本番: Threads API成功
  await sheetsHelper.updateRange(
    sheetId,
    `posts!D${target.rowIndex}:H${target.rowIndex}`,
    [['posted', target.r[4] || '', postedAt, result.threadsPostId, '']],
  );
  return JSON.stringify({
    mode: 'api',
    post_id: postId,
    text,
    threadsPostId: result.threadsPostId,
    url: result.url,
  });
}

/**
 * collect_metrics: 過去30日の posted 投稿の反応データ更新
 */
async function handleCollectMetrics() {
  const sheetId = process.env.POSTS_LOG_SHEET_ID;
  if (!sheetId) return 'POSTS_LOG_SHEET_ID が未設定です';

  if (threadsClient.isFallbackMode()) {
    return 'フォールバックモード中はメトリクス取得スキップ';
  }

  const rows = await sheetsHelper.getRows(sheetId, 'posts!A2:N');
  const cutoff = dayjs().subtract(30, 'day');
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    if (r[3] !== 'posted') continue;
    if (!r[7] || r[7].startsWith('manual_')) continue; // 手動投稿はスキップ

    const postedAt = r[6] ? dayjs(r[6]) : null;
    if (postedAt && postedAt.isBefore(cutoff)) continue;

    try {
      const m = await threadsClient.getPostMetrics(r[7]);
      await sheetsHelper.updateRange(
        sheetId,
        `posts!I${i + 2}:L${i + 2}`,
        [[m.likes, m.replies, m.reposts, m.views]],
      );
      updated++;
    } catch (e) {
      console.warn(`[collect_metrics] ${r[0]} 失敗:`, e.message);
      failed++;
    }
  }

  return `メトリクス更新: 成功${updated}件 / 失敗${failed}件`;
}

// ============== ディスパッチャ ==============
async function executeThreadsTool(name, input) {
  switch (name) {
    case 'save_knowledge':
      return await handleSaveKnowledge(input || {});
    case 'generate_post_proposals':
      return await handleGenerateProposals(input || {});
    case 'select_proposal':
      return await handleSelectProposal(input || {});
    case 'post_to_threads':
      return await handlePostToThreads(input || {});
    case 'collect_metrics':
      return await handleCollectMetrics();
    default:
      throw new Error(`未知のThreadsツール: ${name}`);
  }
}

// 関数版（cron/postback等から直接呼ぶ用 — 整形済みオブジェクトを返す）
async function generateProposalsRaw(slot) {
  return await proposalGenerator.generateProposals({ slot });
}

async function selectProposalRaw(postId) {
  return await handleSelectProposal({ post_id: postId });
}

async function postToThreadsRaw(slot) {
  const json = await handlePostToThreads({ slot });
  try { return JSON.parse(json); } catch { return { message: json }; }
}

async function collectMetricsRaw() {
  return await handleCollectMetrics();
}

module.exports = {
  threadsTools,
  executeThreadsTool,
  // 直接呼び出し用
  generateProposalsRaw,
  selectProposalRaw,
  postToThreadsRaw,
  collectMetricsRaw,
};
