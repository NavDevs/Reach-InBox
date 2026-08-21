import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const SMTP_USER = process.env.SMTP_USER || 'cxd2oiifqnd44ang@ethereal.email';
const SMTP_PASS = process.env.SMTP_PASS || 'qJgFpDhNCKhgjpPB6h';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.ethereal.email';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);

export async function GET() {
  return NextResponse.json({
    email: SMTP_USER,
    pass: SMTP_PASS,
    loginUrl: 'https://ethereal.email/login',
    messagesUrl: 'https://ethereal.email/messages'
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, text } = body;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    const info = await transporter.sendMail({
      from: `"ReachInbox Scheduler" <${SMTP_USER}>`,
      to,
      subject,
      text,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("Relay error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

