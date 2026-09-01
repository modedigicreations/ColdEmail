import nodemailer from 'nodemailer';
import { Settings } from './db.js';

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

export async function sendColdEmail(params: SendEmailParams, settings: Settings): Promise<void> {
  const provider = settings.emailProvider || 'gmail';

  const recipient = (params.to || '').trim();
  if (!recipient || !recipient.includes('@')) {
    throw new Error(`Invalid recipient email address: "${params.to}"`);
  }

  // Generate clean HTML version with clickable links
  const escapedBody = params.body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const htmlBody = escapedBody
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color: #7c3aed; font-weight: 600; text-decoration: underline;" target="_blank">$1</a>')
    .replace(/\n/g, '<br>');
  const wrappedHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${htmlBody}</div>`;

  if (provider === 'resend') {
    const apiKey = (settings.resendApiKey || process.env.RESEND_API_KEY || '').trim();
    const fromEmail = (settings.resendFromEmail || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim();

    if (!apiKey) {
      throw new Error('Resend API key is not configured. Please set Resend API Key in Settings or environment variables.');
    }

    try {
      const response = await globalThis.fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipient],
          subject: params.subject,
          text: params.body,
          html: wrappedHtml
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Resend API returned status ${response.status}: ${errText}`);
      }
    } catch (error: any) {
      console.error('Failed to send cold email via Resend:', error.message);
      throw new Error(`Failed to send email via Resend: ${error.message}`);
    }
    return;
  }

  // Default Gmail SMTP
  const userEmail = (settings.gmailEmail || process.env.GMAIL_EMAIL || '').trim();
  const rawPassword = settings.gmailAppPassword || process.env.GMAIL_APP_PASSWORD || '';
  // Google App Passwords often contain spaces (e.g. "abcd efgh ijkl mnop") - remove all whitespace
  const userPassword = rawPassword.replace(/\s+/g, '');

  if (!userEmail || !userPassword) {
    throw new Error('Gmail SMTP credentials are not configured. Please set Gmail email and App Password in Settings or environment variables.');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: userEmail,
      pass: userPassword
    },
    connectionTimeout: 15000
  });

  try {
    await transporter.verify();
  } catch (error: any) {
    console.error('SMTP Verification failed:', error.message);
    throw new Error(`Gmail SMTP authentication failed: ${error.message}. Please verify your Gmail email and App Password.`);
  }

  const mailOptions = {
    from: userEmail,
    to: recipient,
    subject: params.subject,
    text: params.body,
    html: wrappedHtml
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error: any) {
    console.error('Failed to send cold email via Gmail:', error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
