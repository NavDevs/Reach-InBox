import { emailQueue } from './queue';
import pool from './db';

async function run() {
  const res = await pool.query("SELECT * FROM emails WHERE status = 'scheduled'");
  console.log(`Found ${res.rows.length} scheduled emails to re-queue.`);
  for (const email of res.rows) {
    const jobDelay = Math.max(0, new Date(email.scheduled_at).getTime() - Date.now());
    try {
      await emailQueue.add('send-email', { emailId: email.id }, { delay: jobDelay, jobId: `email-${email.id}` });
      console.log(`✅ Enqueued email ${email.id} (${email.recipient}) with delay ${jobDelay}ms`);
    } catch (e: any) {
      // Job already exists in queue — skip silently
      if (e?.message?.includes('already exists')) {
        console.log(`⏭ Skipped email ${email.id} — already in queue`);
      } else {
        console.error(`❌ Failed to enqueue email ${email.id}:`, e.message);
      }
    }
  }
  console.log('Done.');
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
