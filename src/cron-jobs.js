// 定期実行ジョブ（毎朝8時に今日の予定をLINEに通知）
const cron = require('node-cron');
const { getTodaySchedule } = require('./tools/calendar');
const { pushToUser } = require('./line-handler');

function startCronJobs() {
  // 毎日 朝8:00 (Asia/Tokyo)
  cron.schedule(
    '0 8 * * *',
    async () => {
      console.log('[cron] 毎朝8時の予定通知を実行');
      try {
        const schedule = await getTodaySchedule();
        const message = `おはようございます☀\n\n${schedule}\n\n今日も一日頑張りましょう！`;
        await pushToUser(process.env.LINE_USER_ID, message);
      } catch (err) {
        console.error('[cron] 朝の通知エラー:', err);
        await pushToUser(
          process.env.LINE_USER_ID,
          'エラーが発生しました。もう一度お試しください'
        );
      }
    },
    {
      timezone: 'Asia/Tokyo',
    }
  );

  console.log('[cron] スケジューラを起動しました（毎朝8:00 Asia/Tokyo）');
}

module.exports = { startCronJobs };
