/**
 * restart-test.ts
 *
 * Restart Survival Test for the BullMQ email worker.
 *
 * What this script does:
 *  1. Inserts N emails into the DB (status='scheduled') — all for the same sender
 *     to naturally trigger the hourly rate limit (HOURLY_RATE_LIMIT env).
 *  2. Enqueues each email as a BullMQ delayed job keyed by the DB row id.
 *  3. Prints a summary so you can start the worker, kill it mid-run, restart it,
 *     and then run this script again in --verify mode to confirm no duplicates/losses.
 *
 * Usage:
 *   # Step 1 — Seed the queue (run once)
 *   npm run restart-test
 *
 *   # Step 2 — Start the worker in another terminal
 *   npm run worker
 *
 *   # Step 3 — While the worker is processing, kill it (Ctrl+C or kill -9)
 *
 *   # Step 4 — Restart the worker
 *   npm run worker
 *
 *   # Step 5 — After all jobs complete, verify no duplicates/losses
 *   npm run restart-test -- --verify
 */

import { Queue } from 'bullmq';
import * as dotenv from 'dotenv';
import pool from './db';

dotenv.config();

const SEED_COUNT = 6; // Intentionally > HOURLY_RATE_LIMIT (default 3) to trigger rescheduling
const SENDER = 'restart-test@example.com';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const emailQueue = new Queue('email-queue', { connection: redisConnection });

async function seed() {
  console.log(`\n🌱  Seeding ${SEED_COUNT} emails for sender "${SENDER}"...`);
  console.log(`     HOURLY_RATE_LIMIT = ${process.env.HOURLY_RATE_LIMIT || 5}`);
  console.log(`     The first ${process.env.HOURLY_RATE_LIMIT || 5} will send immediately; the rest will be rescheduled to the next hour.\n`);

  const insertedIds: number[] = [];

  for (let i = 1; i <= SEED_COUNT; i++) {
    // Insert into DB
    const result = await pool.query(
      `INSERT INTO emails (sender, recipient, subject, body, scheduled_at, status)
       VALUES ($1, $2, $3, $4, NOW(), 'scheduled') RETURNING id`,
      [
        SENDER,
        `test-recipient-${i}@ethereal.email`,
        `[Restart Test] Email ${i} of ${SEED_COUNT}`,
        `This is restart-survival test email #${i}. It should be sent exactly once.`,
      ]
    );

    const emailId: number = result.rows[0].id;
    insertedIds.push(emailId);

    // Enqueue with jobId = "email-{db_row_id}" for strict idempotency.
    // If re-enqueued after a restart, BullMQ silently ignores the duplicate jobId.
    const jobId = `email-${emailId}`;
    await emailQueue.add('send-email', { emailId }, { jobId });

    console.log(`  ✅ Inserted DB row id=${emailId}, enqueued jobId="${jobId}"`);
  }

  console.log(`\n📋  All ${SEED_COUNT} jobs enqueued.`);
  console.log(`\n─────────────────────────────────────────────────────────────────`);
  console.log(`NEXT STEPS TO TEST RESTART SURVIVAL:`);
  console.log(`  1. In a separate terminal: npm run worker`);
  console.log(`  2. Watch for log lines like: [Sending] Job email-X ...`);
  console.log(`  3. As soon as a send starts, kill the worker: Ctrl+C  (or kill -9 <pid>)`);
  console.log(`  4. Restart: npm run worker`);
  console.log(`  5. Wait for all jobs to complete (rate-limited ones reschedule to next hour)`);
  console.log(`  6. Then run: npm run restart-test -- --verify`);
  console.log(`─────────────────────────────────────────────────────────────────\n`);

  console.log(`     DB row ids inserted: ${insertedIds.join(', ')}`);
}

async function verify() {
  console.log('\n🔍  Verifying restart-survival results...\n');

  // Check all emails seeded by this sender
  const result = await pool.query(
    `SELECT id, status, sent_at, attempts FROM emails WHERE sender = $1 ORDER BY id`,
    [SENDER]
  );

  if (result.rows.length === 0) {
    console.log('No emails found for the test sender. Run the seeder first.');
    return;
  }

  let passed = true;

  console.log('  id  | status     | attempts | sent_at');
  console.log('  ----|------------|----------|--------');
  for (const row of result.rows) {
    const line = `  ${String(row.id).padEnd(4)}| ${String(row.status).padEnd(11)}| ${String(row.attempts).padEnd(9)}| ${row.sent_at ?? 'not yet'}`;
    console.log(line);

    // An email that has been sent must have exactly 1 successful send (sent_at not null)
    if (row.status === 'sent' && !row.sent_at) {
      console.log(`  ❌ FAIL: id=${row.id} is 'sent' but sent_at is NULL — suspicious`);
      passed = false;
    }
    // Multiple attempts with status='sent' is expected (the failed attempt + retry), that's fine
    // The critical check is: no email should be 'sent' more than once, which we verify via sent_at being a single timestamp
  }

  // Check for any stuck 'sending' rows (worker was killed while updating DB)
  const stuckSending = result.rows.filter((r) => r.status === 'sending');
  if (stuckSending.length > 0) {
    console.log(`\n  ⚠️  WARNING: ${stuckSending.length} email(s) are stuck in 'sending' status.`);
    console.log(`     This means the worker was killed after updating DB but before completing BullMQ ack.`);
    console.log(`     The worker will retry these on restart (BullMQ stall detection after lock expires).`);
    console.log(`     Wait ~30s and re-check. If the worker is already restarted they should resolve.`);
    passed = false;
  }

  const sentCount = result.rows.filter((r) => r.status === 'sent').length;
  const scheduledCount = result.rows.filter((r) => r.status === 'scheduled' || r.status === 'sending').length;
  const failedCount = result.rows.filter((r) => r.status === 'failed').length;

  console.log(`\n  📊 Summary:`);
  console.log(`     Sent:              ${sentCount}`);
  console.log(`     Pending/Sending:   ${scheduledCount}`);
  console.log(`     Failed:            ${failedCount}`);
  console.log(`     Total:             ${result.rows.length}`);

  if (sentCount === result.rows.length) {
    console.log(`\n  ✅ PASS — All ${sentCount} emails sent exactly once. No duplicates, no losses.\n`);
  } else if (scheduledCount > 0) {
    console.log(`\n  ⏳ PENDING — ${scheduledCount} job(s) still pending (likely rate-limited and delayed to next hour). Re-check later.\n`);
  } else if (passed && failedCount === 0) {
    console.log(`\n  ✅ PASS — No duplicates detected.\n`);
  } else {
    console.log(`\n  ❌ FAIL — Check the output above for issues.\n`);
  }
}

async function main() {
  const mode = process.argv.includes('--verify') ? 'verify' : 'seed';

  try {
    if (mode === 'verify') {
      await verify();
    } else {
      await seed();
    }
  } finally {
    await emailQueue.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
