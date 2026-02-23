const config = require('../config');

async function verifyRecaptcha(token, ip) {
  if (!config.recaptchaSecret) {
    return { ok: true, skipped: true };
  }

  if (!token) {
    return { ok: false, reason: 'missing_recaptcha_token' };
  }

  const params = new URLSearchParams();
  params.append('secret', config.recaptchaSecret);
  params.append('response', token);
  if (ip) {
    params.append('remoteip', ip);
  }

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    return { ok: false, reason: 'recaptcha_unavailable' };
  }

  const body = await response.json();
  if (!body.success) {
    return { ok: false, reason: 'recaptcha_failed' };
  }

  return { ok: true, skipped: false };
}

function detectHoneypot(websiteField) {
  if (typeof websiteField === 'string' && websiteField.trim().length > 0) {
    return { isSpam: true, reason: 'honeypot_triggered' };
  }

  return { isSpam: false, reason: null };
}

module.exports = {
  verifyRecaptcha,
  detectHoneypot
};
