const nodemailer = require('nodemailer');

/**
 * Configure Nodemailer Transporter
 * Supports Gmail, Brevo, SendGrid, Mailgun, Outlook, or any standard SMTP server.
 */
function getTransporter() {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 465;
  const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : port === 465;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Send email via Resend API (if RESEND_API_KEY is configured)
 */
async function sendViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const from = process.env.EMAIL_FROM || 'Jamait App <onboarding@resend.dev>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Resend API failed');
  }
  return data;
}

/**
 * Send 6-Digit Password Reset OTP Email
 * @param {Object} options
 * @param {string} options.toEmail
 * @param {string} options.otp
 * @param {string} [options.userName]
 * @returns {Promise<{success: boolean, error?: string, notConfigured?: boolean}>}
 */
async function sendResetOtpEmail({ toEmail, otp, userName }) {
  const cleanEmail = (toEmail || '').trim().toLowerCase();

  console.log(`\n======================================================`);
  console.log(`📧 PASSWORD RESET REQUEST FOR: ${cleanEmail}`);
  console.log(`🔑 6-DIGIT OTP CODE: [ ${otp} ] (Valid for 15 minutes)`);
  console.log(`======================================================\n`);

  const subject = `Your Jamait App Password Reset Code: ${otp}`;
  const textContent = `Assalamu Alaikum,\n\nYour Jamait App password reset code is: ${otp}\n\nThis code will expire in 15 minutes.\nIf you did not request this, please ignore this email.`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f5; margin: 0; padding: 24px; color: #333333; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
        .header { background: #0a3d1f; padding: 28px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; letter-spacing: 0.5px; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 17px; font-weight: 600; margin-bottom: 12px; color: #0a3d1f; }
        .otp-box { margin: 28px 0; padding: 20px; background: #f0fdf4; border: 2px dashed #1b6b3c; border-radius: 10px; text-align: center; }
        .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #0a3d1f; font-family: monospace, Courier; }
        .expiry { font-size: 13px; color: #666666; margin-top: 10px; }
        .note { font-size: 14px; color: #555555; line-height: 1.6; margin: 16px 0; }
        .footer { padding: 20px 28px; background: #fafafa; border-top: 1px solid #eeeeee; text-align: center; font-size: 12px; color: #888888; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Jamait App</h1>
        </div>
        <div class="content">
          <div class="greeting">Assalamu Alaikum ${userName ? userName : ''},</div>
          <p class="note">
            We received a request to reset the password for your Jamait App account (<strong>${cleanEmail}</strong>).
          </p>
          <p class="note">
            Use the 6-digit verification code below to complete your password reset:
          </p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="expiry">⏱️ This code expires in 15 minutes.</div>
          </div>
          <p class="note" style="font-size: 13px; color: #777777;">
            If you did not request this password reset, please ignore this email or contact support if you suspect unauthorized activity.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Jamait App. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Try Resend if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const resendRes = await sendViaResend({
        to: cleanEmail,
        subject,
        html: htmlContent,
        text: textContent,
      });
      console.log(`[EMAIL SERVICE] Email sent via Resend API to ${cleanEmail}:`, resendRes?.id);
      return { success: true, messageId: resendRes?.id };
    } catch (resendErr) {
      console.error(`[EMAIL SERVICE] Resend failed, falling back to SMTP:`, resendErr.message);
    }
  }

  // 2. Try Nodemailer SMTP
  const transporter = getTransporter();
  if (transporter) {
    try {
      const fromAddress = process.env.EMAIL_FROM || `Jamait App <${process.env.SMTP_USER || process.env.EMAIL_USER}>`;
      const info = await transporter.sendMail({
        from: fromAddress,
        to: cleanEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[EMAIL SERVICE] Email sent via SMTP to ${cleanEmail}. Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (smtpErr) {
      console.error(`[EMAIL SERVICE ERROR] SMTP failed to send to ${cleanEmail}:`, smtpErr.message);
      return { success: false, error: smtpErr.message };
    }
  }

  // 3. No email transport configured
  console.warn(
    `[EMAIL SERVICE] No email transport configured! ` +
    `Please set SMTP_USER and SMTP_PASS (or RESEND_API_KEY) in Render Environment Variables.`
  );

  return {
    success: false,
    notConfigured: true,
    error: 'Email service not configured. Please configure SMTP_USER & SMTP_PASS in Render.',
  };
}

module.exports = {
  getTransporter,
  sendResetOtpEmail,
};
