// Google Calendar 連携ツール
// - 今日/指定日の予定取得
// - 新規予定の追加
const { google } = require('googleapis');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { getOAuth2Client } = require('../utils/google-auth');

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Tokyo';

/**
 * 指定日（YYYY-MM-DD）の予定を取得
 * 引数なしの場合は今日の予定を返す
 */
async function getScheduleForDate(dateStr) {
  // 日付指定がなければ今日を使用
  const target = dateStr ? dayjs.tz(dateStr, TZ) : dayjs().tz(TZ);

  // その日の0:00から翌日0:00までを範囲指定
  const timeMin = target.startOf('day').toISOString();
  const timeMax = target.add(1, 'day').startOf('day').toISOString();

  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = res.data.items || [];

  if (events.length === 0) {
    return `${target.format('YYYY年MM月DD日')}の予定はありません。`;
  }

  // 人間が読みやすい形に整形
  const lines = events.map((ev) => {
    const start = ev.start.dateTime || ev.start.date;
    const time = ev.start.dateTime
      ? dayjs(ev.start.dateTime).tz(TZ).format('HH:mm')
      : '終日';
    return `・${time} ${ev.summary || '（タイトルなし）'}`;
  });

  return `${target.format('YYYY年MM月DD日')}の予定:\n${lines.join('\n')}`;
}

/**
 * 今日の予定を取得（cronから呼ぶ用にも使う）
 */
async function getTodaySchedule() {
  return getScheduleForDate(null);
}

/**
 * カレンダーに新しい予定を追加
 * @param {string} title 予定タイトル
 * @param {string} startDateTime ISO 8601 形式（例: 2026-05-09T14:00:00+09:00）
 * @param {string} endDateTime   ISO 8601 形式
 * @param {string} description   詳細説明（任意）
 */
async function addCalendarEvent(title, startDateTime, endDateTime, description = '') {
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: title,
    description,
    start: { dateTime: startDateTime, timeZone: TZ },
    end: { dateTime: endDateTime, timeZone: TZ },
  };

  const res = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    requestBody: event,
  });

  const startStr = dayjs(startDateTime).tz(TZ).format('YYYY/MM/DD HH:mm');
  return `予定を追加しました: ${title}（${startStr}〜）\nリンク: ${res.data.htmlLink}`;
}

module.exports = {
  getTodaySchedule,
  getScheduleForDate,
  addCalendarEvent,
};
