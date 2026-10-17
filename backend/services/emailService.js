/**
 * LOOP Production Email Service
 * Sole Email Provider: Brevo Transactional Email API (https://api.brevo.com/v3/smtp/email)
 * Configured via:
 *   - BREVO_API_KEY: Brevo API v3 Key (xkeysib-...)
 *   - EMAIL_FROM: Verified Sender Email Address (e.g. swapnil.patil24@spit.ac.in)
 * Test Mode: In-memory simulation when NODE_ENV=test
 */

let mockEmails = [];
let mockSender = null;

function isTestMode() {
  if (process.env.RENDER || process.env.VERCEL || process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
    return false;
  }
  return process.env.NODE_ENV === 'test' && !process.env.LOOP_FORCE_LIVE_EMAIL;
}

/**
 * Validate whether Brevo is configured with valid credentials
 */
function isBrevoConfigured() {
  const rawKey = process.env.BREVO_API_KEY;
  if (!rawKey || typeof rawKey !== 'string') return false;
  const key = rawKey.trim().replace(/^["']|["']$/g, '');
  return Boolean(key.startsWith('xkeysib-'));
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
 * Generate clean, minimal Docker-style HTML email layout
 * - White background
 * - Responsive container max-width 600px
 * - Simple LOOP branding
 * - Left-aligned content
 * - Large OTP text (~40-44px)
 * - Subtle divider & footer
 */
function buildLoopEmailHtml({ to, code }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LOOP — Your password reset verification code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; width: 100%; padding: 40px 16px;">
    <tr>
      <td align="left">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Simple LOOP and SPIT Branding -->
          <tr>
            <td style="padding: 0 0 24px 0;">
              <span style="font-size: 22px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #111111;">LOOP</span>
              <span style="display: inline-block; margin-left: 10px; padding: 2px 8px; font-size: 11px; font-weight: 700; color: #555555; background-color: #f1f1f1; border-radius: 4px; vertical-align: middle; letter-spacing: 0.05em;">SPIT</span>
            </td>
          </tr>
          <!-- Heading -->
          <tr>
            <td style="padding: 0 0 24px 0;">
              <h1 style="font-size: 20px; font-weight: 600; color: #111111; margin: 0; line-height: 1.3;">
                Your password reset verification code
              </h1>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #333333;">
              <p style="margin: 0 0 16px 0;">Hello,</p>
              <p style="margin: 0 0 24px 0;">We received a request to reset the password for your LOOP account (${to ? `<strong style="color: #111111;">${to}</strong>` : 'associated with this email'}).</p>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #666666;">Your verification code is:</p>
              <div style="font-size: 42px; font-weight: 700; letter-spacing: 0.25em; font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace; color: #111111; padding: 12px 0 20px 0; line-height: 1;">
                ${code}
              </div>
              <p style="margin: 0 0 16px 0;">Enter this code on the LOOP password-reset page to continue.</p>
              <p style="margin: 0 0 24px 0; color: #666666; font-size: 14px;">This code expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.</p>
              <p style="margin: 0; line-height: 1.5;">Thanks,<br><strong>The LOOP Team</strong></p>
            </td>
          </tr>
          <!-- Subtle Divider & Footer -->
          <tr>
            <td style="border-top: 1px solid #eeeeee; padding: 24px 0 0 0; font-size: 12px; color: #888888; line-height: 1.5;">
              Sardar Patel Institute of Technology (SPIT), Mumbai &bull; Confidential &amp; Secure
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate equivalent plain-text body
 */
function buildLoopEmailText({ to, code }) {
  return [
    'LOOP',
    '',
    'Your password reset verification code',
    '',
    'Hello,',
    '',
    `We received a request to reset the password for your LOOP account (${to || 'associated with this email'}).`,
    '',
    'Your verification code is:',
    '',
    code,
    '',
    'Enter this code on the LOOP password-reset page to continue.',
    '',
    'This code expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.',
    '',
    'Thanks,',
    'The LOOP Team'
  ].join('\n');
}

/**
 * Send password reset email with 6-digit verification code using Brevo API
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

  const subject = 'LOOP — Your password reset verification code';
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

  // In automated test mode, record in-memory and return simulated success
  if (isTestMode()) {
    mockEmails.push(emailRecord);
    return {
      success: true,
      provider: 'brevo-mock',
      simulated: true,
      messageId: `mock-brevo-${Date.now()}`
    };
  }

  // Sole Email Provider: Brevo Transactional Email API
  if (!isBrevoConfigured()) {
    console.error('[EMAIL_SERVICE] Brevo API key configuration is missing or invalid.');
    throw new Error('Email service is not configured on this server. Please contact an administrator.');
  }

  const apiKey = process.env.BREVO_API_KEY.trim().replace(/^["']|["']$/g, '');
  const fromEmail = (process.env.EMAIL_FROM || 'swapnil.patil24@spit.ac.in').trim().replace(/^["']|["']$/g, '');

  try {
    const payload = {
      sender: {
        name: 'LOOP',
        email: fromEmail
      },
      to: [
        {
          email: to
        }
      ],
      subject,
      htmlContent: html,
      textContent: text
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage = responseData.message || `Brevo API HTTP ${response.status}`;
      const errorCode = responseData.code || 'BREVO_API_ERROR';
      console.error('[EMAIL_SERVICE] Brevo dispatch rejected:', {
        status: response.status,
        code: errorCode,
        message: errorMessage,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Email delivery failed: ${errorMessage}`);
    }

    return {
      success: true,
      provider: 'brevo',
      messageId: responseData.messageId || `brevo-${Date.now()}`,
      simulated: false
    };
  } catch (err) {
    if (err.name === 'TimeoutError' || err.code === 'ABORT_ERR') {
      console.error('[EMAIL_SERVICE] Brevo request timed out after 15s.');
      throw new Error('Email delivery timed out. Please try again.');
    }
    console.error('[EMAIL_SERVICE] Brevo dispatch error:', err.message);
    throw err;
  }
}

module.exports = {
  sendPasswordResetEmail,
  setMockSender,
  getMockEmails,
  getLastMockEmail,
  clearMockEmails,
  isBrevoConfigured,
  buildLoopEmailHtml,
  buildLoopEmailText
};
