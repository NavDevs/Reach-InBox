import { Worker, Job, DelayedError } from 'bullmq';
import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import Redis from 'ioredis';
import pool from './db';

dotenv.config();

// ──────────────────────────────────────────────
// Config from environment
// ──────────────────────────────────────────────
const HOURLY_RATE_LIMIT = parseInt(process.env.HOURLY_RATE_LIMIT || '5', 10);
const CONCURRENCY       = 1; // Strict 1 to prevent Ethereal SMTP 429 limits
const MIN_DELAY_MS      = parseInt(process.env.MIN_DELAY_MS || '1000', 10);

// How long BullMQ holds a job lock while processing (ms).
// If the worker dies and doesn't renew the lock within this window, the job
// is marked "stalled" and re-queued by the next worker — enabling restart survival.
// Lower value = faster recovery in tests; increase for production.
const LOCK_DURATION_MS     = parseInt(process.env.LOCK_DURATION_MS || '30000', 10);
// How often BullMQ checks for stalled jobs (ms). Must be < LOCK_DURATION_MS.
const STALLED_INTERVAL_MS  = parseInt(process.env.STALLED_INTERVAL_MS || '15000', 10);
// Max number of times a stalled job can be automatically recovered before being failed.
const MAX_STALLED_COUNT    = parseInt(process.env.MAX_STALLED_COUNT || '2', 10);

// ──────────────────────────────────────────────
// Redis client (for rate-limit counters)
// ──────────────────────────────────────────────
const redisOpts = process.env.REDIS_URL
  ? { maxRetriesPerRequest: null }
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: null,
    };

// Separate Redis client for rate-limit key operations.
// BullMQ manages its own internal connection via `connection` option.
const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, redisOpts)
  : new Redis(redisOpts as any);

// ──────────────────────────────────────────────
// Nodemailer / Ethereal SMTP
// ──────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Returns the Redis key for the sender's current hour bucket. */
function rateLimitKey(sender: string): string {
  const now   = new Date();
  const year  = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day   = String(now.getUTCDate()).padStart(2, '0');
  const hour  = String(now.getUTCHours()).padStart(2, '0');
  return `rate_limit:${sender}:${year}-${month}-${day}-${hour}`;
}

/** Returns the Unix-ms timestamp of the next UTC hour boundary (+ optional jitter). */
function nextHourTimestamp(jitterMs = 5000): number {
  const now      = new Date();
  const nextHour = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1, 0, 0, 0)
  );
  const jitter = Math.floor(Math.random() * jitterMs);
  return nextHour.getTime() + jitter;
}

// ──────────────────────────────────────────────
// Job Processor
// ──────────────────────────────────────────────
async function processEmailJob(job: Job): Promise<{ success: boolean; messageId?: string }> {
  const { emailId } = job.data as { emailId: number };

  // ── Step 1: Fetch DB record ──────────────────
  const dbRes = await pool.query('SELECT * FROM emails WHERE id = $1', [emailId]);
  if (dbRes.rows.length === 0) {
    // Row deleted externally — nothing to do, complete cleanly.
    console.log(`[Skip] Job ${job.id}: DB row ${emailId} not found.`);
    return { success: false };
  }
  const email = dbRes.rows[0];

  // ── Step 2: Idempotency guard ─────────────────
  // If this job was retried after a crash that happened *after* the DB write
  // but *before* BullMQ received the completion ack, we must not send again.
  if (email.status === 'sent') {
    console.log(`[Skip] Job ${job.id}: Email ${emailId} already marked 'sent' in DB. Skipping duplicate send.`);
    return { success: true };
  }

  const sender = (email.user_email || email.sender || 'default') as string;
  const to     = email.recipient as string;

  // ── Step 3: Redis hourly rate-limit check (Atomic) ─────
  const bucketKey = rateLimitKey(sender);
  const effectiveLimit = parseInt(job.data?.hourlyLimit, 10) || HOURLY_RATE_LIMIT;
  
  // Atomically increment the counter
  const currentCount = await redisClient.incr(bucketKey);
  if (currentCount === 1) {
    await redisClient.expire(bucketKey, 3600);
  }

  if (currentCount > effectiveLimit) {
    // We exceeded the limit, so undo the increment and reschedule
    await redisClient.decr(bucketKey);
    
    const rescheduleAt = nextHourTimestamp();
    const inMs = rescheduleAt - Date.now();
    console.log(
      `[Rate Limit] Job ${job.id} | sender="${sender}" hit limit of ${effectiveLimit}/hr. ` +
      `Rescheduling to next hour in ~${Math.round(inMs / 60000)}m.`
    );

    // Update the database so the frontend UI shows the new scheduled time
    await pool.query(
      `UPDATE emails SET scheduled_at = to_timestamp($1) WHERE id = $2`,
      [rescheduleAt / 1000, emailId]
    );

    await job.moveToDelayed(rescheduleAt, job.token!);
    throw new DelayedError();
  }

  // ── Step 4: Mark 'sending' in DB ─────────────
  // This lets the verify script detect a crash-during-send scenario.
  await pool.query(
    'UPDATE emails SET status = $1, attempts = attempts + 1 WHERE id = $2',
    ['sending', emailId]
  );

  // ── Step 5: Minimum inter-send delay ─────────
  // Prevents SMTP server overload. Measured from when the job starts processing,
  // so in practice the delay is per-concurrency-slot (not global clock time).
  if (MIN_DELAY_MS > 0) {
    await sleep(MIN_DELAY_MS);
  }

  await job.updateProgress(50);
  console.log(`[Sending] Job ${job.id} — email id=${emailId} → ${to}`);

  // ── Step 6: Send via Ethereal SMTP ───────────
  try {
    const payload = {
      to,
      subject: email.subject,
      text: email.body,
    };
    
    // Bypass Render SMTP firewall by relaying through Vercel!
    const relayRes = await fetch('https://reach-in-box-pied.vercel.app/api/relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!relayRes.ok) {
      const errBody = await relayRes.text();
      throw new Error(`Relay failed (${relayRes.status}): ${errBody}`);
    }
    const relayData = await relayRes.json();
    const info = { messageId: relayData.messageId };

    // ── Step 7: Persist success & update counter ─
    await pool.query(
      'UPDATE emails SET status = $1, sent_at = NOW() WHERE id = $2',
      ['sent', emailId]
    );

    // We already updated the rate limit counter atomically in Step 3!

    await job.updateProgress(100);
    console.log(`[Success] Job ${job.id} — sent, messageId=${info.messageId}`);
    const previewURL = (info as any).previewURL;
    if (previewURL) {
      console.log(`          Preview:   ${previewURL}`);
    }

    return { success: true, messageId: info.messageId };
  } catch (smtpError: any) {
    // Revert DB status so it's clear the email was not sent.
    await pool.query(
      "UPDATE emails SET status = 'failed' WHERE id = $1",
      [emailId]
    );
    console.error(`[Error] Job ${job.id} SMTP failure:`, smtpError.message);
    throw smtpError; // BullMQ will retry per queue default-job-options
  }
}

// ──────────────────────────────────────────────
// Worker Instantiation
// ──────────────────────────────────────────────
export const worker = new Worker('email-queue', processEmailJob, {
  connection: redisClient,
  concurrency: 1,

  // Lock & stall settings — the core of restart-survival:
  // If the worker process dies, any job whose lock is not renewed within
  // lockDuration ms will be automatically picked up and retried.
  lockDuration:    LOCK_DURATION_MS,
  stalledInterval: STALLED_INTERVAL_MS,
  maxStalledCount: MAX_STALLED_COUNT,
});

// ──────────────────────────────────────────────
// Worker Event Listeners
// ──────────────────────────────────────────────
worker.on('completed', (job) => {
  console.log(`[✓ Done] Job ${job.id} completed.`);
});

worker.on('failed', (job, err) => {
  // DelayedError is thrown intentionally when we reschedule — not a real failure.
  if (err.name === 'DelayedError') return;
  console.error(`[✗ Fail] Job ${job?.id} failed: ${err.message}`);
});

worker.on('stalled', (jobId) => {
  // This fires when the previous worker died mid-job and this worker picks it up.
  console.warn(`[Stalled] Job ${jobId} was stalled (worker died mid-run) — re-processing now.`);
});

worker.on('error', (err) => {
  console.error('[Worker Error]', err.message);
});

// ──────────────────────────────────────────────
// Startup Banner
// ──────────────────────────────────────────────
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  BullMQ Email Worker started');
console.log(`  Concurrency:        ${CONCURRENCY}`);
console.log(`  Hourly rate limit:  ${HOURLY_RATE_LIMIT} emails / sender / hour`);
console.log(`  Min delay:          ${MIN_DELAY_MS}ms between sends`);
console.log(`  Lock duration:      ${LOCK_DURATION_MS}ms`);
console.log(`  Stalled interval:   ${STALLED_INTERVAL_MS}ms`);
console.log('  Waiting for jobs...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// ──────────────────────────────────────────────
// Graceful Shutdown
// ──────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n[Shutdown] Received ${signal}. Draining worker gracefully...`);
  // worker.close() waits for the currently-executing job to finish,
  // then releases locks cleanly so no stalling occurs on a graceful SIGINT.
  await worker.close();
  await redisClient.quit();
  await pool.end();
  console.log('[Shutdown] Done.');
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
