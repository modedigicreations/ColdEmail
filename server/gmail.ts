import nodemailer from 'nodemailer';
import { Settings } from './db.js';

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

export async function sendColdEmail(params: SendEmailParams, settings: Settings): Promise<void> {
  const userEmail = settings.gmailEmail;
  const userPassword = settings.gmailAppPassword;

  if (!userEmail || !userPassword) {
    throw new Error('Gmail SMTP credentials are not configured. Please set Gmail email and App Password in Settings.');
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: userEmail,
      pass: userPassword
    }
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
