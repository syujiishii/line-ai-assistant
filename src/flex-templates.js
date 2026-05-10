// LINE Flex Message テンプレート集
// 投稿案カルーセル / 投稿完了通知 / 知識保存通知

const SLOT_META = {
  morning: { emoji: '☀️', label: '朝', time: '09:00' },
  noon: { emoji: '☕', label: '昼', time: '12:00' },
  evening: { emoji: '🌙', label: '夕', time: '18:00' },
};

/**
 * 投稿案カルーセル（3案）
 * @param {Array<{id, text, type}>} proposals
 * @param {'morning'|'noon'|'evening'} slot
 */
function buildProposalsMessage(proposals, slot) {
  const meta = SLOT_META[slot] || SLOT_META.morning;

  const bubbles = proposals.map((p, idx) => ({
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      backgroundColor: '#1F2D5C',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: `${meta.emoji} 案${idx + 1}`,
              color: '#FFFFFF',
              weight: 'bold',
              size: 'lg',
              flex: 1,
            },
            {
              type: 'text',
              text: p.type || '',
              color: '#C7D2E8',
              size: 'sm',
              align: 'end',
              gravity: 'center',
            },
          ],
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'text',
          text: p.text || '',
          wrap: true,
          size: 'lg',
          color: '#222222',
        },
        {
          type: 'text',
          text: `${(p.text || '').length} 文字`,
          size: 'xs',
          color: '#888888',
          align: 'end',
          margin: 'md',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#1F2D5C',
          height: 'sm',
          action: {
            type: 'postback',
            label: 'この案で投稿',
            data: `select:${p.id}`,
            displayText: `案${idx + 1}を選択`,
          },
        },
      ],
    },
  }));

  // フッター: 再生成・スキップボタン用の追加バブル
  bubbles.push({
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: 'ピンとこない？',
          weight: 'bold',
          size: 'md',
          align: 'center',
        },
        {
          type: 'separator',
          margin: 'md',
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: '🔄 別案を生成',
            data: `regenerate:${slot}`,
            displayText: '別の案を作って',
          },
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: '⏭ この回はスキップ',
            data: `skip:${slot}`,
            displayText: 'スキップ',
          },
        },
      ],
    },
  });

  return {
    type: 'flex',
    altText: `${meta.emoji} ${meta.label}の投稿案 ${proposals.length}件`,
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}

/**
 * 投稿完了通知
 */
function buildPostedNotification(post) {
  const isFallback = post.mode === 'fallback';
  const headerColor = isFallback ? '#888888' : '#1F2D5C';
  const headerText = isFallback ? '📋 コピペ用テキスト' : '✅ Threadsに投稿完了';

  const contents = [
    {
      type: 'text',
      text: post.text || '',
      wrap: true,
      size: 'md',
      color: '#222222',
    },
  ];

  if (!isFallback && post.url) {
    contents.push({
      type: 'separator',
      margin: 'md',
    });
    contents.push({
      type: 'button',
      style: 'link',
      height: 'sm',
      margin: 'md',
      action: {
        type: 'uri',
        label: 'Threadsで開く →',
        uri: post.url,
      },
    });
  } else if (isFallback) {
    contents.push({
      type: 'text',
      text: '☝️これコピーしてThreadsに投稿してな',
      wrap: true,
      size: 'sm',
      color: '#888888',
      margin: 'md',
    });
  }

  return {
    type: 'flex',
    altText: headerText,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        backgroundColor: headerColor,
        contents: [
          {
            type: 'text',
            text: headerText,
            color: '#FFFFFF',
            weight: 'bold',
            size: 'md',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        contents,
      },
    },
  };
}

/**
 * 知識保存完了通知
 */
function buildKnowledgeSavedMessage(title, category, summary) {
  return {
    type: 'flex',
    altText: `📚 「${title}」を保存したで`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '14px',
        backgroundColor: '#0A8754',
        contents: [
          {
            type: 'text',
            text: '📚 知識ベースに保存',
            color: '#FFFFFF',
            weight: 'bold',
            size: 'md',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: title || '',
            weight: 'bold',
            size: 'lg',
            wrap: true,
          },
          ...(category ? [{
            type: 'text',
            text: `カテゴリ: ${category}`,
            size: 'xs',
            color: '#888888',
          }] : []),
          ...(summary ? [{
            type: 'text',
            text: summary,
            size: 'sm',
            color: '#444444',
            wrap: true,
            margin: 'md',
          }] : []),
        ],
      },
    },
  };
}

function slotLabel(slot) {
  const meta = SLOT_META[slot];
  return meta ? `${meta.emoji}${meta.label}` : slot;
}

module.exports = {
  buildProposalsMessage,
  buildPostedNotification,
  buildKnowledgeSavedMessage,
  slotLabel,
  SLOT_META,
};
