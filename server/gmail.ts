import nodemailer from 'nodemailer';
import { Settings } from './db.js';

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

export async function sendColdEmail(params: SendEmailParams, settings: Settings): Promise<void> {
  const userEmail = settings.gmailEmail || process.env.GMAIL_EMAIL;
  const userPassword = settings.gmailAppPassword || process.env.GMAIL_APP_PASSWORD;

  if (!userEmail || !userPassword) {
    throw new Error('Gmail SMTP credentials are not configured. Please set Gmail email and App Password in Settings or environment variables.');
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: userEmail,
      pass: userPassword
    },
    connectionTimeout: 15000 // 15 seconds connection timeout
  });

  // Verify connection configuration
  try {
    await transporter.verify();
  } catch (error: any) {
    console.error('SMTP Verification failed:', error.message);
    throw new Error(`Gmail SMTP authentication failed: ${error.message}. Please verify your Gmail email and App Password.`);
  }

  // Send mail
  const mailOptions = {
    from: userEmail,
    to: params.to,
    subject: params.subject,
    text: params.body
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error: any) {
    console.error('Failed to send cold email:', error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
