// 投稿案生成コアロジック
// Claude Sonnet 4.5 + Prompt Caching（system messageに persona + ヒット投稿例）
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const dayjs = require('dayjs');

const sheetsHelper = require('./sheets-helper');
const { SLOT_META } = require('./flex-templates');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL_ID = 'claude-sonnet-4-5';

// ========== ペルソナ読み込み（プロセス起動時に1回） ==========
let _personaCache = null;
function loadPersona() {
  if (_personaCache) return _personaCache;
  const personaPath = path.join(__dirname, '..', 'config', 'persona.md');
  try {
    _personaCache = fs.readFileSync(personaPath, 'utf8');
  } catch (err) {
    console.warn('[proposal-generator] persona.md が読めません。デフォルト使用:', err.message);
    _personaCache = '# 俺のペルソナ\n（未設定）';
  }
  return _personaCache;
}

// ========== 知識候補取得 ==========
/**
 * UsedCount昇順 + LastUsed30日以内除外で5件まで返す
 */
async function pickKnowledgeCandidates() {
  const sheetId = process.env.KNOWLEDGE_SHEET_ID;
  if (!sheetId) throw new Error('KNOWLEDGE_SHEET_ID が未設定');

  const rows = await sheetsHelper.getRows(sheetId, 'knowledge!A2:H');
  const today = dayjs();
  const items = rows
    .filter((r) => r[0] && r[1]) // ID と Title が必要
    .map((r) => ({
      id: r[0],
      title: r[1],
      content: r[2] || '',
      category: r[3] || '',
      source: r[4] || '',
      usedCount: parseInt(r[5] || '0', 10),
      lastUsed: r[6] || '',
      createdAt: r[7] || '',
    }))
    .filter((item) => {
      if (!item.lastUsed) return true;
      const daysSince = today.diff(dayjs(item.lastUsed), 'day');
      return daysSince > 30;
    })
    .sort((a, b) => a.usedCount - b.usedCount)
    .slice(0, 5);

  return items;
}

// ========== ヒット投稿例取得（参考用） ==========
async function pickHitExamples() {
  const sheetId = process.env.POSTS_LOG_SHEET_ID;
  if (!sheetId) return [];

  try {
    const rows = await sheetsHelper.getRows(sheetId, 'posts!A2:N');
    return rows
      .filter((r) => r[13] === '✓' && r[1]) // Hit列が✓ かつ Content存在
      .map((r) => ({
        id: r[0],
        text: r[1],
        engagementRate: parseFloat(r[12] || '0'),
      }))
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 10);
  } catch (err) {
    console.warn('[proposal-generator] ヒット投稿取得失敗:', err.message);
    return [];
  }
}

function slotInstruction(slot) {
  switch (slot) {
    case 'morning': return '朝（始動・動き出すきっかけ系）';
    case 'noon':    return '昼（休憩中にチラ見できる気づき系）';
    case 'evening': return '夕（1日の振り返り・明日への問いかけ系）';
    default:        return '';
  }
}

function formatKnowledgeForPrompt(candidates) {
  if (candidates.length === 0) return '（候補なし）';
  return candidates.map((k) => {
    return `[${k.id}] ${k.title}\n  カテゴリ: ${k.category || '-'}\n  内容: ${(k.content || '').slice(0, 200)}`;
  }).join('\n\n');
}

function formatHitsForPrompt(hits) {
  if (hits.length === 0) return '（まだヒット投稿なし）';
  return hits.map((h, i) => `${i + 1}. ${h.text}（エンゲ率 ${h.engagementRate}%）`).join('\n');
}

/**
 * 投稿案を生成し、posts_logに proposed として記録
 * @param {{ slot: 'morning'|'noon'|'evening', excludeRecent?: boolean }} opts
 * @returns {Promise<{ proposals: Array<{id, text, type, basedOnId}>, slot }>}
 */
async function generateProposals(opts = {}) {
  const slot = opts.slot || 'morning';
  const persona = loadPersona();
  const candidates = await pickKnowledgeCandidates();
  const hits = await pickHitExamples();

  const maxLen = parseInt(process.env.POST_MAX_LENGTH || '100', 10);
  const proposalCount = parseInt(process.env.PROPOSAL_COUNT || '3', 10);

  if (candidates.length === 0) {
    throw new Error('知識ベースが空です。LINEで「覚えとって：〜」で何か追加してください。');
  }

  // ====== Claude API 呼び出し（system に prompt cache breakpoint を2つ） ======
  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: persona,
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
      {
        type: 'text',
        text: `# 過去のヒット投稿（参考）\n${formatHitsForPrompt(hits)}`,
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ],
    messages: [{
      role: 'user',
      content: `${slotInstruction(slot)}にThreadsで投稿する案を${proposalCount}つ作って。

【ルール】
- ${maxLen}文字以内
- 上記ペルソナの口調を厳守
- 上記の過去ヒット投稿の温度感を参考に
- ${proposalCount}案は意図的にテイストを変える（例：①体験談型 ②気づき型 ③問いかけ型）

【ネタ候補】
${formatKnowledgeForPrompt(candidates)}

JSON形式で返して（コードブロックなし、JSONだけ）:
{
  "proposals": [
    { "text": "...", "based_on_id": "KB001", "type": "体験談型" },
    { "text": "...", "based_on_id": "KB003", "type": "気づき型" },
    { "text": "...", "based_on_id": "KB005", "type": "問いかけ型" }
  ]
}`,
    }],
  });

  // ====== レスポンスをパース ======
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Claudeから空応答');
  let parsed;
  try {
    // JSON部分だけ取り出す（万一マークダウンで囲まれた場合に備え）
    const m = textBlock.text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : textBlock.text);
  } catch (err) {
    console.error('[proposal-generator] JSONパース失敗:', textBlock.text);
    throw new Error('投稿案のJSONパースに失敗');
  }
  if (!parsed.proposals || !Array.isArray(parsed.proposals)) {
    throw new Error('proposals 配列が見つかりません');
  }

  // ====== posts_log に proposed として記録 ======
  const postsSheetId = process.env.POSTS_LOG_SHEET_ID;
  const proposals = [];
  const proposedAt = dayjs().format('YYYY-MM-DD HH:mm');

  for (const p of parsed.proposals.slice(0, proposalCount)) {
    const id = await sheetsHelper.generateNextId(postsSheetId, 'posts', 'POST');
    await sheetsHelper.appendRow(postsSheetId, 'posts', [
      id,                  // A: ID
      p.text || '',        // B: Content
      slot,                // C: Slot
      'proposed',          // D: Status
      p.based_on_id || '', // E: SourceKnowledgeID
      proposedAt,          // F: ProposedAt
      '',                  // G: PostedAt
      '',                  // H: ThreadsPostID
      0, 0, 0, 0,          // I-L: Likes/Replies/Reposts/Views
      // M, N: 数式は既にシートに入ってる
    ]);
    proposals.push({
      id,
      text: p.text || '',
      type: p.type || '',
      basedOnId: p.based_on_id || '',
    });
  }

  return { proposals, slot };
}

module.exports = {
  generateProposals,
  pickKnowledgeCandidates,
  pickHitExamples,
  loadPersona,
};
