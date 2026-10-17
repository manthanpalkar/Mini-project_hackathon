const net = require('net');
const tls = require('tls');

/**
 * LOOP Secure Email Service
 * Supports standard SMTP delivery using environment variables:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 * In test mode or when SMTP is unconfigured, records messages in-memory for testing.
 */

let mockEmails = [];
let mockSender = null;

function isTestMode() {
  return process.env.NODE_ENV === 'test';
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
 * Low-level SMTP client using Node.js native net/tls sockets
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
        // Continue if line is a multiline response (e.g. 250-something)
        if (line.charAt(3) === '-') continue;

        if (code >= 400) {
          client.destroy();
          return reject(new Error(`SMTP Error [${code}]: ${line}`));
        }

        switch (step) {
          case 0: // Connected, expecting 220
            if (code === 220) {
              step = 1;
              client.write(`EHLO ${host}\r\n`);
            }
            break;
          case 1: // Sent EHLO, expecting 250
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
          case 2: // Sent AUTH LOGIN, expecting 334 (Username prompt)
            if (code === 334) {
              step = 3;
              client.write(Buffer.from(user).toString('base64') + '\r\n');
            }
            break;
          case 3: // Sent Username, expecting 334 (Password prompt)
            if (code === 334) {
              step = 4;
              client.write(Buffer.from(pass).toString('base64') + '\r\n');
            }
            break;
          case 4: // Auth complete or skipped, expecting 235 or 250
            if (code === 235 || code === 250) {
              step = 5;
              client.write(`MAIL FROM:<${from}>\r\n`);
            }
            break;
          case 5: // Sent MAIL FROM, expecting 250
            if (code === 250) {
              step = 6;
              client.write(`RCPT TO:<${to}>\r\n`);
            }
            break;
          case 6: // Sent RCPT TO, expecting 250
            if (code === 250) {
              step = 7;
              client.write('DATA\r\n');
            }
            break;
          case 7: // Sent DATA, expecting 354
            if (code === 354) {
              step = 8;
              const dateStr = new Date().toUTCString();
              const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@${host}>`;
              const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;

              const emailContent = [
                `From: ${from}`,
                `To: ${to}`,
                `Subject: ${subject}`,
                `Date: ${dateStr}`,
                `Message-ID: ${messageId}`,
                `MIME-Version: 1.0`,
                `Content-Type: multipart/alternative; boundary="${boundary}"`,
                '',
                `--${boundary}`,
                'Content-Type: text/plain; charset=utf-8',
                'Content-Transfer-Encoding: 7bit',
                '',
                text || '',
                '',
                `--${boundary}`,
                'Content-Type: text/html; charset=utf-8',
                'Content-Transfer-Encoding: 7bit',
                '',
                html || `<p>${text}</p>`,
                '',
                `--${boundary}--`,
                '',
                '.\r\n'
              ].join('\r\n');

              client.write(emailContent);
            }
            break;
          case 8: // Data sent, expecting 250
            if (code === 250) {
              step = 9;
              client.write('QUIT\r\n');
              client.end();
              return resolve({ messageId: `msg-${Date.now()}`, accepted: [to] });
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
    client.on('error', (err) => reject(err));
    client.setTimeout(15000, () => {
      client.destroy();
      reject(new Error('SMTP Connection timed out.'));
    });
  });
}

/**
 * Send password reset verification code email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.code - 6-digit verification code
 * @returns {Promise<{ success: boolean, messageId?: string, simulated?: boolean }>}
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
  code = String(code);

  const subject = 'LOOP - Password Reset Verification Code';
  const text = `Hello,

We received a request to reset the password for your LOOP account (${to}).

Your 6-digit verification code is:

${code}

This code will expire in 10 minutes.

If you did not request this password reset, please ignore this email. Your password will remain unchanged.

Best regards,
The LOOP Team
Sardar Patel Institute of Technology`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="color: #111827; margin: 0; font-size: 20px; font-weight: 700;">LOOP Account Security</h2>
    <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Sardar Patel Institute of Technology</p>
  </div>
  
  <p style="color: #374151; font-size: 15px; line-height: 1.5;">Hello,</p>
  <p style="color: #374151; font-size: 15px; line-height: 1.5;">We received a request to reset the password for your LOOP account (<strong>${to}</strong>).</p>
  
  <div style="background-color: #f3f4f6; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
    <span style="font-size: 13px; color: #4b5563; display: block; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Your Verification Code</span>
    <span style="font-size: 32px; font-weight: 700; letter-spacing: 0.25em; color: #111827; font-family: monospace;">${code}</span>
  </div>
  
  <p style="color: #ef4444; font-size: 13px; font-weight: 500; margin: 16px 0;">
    ⚠️ This code expires in 10 minutes and can only be used once.
  </p>
  
  <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
    If you did not request this password reset, you can safely ignore this email. Your current password remains secure.
  </p>
  
  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px; margin-bottom: 0;">
    &copy; ${new Date().getFullYear()} LOOP — Life of Other Placements. SPIT, Mumbai.
  </p>
</div>
  `.trim();

  const emailRecord = {
    to: to.trim().toLowerCase(),
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

  // If in test mode or SMTP credentials are not configured, simulate delivery safely
  if (isTestMode() || !isSmtpConfigured()) {
    mockEmails.push(emailRecord);
    return {
      success: true,
      simulated: true,
      messageId: `mock-msg-${Date.now()}`
    };
  }

  // Real production SMTP delivery
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
      simulated: false,
      messageId: result.messageId
    };
  } catch (err) {
    console.error('[EMAIL_SERVICE] Failed to deliver password reset email:', err.message);
    throw new Error('Failed to deliver password reset verification code email.');
  }
}

module.exports = {
  sendPasswordResetEmail,
  setMockSender,
  getMockEmails,
  getLastMockEmail,
  clearMockEmails,
  isSmtpConfigured
};
