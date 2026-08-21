import express, { Request, Response } from 'express';
import cors from 'cors';
import pool from './db';
import { emailQueue } from './queue';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Frontend-facing API endpoints (used by ComposeModal & EmailsTable)
// ---------------------------------------------------------------------------

/**
 * POST /api/emails/schedule
 * Accepts bulk scheduling from the ComposeModal:
 *   { subject, body, recipients: [{email, name?, ...}], startTime, delay, hourlyLimit }
 * Each recipient row becomes a separate email record + BullMQ job.
 */
app.post('/api/emails/schedule', async (req: Request, res: Response) => {
  const { subject, body, recipients, startTime, delay: delaySec, hourlyLimit, userEmail } = req.body;

  if (!subject || !body || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Missing required fields (subject, body, recipients[])' });
  }

  const scheduledDate = startTime ? new Date(startTime) : new Date();
  if (isNaN(scheduledDate.getTime())) {
    return res.status(400).json({ error: 'Invalid startTime date format' });
  }

  // Default sender – using authenticated SMTP user for Gmail compatibility
  const sender = process.env.SMTP_USER || 'scheduler@reachinbox.app';
  const delayBetweenMs = (delaySec || 1) * 1000; // seconds → ms

  try {
    // 1. Extract and validate recipient emails
    const validRecipients: { email: string; scheduledAt: Date }[] = [];
    for (let i = 0; i < recipients.length; i++) {
      const recipientRow = recipients[i];
      const recipientEmail = (
        recipientRow.email ||
        recipientRow.Email ||
        recipientRow.EMAIL ||
        Object.values(recipientRow)[0] ||
        ''
      ).toString().trim();

      if (recipientEmail && recipientEmail.includes('@')) {
        const emailScheduledAt = new Date(scheduledDate.getTime() + validRecipients.length * delayBetweenMs);
        validRecipients.push({ email: recipientEmail, scheduledAt: emailScheduledAt });
      }
    }

    if (validRecipients.length === 0) {
      return res.status(400).json({ error: 'No valid recipient email addresses found in CSV' });
    }

    // 2. High-performance single multi-row SQL INSERT
    const valuePlaceholders: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    for (const r of validRecipients) {
      valuePlaceholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6})`
      );
      queryParams.push(
        sender,
        r.email,
        subject,
        body,
        r.scheduledAt,
        'scheduled',
        userEmail || null
      );
      paramIndex += 7;
    }

    const insertSql = `
      INSERT INTO emails (sender, recipient, subject, body, scheduled_at, status, user_email)
      VALUES ${valuePlaceholders.join(', ')}
      RETURNING id, scheduled_at
    `;

    const dbResult = await pool.query(insertSql, queryParams);
    const parsedHourlyLimit = parseInt(hourlyLimit, 10) || parseInt(process.env.HOURLY_RATE_LIMIT || '100', 10);
    const batchId = Date.now().toString();

    // 3. Batch insert into BullMQ queue via addBulk (1 single atomic Redis pipeline)
    const bulkJobs = dbResult.rows.map((row: any) => {
      const jobDelay = Math.max(0, new Date(row.scheduled_at).getTime() - Date.now());
      return {
        name: 'send-email',
        data: {
          emailId: row.id,
          hourlyLimit: parsedHourlyLimit,
          batchId: batchId,
        },
        opts: {
          delay: jobDelay,
          jobId: `email-${row.id}`,
        },
      };
    });

    await emailQueue.addBulk(bulkJobs);

    res.status(201).json({
      message: `${dbResult.rows.length} emails scheduled successfully`,
      count: dbResult.rows.length,
    });
  } catch (error) {
    console.error('Error bulk-scheduling emails:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/emails/scheduled – emails waiting to be sent
 */
app.get('/api/emails/scheduled', async (req: Request, res: Response) => {
  try {
    const { userEmail } = req.query;
    const result = userEmail
      ? await pool.query(
          `SELECT * FROM emails WHERE status IN ('scheduled', 'sending') AND user_email = $1
           ORDER BY scheduled_at ASC`, [userEmail])
      : await pool.query(
          `SELECT * FROM emails WHERE status IN ('scheduled', 'sending')
           ORDER BY scheduled_at ASC`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scheduled emails:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/emails/sent – emails that have been delivered
 */
app.get('/api/emails/sent', async (req: Request, res: Response) => {
  try {
    const { userEmail } = req.query;
    const result = userEmail
      ? await pool.query(
          `SELECT * FROM emails WHERE status IN ('sent', 'failed') AND user_email = $1
           ORDER BY COALESCE(sent_at, scheduled_at) DESC`, [userEmail])
      : await pool.query(
          `SELECT * FROM emails WHERE status IN ('sent', 'failed')
           ORDER BY COALESCE(sent_at, scheduled_at) DESC`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sent emails:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/emails/all – full history (all statuses)
 */
app.get('/api/emails/all', async (req: Request, res: Response) => {
  try {
    const { userEmail } = req.query;
    const result = userEmail
      ? await pool.query(
          `SELECT * FROM emails WHERE user_email = $1 ORDER BY created_at DESC`, [userEmail])
      : await pool.query(
          `SELECT * FROM emails ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all emails:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/credentials – dynamically return active Ethereal SMTP test credentials
 */
app.get('/api/credentials', async (_req: Request, res: Response) => {
  res.json({
    email: process.env.SMTP_USER || 'cxd2oiifqnd44ang@ethereal.email',
    pass: process.env.SMTP_PASS || 'qJgFpDhNCKhgjpPB6h',
    loginUrl: 'https://ethereal.email/login',
    messagesUrl: 'https://ethereal.email/messages'
  });
});


/**
 * POST /api/reset – flush Redis rate-limit counters & re-queue delayed emails
 */
app.post('/api/reset', async (_req: Request, res: Response) => {
  try {
    const Redis = require('ioredis');
    const redis = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL)
      : new Redis({ host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379', 10) });

    // Flush all rate_limit keys
    const keys = await redis.keys('rate_limit:*');
    if (keys.length > 0) await redis.del(...keys);

    // Reset any delayed/scheduled emails back to "now" so worker picks them up
    await pool.query(
      `UPDATE emails SET scheduled_at = NOW() WHERE status = 'scheduled'`
    );

    // Re-queue them in BullMQ
    const result = await pool.query(`SELECT id FROM emails WHERE status = 'scheduled'`);
    for (const row of result.rows) {
      await emailQueue.add('send-email', { emailId: row.id, hourlyLimit: 9999 }, { jobId: `email-${row.id}-reset-${Date.now()}` });
    }

    await redis.quit();
    res.json({ message: `Flushed ${keys.length} rate-limit keys, re-queued ${result.rows.length} emails` });
  } catch (error) {
    console.error('Error resetting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
