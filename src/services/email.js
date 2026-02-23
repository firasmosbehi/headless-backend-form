const config = require('../config');

async function sendFormNotification({ to, formName, submissionId, data }) {
  if (!config.resendApiKey || !to) {
    return { sent: false, skipped: true };
  }

  const html = `
    <h2>New submission for ${escapeHtml(formName)}</h2>
    <p><strong>Submission ID:</strong> ${submissionId}</p>
    <pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [to],
      subject: `New form submission: ${formName}`,
      html
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Email provider error: ${response.status} ${text}`);
  }

  return { sent: true, skipped: false };
}

function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

module.exports = {
  sendFormNotification
};
