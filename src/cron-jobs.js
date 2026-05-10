// 定期実行ジョブ
// - 毎朝8時: 今日の予定通知（既存）
// - 7:00/11:30/16:30: Threads投稿案を生成→LINE送信
// - 9:00/12:00/18:00: scheduled状態の投稿をThreadsに投稿
// - 2:00: 過去30日の投稿メトリクス更新
const cron = require('node-cron');
const { getTodaySchedule } = require('./tools/calendar');
const { pushToUser, lineClient } = require('./line-handler');
const {
  generateProposalsRaw,
  postToThreadsRaw,
  collectMetricsRaw,
} = require('./tools/threads-post');
const {
  buildProposalsMessage,
  buildPostedNotification,
  slotLabel,
} = require('./flex-templates');

const TZ = 'Asia/Tokyo';

/**
 * cronスケジュール文字列を作る（"HH:MM" → "MM HH * * *"）
 */
function timeToCron(hhmm) {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  return `${m} ${h} * * *`;
}

/**
 * cronジョブのエラー通知LINE
 */
async function notifyError(featureName, err) {
  console.error(`[cron] ${featureName} エラー:`, err);
  try {
    await pushToUser(
      process.env.LINE_USER_ID,
      `⚠️ ${featureName}でエラー: ${err.message || err}`,
    );
  } catch (e) {
    console.error('[cron] エラー通知送信失敗:', e);
  }
}

// ============== 投稿案生成→LINE送信 ==============
async function runGenerateAndSend(slot) {
  console.log(`[cron] generate_post_proposals(${slot}) 実行`);
  try {
    const result = await generateProposalsRaw(slot);
    if (!result.proposals || result.proposals.length === 0) {
      console.warn(`[cron] ${slot} 投稿案ゼロ`);
      return;
    }
    const flex = buildProposalsMessage(result.proposals, slot);
    if (process.env.LINE_USER_ID && lineClient) {
      await lineClient.pushMessage(process.env.LINE_USER_ID, flex);
    }
  } catch (err) {
    await notifyError(`投稿案生成(${slot})`, err);
  }
}

// ============== 投稿実行 ==============
async function runPost(slot) {
  console.log(`[cron] post_to_threads(${slot}) 実行`);
  try {
    const result = await postToThreadsRaw(slot);
    if (process.env.LINE_USER_ID && lineClient && result && result.text) {
      const flex = buildPostedNotification(result);
      await lineClient.pushMessage(process.env.LINE_USER_ID, flex);
    } else if (result && result.message) {
      await pushToUser(process.env.LINE_USER_ID, `${slotLabel(slot)} ${result.message}`);
    }
  } catch (err) {
    await notifyError(`Threads投稿(${slot})`, err);
  }
}

// ============== メトリクス収集 ==============
async function runCollectMetrics() {
  console.log('[cron] collect_metrics 実行');
  try {
    const msg = await collectMetricsRaw();
    console.log('[cron] metrics:', msg);
  } catch (err) {
    await notifyError('メトリクス収集', err);
  }
}

function startCronJobs() {
  // ====== 既存: 毎朝8時の予定通知 ======
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
    { timezone: TZ }
  );

  // ====== Threads: 投稿案生成 ======
  const proposalTimes = (process.env.PROPOSAL_TIMES || '07:00,11:30,16:30').split(',');
  const slots = ['morning', 'noon', 'evening'];
  proposalTimes.forEach((t, i) => {
    if (!slots[i]) return;
    cron.schedule(timeToCron(t.trim()), () => runGenerateAndSend(slots[i]), { timezone: TZ });
  });

  // ====== Threads: 投稿実行 ======
  const postTimes = (process.env.POST_TIMES || '09:00,12:00,18:00').split(',');
  postTimes.forEach((t, i) => {
    if (!slots[i]) return;
    cron.schedule(timeToCron(t.trim()), () => runPost(slots[i]), { timezone: TZ });
  });

  // ====== Threads: メトリクス収集（深夜2:00） ======
  cron.schedule('0 2 * * *', runCollectMetrics, { timezone: TZ });

  console.log(`[cron] スケジューラ起動:
  - 毎朝8:00 予定通知
  - ${proposalTimes.join('/')} 投稿案生成
  - ${postTimes.join('/')} Threads投稿実行
  - 2:00 メトリクス収集`);
}

module.exports = {
  startCronJobs,
  // テスト用に個別関数も export
  runGenerateAndSend,
  runPost,
  runCollectMetrics,
};
