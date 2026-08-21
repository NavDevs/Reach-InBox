import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function run() {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: 'test@example.com',
      subject: 'Test Ethereal',
      text: 'Hello world',
    });
    console.log('Sent! Preview:', nodemailer.getTestMessageUrl(info));
  } catch (e) {
    console.error(e);
  }
}
run();
