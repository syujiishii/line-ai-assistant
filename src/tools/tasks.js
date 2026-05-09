// タスク管理ツール（Google Sheets をデータベースとして利用）
//
// シートのレイアウト（A1:D1 はヘッダー）:
//   A: タスク名
//   B: 優先度（高 / 中 / 低）
//   C: 期限（YYYY-MM-DD）
//   D: 状態（未完了 / 完了）
const { google } = require('googleapis');
const { getOAuth2Client } = require('../utils/google-auth');

const SHEET_RANGE = 'A2:D'; // ヘッダー行を除いた全データ
const PRIORITY_ORDER = { '高': 0, '中': 1, '低': 2 };

function getSheetsClient() {
  const auth = getOAuth2Client();
  return google.sheets({ version: 'v4', auth });
}

/**
 * 新規タスクを追加
 * @param {string} taskName  タスク名
 * @param {string} priority  優先度（高 / 中 / 低）
 * @param {string} deadline  期限（YYYY-MM-DD）任意
 */
async function addTask(taskName, priority = '中', deadline = '') {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.TASKS_SHEET_ID,
    range: SHEET_RANGE,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[taskName, priority, deadline, '未完了']],
    },
  });

  return `タスクを追加しました: ${taskName}（優先度: ${priority}${deadline ? ` / 期限: ${deadline}` : ''}）`;
}

/**
 * タスク一覧を取得（優先度の高い順にソート）
 * 完了済みは除外
 */
async function getTasks() {
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.TASKS_SHEET_ID,
    range: SHEET_RANGE,
  });

  const rows = res.data.values || [];

  // 行番号を保持しつつ、未完了タスクだけに絞る
  // rowIndex は2始まり（A2が最初のデータ行）
  const tasks = rows
    .map((row, i) => ({
      rowIndex: i + 2,
      name: row[0] || '',
      priority: row[1] || '中',
      deadline: row[2] || '',
      status: row[3] || '未完了',
    }))
    .filter((t) => t.name && t.status !== '完了');

  if (tasks.length === 0) {
    return '未完了のタスクはありません。';
  }

  // 優先度の高い順 → 期限の近い順 で並び替え
  tasks.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 1;
    const pb = PRIORITY_ORDER[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    // 期限なしは後ろに
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });

  const lines = tasks.map((t, i) => {
    const dl = t.deadline ? ` / 期限: ${t.deadline}` : '';
    return `${i + 1}. [${t.priority}] ${t.name}${dl}（行: ${t.rowIndex}）`;
  });

  return `未完了タスク ${tasks.length}件（優先度順）:\n${lines.join('\n')}`;
}

/**
 * タスクを完了状態にする
 * @param {number} rowIndex 完了にする行番号（getTasks で返ってくる「行: N」の数字）
 */
async function completeTask(rowIndex) {
  const sheets = getSheetsClient();

  // 該当行の現在値を取得（タスク名表示用）
  const getRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.TASKS_SHEET_ID,
    range: `A${rowIndex}:D${rowIndex}`,
  });
  const row = (getRes.data.values || [[]])[0];
  if (!row || !row[0]) {
    return `行 ${rowIndex} にタスクが見つかりませんでした。`;
  }

  // D列を「完了」に更新
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.TASKS_SHEET_ID,
    range: `D${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['完了']] },
  });

  return `タスク「${row[0]}」を完了にしました。`;
}

module.exports = {
  addTask,
  getTasks,
  completeTask,
};
