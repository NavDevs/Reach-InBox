import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

async function run() {
  const account = await nodemailer.createTestAccount();
  console.log("New Ethereal Account created:", account.user);
  
  const envPath = path.join(__dirname, '.env');
  let envFile = fs.readFileSync(envPath, 'utf8');
  
  envFile = envFile.replace(/SMTP_USER=.*/, `SMTP_USER=${account.user}`);
  envFile = envFile.replace(/SMTP_PASS=.*/, `SMTP_PASS=${account.pass}`);
  
  fs.writeFileSync(envPath, envFile);
  console.log(".env updated with fresh Ethereal credentials.");
}
run();
