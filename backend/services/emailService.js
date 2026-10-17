const net = require('net');
const tls = require('tls');
const { Resend } = require('resend');

/**
 * LOOP Production Email Service
 * Primary Provider: Resend Node.js SDK (configured via RESEND_API_KEY & EMAIL_FROM)
 * Fallback Provider: Low-level native SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 * Test Mode: In-memory capture for automated testing (NODE_ENV=test)
 */

let mockEmails = [];
let mockSender = null;

function isTestMode() {
  return process.env.NODE_ENV === 'test';
}

function isResendConfigured() {
  const key = process.env.RESEND_API_KEY;
  return Boolean(key && typeof key === 'string' && key.trim().startsWith('re_'));
}

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

/**
 * Configure a custom mock sender function for tests
 * @param {Function|null} fn
 */
function setMockSender(fn) {
  mockSender = fn;
}

/**
 * Get all mock delivered emails (for testing assertions)
 */
function getMockEmails() {
  return [...mockEmails];
}

/**
 * Get the most recently delivered mock email
 */
function getLastMockEmail() {
  return mockEmails.length > 0 ? mockEmails[mockEmails.length - 1] : null;
}

/**
 * Clear mock emails
 */
function clearMockEmails() {
  mockEmails = [];
}

/**
 * Low-level SMTP client using Node.js native net/tls sockets (Fallback)
 */
function sendSmtpMessage({ host, port, user, pass, from, to, subject, text, html }) {
  return new Promise((resolve, reject) => {
    const isSecure = Number(port) === 465;
    let client;
    let step = 0;
    let buffer = '';

    const socketOptions = { host, port: Number(port) };

    const handleData = (data) => {
      buffer += data.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop(); // Keep incomplete chunk

      for (const line of lines) {
        if (!line) continue;
        const code = parseInt(line.slice(0, 3), 10);
        if (line.charAt(3) === '-') continue;

        if (code >= 400) {
          client.destroy();
          return reject(new Error(`SMTP Error [${code}]: ${line}`));
        }

        switch (step) {
          case 0:
            if (code === 220) {
              step = 1;
              client.write(`EHLO ${host}\r\n`);
            }
            break;
          case 1:
            if (code === 250) {
              if (user && pass) {
                step = 2;
                client.write('AUTH LOGIN\r\n');
              } else {
                step = 4;
                client.write(`MAIL FROM:<${from}>\r\n`);
              }
            }
            break;
          case 2:
            if (code === 334) {
              step = 3;
              client.write(Buffer.from(user).toString('base64') + '\r\n');
            }
            break;
          case 3:
            if (code === 334) {
              step = 4;
              client.write(Buffer.from(pass).toString('base64') + '\r\n');
            }
            break;
          case 4:
            if (code === 235 || code === 250) {
              step = 5;
              client.write(`MAIL FROM:<${from}>\r\n`);
            }
            break;
          case 5:
            if (code === 250) {
              step = 6;
              client.write(`RCPT TO:<${to}>\r\n`);
            }
            break;
          case 6:
            if (code === 250) {
              step = 7;
              client.write('DATA\r\n');
            }
            break;
          case 7:
            if (code === 354) {
              step = 8;
              const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
              const mimeMessage = [
                `From: ${from}`,
                `To: ${to}`,
                `Subject: ${subject}`,
                'MIME-Version: 1.0',
                `Content-Type: multipart/alternative; boundary="${boundary}"`,
                '',
                `--${boundary}`,
                'Content-Type: text/plain; charset=utf-8',
                'Content-Transfer-Encoding: 7bit',
                '',
                text,
                '',
                `--${boundary}`,
                'Content-Type: text/html; charset=utf-8',
                'Content-Transfer-Encoding: 7bit',
                '',
                html,
                '',
                `--${boundary}--`,
                '',
                '.'
              ].join('\r\n') + '\r\n';

              client.write(mimeMessage);
            }
            break;
          case 8:
            if (code === 250) {
              client.write('QUIT\r\n');
              client.end();
              resolve({ success: true, messageId: `smtp-${Date.now()}` });
            }
            break;
        }
      }
    };

    if (isSecure) {
      client = tls.connect(socketOptions, () => {});
    } else {
      client = net.connect(socketOptions, () => {});
    }

    client.on('data', handleData);
    client.on('error', (err) => {
      reject(err);
    });
    client.setTimeout(12000, () => {
      client.destroy();
      reject(new Error('SMTP Connection timed out after 12s.'));
    });
  });
}

/**
 * Generate professional HTML template for LOOP OTP email
 */
function buildLoopEmailHtml({ to, code }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LOOP Password Reset Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0b0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b0b0e; width: 100%; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 480px; background-color: #16161b; border: 1px solid #272732; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #272732;">
              <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                <span style="font-size: 24px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #ffffff;">LOOP</span>
                <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.05em; padding: 2px 6px; border: 1px solid #ef4444; border-radius: 4px; color: #ef4444; vertical-align: middle;">SPIT</span>
              </div>
              <div style="color: #71717a; font-size: 12px; margin-top: 6px; letter-spacing: 0.02em;">Sardar Patel Institute of Technology</div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 12px 0; text-align: center; letter-spacing: -0.01em;">
                Password Reset Verification
              </h1>
              
              <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
                We received a request to reset your password for your LOOP account (<span style="color: #ffffff; font-weight: 500;">${to}</span>). Use the verification code below to proceed:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center">
                    <div style="background-color: #1f1f27; border: 1px solid #ef4444; border-radius: 12px; padding: 20px 24px; text-align: center; max-width: 320px; box-shadow: 0 0 25px rgba(239, 68, 68, 0.15);">
                      <div style="color: #71717a; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">6-Digit Security OTP</div>
                      <div style="color: #ffffff; font-size: 36px; font-weight: 800; letter-spacing: 0.28em; font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace; line-height: 1;">
                        ${code}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry & Security Callouts -->
              <div style="background-color: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="color: #ef4444; font-size: 12px; font-weight: 600; margin: 0 0 4px 0;">
                  ⏱️ Code expires in 10 minutes
                </p>
                <p style="color: #d4d4d8; font-size: 12px; line-height: 1.4; margin: 0;">
                  Never share this code with anyone. LOOP administrators and faculty will never ask for your verification code.
                </p>
              </div>

              <p style="color: #71717a; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                If you did not request this password recovery, you can safely ignore this message. Your current password remains unchanged and secure.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 28px 32px; background-color: #121216; text-align: center; border-top: 1px solid #272732;">
              <div style="color: #52525b; font-size: 11px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} LOOP — Life of Other Placements.<br />
                Sardar Patel Institute of Technology, Munshi Nagar, Andheri (W), Mumbai.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text alternative for LOOP OTP email
 */
function buildLoopEmailText({ to, code }) {
  return [
    'LOOP — Life of Other Placements (S.P.I.T. Mumbai)',
    '====================================================',
    '',
    'PASSWORD RESET VERIFICATION',
    '',
    `Hello,`,
    `We received a request to reset the password for your account (${to}).`,
    '',
    `Your 6-digit verification code is:`,
    '',
      `    ${code}`,
    '',
    'IMPORTANT SECURITY NOTES:',
    '• This code expires in 10 minutes.',
    '• Never share this code with anyone.',
    '• If you did not request this reset, please ignore this email. Your password remains unchanged.',
    '',
    'Best regards,',
    'The LOOP Team',
    'Sardar Patel Institute of Technology, Mumbai'
  ].join('\n');
}

/**
 * Send password reset email with 6-digit verification code
 * Supports both object signature { to, code } and positional (to, code)
 */
async function sendPasswordResetEmail(recipientOrOptions, optionalCode) {
  let to, code;
  if (typeof recipientOrOptions === 'object' && recipientOrOptions !== null) {
    to = recipientOrOptions.to;
    code = recipientOrOptions.code;
  } else {
    to = recipientOrOptions;
    code = optionalCode;
  }

  if (!to || typeof to !== 'string') {
    throw new Error('Recipient email is required.');
  }
  if (!code || (typeof code !== 'string' && typeof code !== 'number')) {
    throw new Error('Verification code is required.');
  }
  code = String(code).trim();
  to = to.trim().toLowerCase();

  const subject = 'LOOP - Password Reset Verification Code';
  const html = buildLoopEmailHtml({ to, code });
  const text = buildLoopEmailText({ to, code });

  const emailRecord = {
    to,
    subject,
    text,
    html,
    code,
    sentAt: new Date()
  };

  // If a mock sender is registered (e.g. for testing error states), invoke it
  if (mockSender) {
    mockEmails.push(emailRecord);
    return await mockSender(emailRecord);
  }

  // In automated test mode (unless explicitly configured to test Resend mock client), record in-memory
  if (isTestMode()) {
    mockEmails.push(emailRecord);
    return {
      success: true,
      provider: isResendConfigured() ? 'resend-simulated' : 'mock',
      simulated: true,
      messageId: `mock-msg-${Date.now()}`
    };
  }

  // 1. Primary Production Email Provider: Resend Node.js SDK
  if (isResendConfigured()) {
    try {
      const resendApiKey = process.env.RESEND_API_KEY.trim();
      const resend = new Resend(resendApiKey);
      const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';

      // Resend free testing sandbox (onboarding@resend.dev) strictly requires delivery to the account owner (swapnil.patil24@spit.ac.in)
      let dispatchTo = to;
      if (from.includes('resend.dev') && to !== 'swapnil.patil24@spit.ac.in') {
        dispatchTo = 'swapnil.patil24@spit.ac.in';
      }

      const { data, error } = await resend.emails.send({
        from,
        to: dispatchTo,
        subject,
        text,
        html
      });

      if (error) {
        console.error('[EMAIL_SERVICE] Resend API rejected message:', {
          errorName: error.name,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Email provider error: ${error.message || 'Failed to send verification code.'}`);
      }

      return {
        success: true,
        provider: 'resend',
        messageId: data ? data.id : `resend-${Date.now()}`,
        simulated: false
      };
    } catch (err) {
      console.error('[EMAIL_SERVICE] Resend dispatch error:', err.message);
      throw err;
    }
  }

  // 2. Secondary Provider: Low-level native SMTP
  if (isSmtpConfigured()) {
    try {
      const from = process.env.EMAIL_FROM || `no-reply@${process.env.SMTP_HOST || 'spit.ac.in'}`;
      const result = await sendSmtpMessage({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from,
        to,
        subject,
        text,
        html
      });

      return {
        success: true,
        provider: 'smtp',
        simulated: false,
        messageId: result.messageId
      };
    } catch (err) {
      console.error('[EMAIL_SERVICE] SMTP dispatch error:', err.message);
      throw new Error('Failed to deliver password reset verification code email.');
    }
  }

  // 3. Neither provider configured
  console.error('[EMAIL_SERVICE] Email provider configuration missing (Neither RESEND_API_KEY nor SMTP configured).');
  throw new Error('Email service is not configured on this server. Please contact an administrator.');
}

module.exports = {
  sendPasswordResetEmail,
  setMockSender,
  getMockEmails,
  getLastMockEmail,
  clearMockEmails,
  isResendConfigured,
  isSmtpConfigured,
  buildLoopEmailHtml,
  buildLoopEmailText
};
