const API_URL = 'http://localhost:3000/api/emails/schedule';
const TOTAL_EMAILS = 1000;
const CONCURRENT_REQUESTS = 50;

async function runLoadTest() {
  console.log(`Starting load test: Scheduling ${TOTAL_EMAILS} emails...`);
  
  // Use a future timestamp (e.g., 10 seconds from now)
  const scheduledAt = new Date(Date.now() + 10000).toISOString();
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < TOTAL_EMAILS; i += CONCURRENT_REQUESTS) {
    const batch = [];
    const batchSize = Math.min(CONCURRENT_REQUESTS, TOTAL_EMAILS - i);
    
    for (let j = 0; j < batchSize; j++) {
      const emailId = i + j + 1;
      batch.push(
        fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: `Load Test Email ${emailId}`,
            body: `This is a test email #${emailId}`,
            recipients: [{ email: `user${emailId}@example.com` }],
            startTime: scheduledAt
          })
        })
        .then(async (res) => {
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
            const data = await res.json().catch(() => ({}));
            console.error(`Failed to schedule email ${emailId}:`, data.error || res.statusText);
          }
        })
        .catch((err) => {
          failCount++;
          console.error(`Failed to schedule email ${emailId}:`, err.message);
        })
      );
    }
    
    await Promise.all(batch);
    console.log(`Progress: ${Math.min(i + CONCURRENT_REQUESTS, TOTAL_EMAILS)}/${TOTAL_EMAILS} emails scheduled...`);
  }
  
  console.log('\nLoad test scheduling completed!');
  console.log(`Successfully scheduled: ${successCount}`);
  console.log(`Failed to schedule: ${failCount}`);
  console.log('\nCheck your worker logs (e.g. `npm run worker` or Docker logs) to see the rate limiting and rescheduling behavior.');
}

runLoadTest();
