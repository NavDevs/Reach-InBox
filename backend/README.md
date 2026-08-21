# Email Scheduler Worker

This project implements a BullMQ worker designed for robust, rate-limited email delivery using Node.js, PostgreSQL, Redis, and Ethereal Email.

## Features

- **BullMQ Integration**: Robust delayed jobs management.
- **Idempotency**: Jobs are keyed by the database row ID (`jobId: email-${emailId}`). Retries caused by crashes will not duplicate emails if the database is already marked as `sent`.
- **Hourly Rate Limiting**: Per-sender Redis hour-bucket keys (`rate_limit:{sender}:{YYYY-MM-DD-HH}`). Jobs that hit the limit are rescheduled using `job.moveToDelayed` to the next hour.
- **Restart Survival**: The worker employs BullMQ's stall detection mechanism (`lockDuration`, `stalledInterval`). If the worker crashes mid-flight, incomplete jobs are automatically recovered and reprocessed. Redis is configured with AOF to ensure state survives container restarts.
- **Minimum Delay**: Configurable delay between sends to prevent overwhelming SMTP servers.

## Setup Instructions

1.  **Dependencies**:
    ```bash
    npm install
    ```
2.  **Environment Setup**:
    Copy `.env.example` to `.env` and fill in your Ethereal Email credentials (get them at [ethereal.email](https://ethereal.email/create)).
    ```bash
    cp .env.example .env
    ```
3.  **Start Services**:
    Start Postgres and Redis via Docker Compose:
    ```bash
    docker-compose up -d
    ```
4.  **Start API and Worker**:
    In one terminal:
    ```bash
    npm start
    ```
    In another terminal:
    ```bash
    npm run worker
    ```

## Testing Restart Survival

A dedicated test script is provided to verify that the worker correctly survives unexpected crashes without losing jobs or sending duplicates.

1.  **Seed Jobs**:
    ```bash
    npm run restart-test
    ```
2.  **Start Worker & Kill Mid-Run**:
    ```bash
    npm run worker
    ```
    *Wait for the `[Sending]` log to appear, then immediately press `Ctrl+C`.*
3.  **Restart Worker**:
    ```bash
    npm run worker
    ```
    *Observe the `[Stalled]` logs indicating the aborted jobs being recovered.*
4.  **Verify State**:
    Once processing finishes, run the verifier:
    ```bash
    npm run restart-test -- --verify
    ```
    *You should see a `✅ PASS` message indicating no duplicates or lost emails.*
