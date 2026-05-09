// Claude Tool Use 用のツール定義 + 実行ディスパッチャ
//
// toolDefinitions: Claude API に渡すツールのスキーマ一覧
// executeTool:     Claude が呼んだツール名を実際の関数にマッピングして実行
const calendar = require('./calendar');
const invoice = require('./invoice');
const instagram = require('./instagram');
const tasks = require('./tasks');

// ---------- Claude に渡すツールの JSON Schema 定義 ----------
const toolDefinitions = [
  {
    name: 'get_today_schedule',
    description: '今日のGoogleカレンダーの予定を取得します。日付を指定したい場合は date を YYYY-MM-DD 形式で渡してください。明日の予定もこのツールで取得できます。',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: '取得したい日付（YYYY-MM-DD形式）。省略時は今日。例: 2026-05-10',
        },
      },
      required: [],
    },
  },
  {
    name: 'add_calendar_event',
    description: 'Googleカレンダーに新しい予定を追加します。',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '予定のタイトル' },
        start_datetime: {
          type: 'string',
          description: '開始日時（ISO 8601、例: 2026-05-10T14:00:00+09:00）',
        },
        end_datetime: {
          type: 'string',
          description: '終了日時（ISO 8601、例: 2026-05-10T15:00:00+09:00）',
        },
        description: { type: 'string', description: '予定の詳細説明（任意）' },
      },
      required: ['title', 'start_datetime', 'end_datetime'],
    },
  },
  {
    name: 'create_invoice',
    description: '請求書を作成し、PDFのダウンロードリンクを返します。',
    input_schema: {
      type: 'object',
      properties: {
        client_name: { type: 'string', description: '請求先の会社名/個人名' },
        subject: { type: 'string', description: '請求件名（例: Webサイト制作費）' },
        amount: { type: 'number', description: '金額（円、税込）' },
        issue_date: {
          type: 'string',
          description: '発行日（YYYY-MM-DD）。省略時は今日',
        },
      },
      required: ['client_name', 'subject', 'amount'],
    },
  },
  {
    name: 'get_instagram_comments',
    description: 'Instagramの未返信コメント一覧を取得します。返信したいコメントのIDを確認するために使用します。',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: '取得する最大件数（デフォルト10）',
        },
      },
      required: [],
    },
  },
  {
    name: 'reply_instagram_comment',
    description: '指定したInstagramコメントに返信します。事前に get_instagram_comments で comment_id を確認してください。',
    input_schema: {
      type: 'object',
      properties: {
        comment_id: { type: 'string', description: '返信先のコメントID' },
        message: { type: 'string', description: '返信本文' },
      },
      required: ['comment_id', 'message'],
    },
  },
  {
    name: 'add_task',
    description: 'タスクを追加します。',
    input_schema: {
      type: 'object',
      properties: {
        task_name: { type: 'string', description: 'タスク名' },
        priority: {
          type: 'string',
          enum: ['高', '中', '低'],
          description: '優先度（高/中/低）。省略時は中',
        },
        deadline: {
          type: 'string',
          description: '期限（YYYY-MM-DD）。任意',
        },
      },
      required: ['task_name'],
    },
  },
  {
    name: 'get_tasks',
    description: '未完了のタスク一覧を優先度の高い順に取得します。',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'complete_task',
    description: '指定した行番号のタスクを完了状態にします。事前に get_tasks で行番号を確認してください。',
    input_schema: {
      type: 'object',
      properties: {
        row_index: {
          type: 'integer',
          description: '完了にするタスクの行番号（get_tasks の出力にある「行: N」の数字）',
        },
      },
      required: ['row_index'],
    },
  },
];

// ---------- ツール実行ディスパッチャ ----------
async function executeTool(name, input) {
  switch (name) {
    case 'get_today_schedule':
      return await calendar.getScheduleForDate(input.date || null);

    case 'add_calendar_event':
      return await calendar.addCalendarEvent(
        input.title,
        input.start_datetime,
        input.end_datetime,
        input.description || ''
      );

    case 'create_invoice':
      return await invoice.createInvoice(
        input.client_name,
        input.subject,
        input.amount,
        input.issue_date || null
      );

    case 'get_instagram_comments':
      return await instagram.getInstagramComments(input.limit || 10);

    case 'reply_instagram_comment':
      return await instagram.replyInstagramComment(input.comment_id, input.message);

    case 'add_task':
      return await tasks.addTask(
        input.task_name,
        input.priority || '中',
        input.deadline || ''
      );

    case 'get_tasks':
      return await tasks.getTasks();

    case 'complete_task':
      return await tasks.completeTask(input.row_index);

    default:
      throw new Error(`未知のツール: ${name}`);
  }
}

module.exports = {
  toolDefinitions,
  executeTool,
};
