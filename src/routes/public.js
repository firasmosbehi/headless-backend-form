const express = require('express');
const { pool } = require('../db/pool');
const { publicSubmissionRateLimit } = require('../middleware/publicRateLimit');
const { validateSubmissionPayload } = require('../services/payloadValidation');
const { validateAgainstFormSchema } = require('../services/submissionSchema');
const { detectHoneypot, verifyRecaptcha } = require('../services/spam');
const { sendFormNotification } = require('../services/email');

const router = express.Router();

router.post('/:formId', publicSubmissionRateLimit, async (req, res, next) => {
  try {
    const formResult = await pool.query(
      `SELECT id, name, notify_email, is_active, schema
       FROM forms
       WHERE id = $1
       LIMIT 1`,
      [req.params.formId]
    );

    if (formResult.rowCount === 0 || !formResult.rows[0].is_active) {
      return res.status(404).json({ error: 'Form not found.' });
    }

    const parsed = validateSubmissionPayload(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { data, recaptchaToken, website } = parsed.data;
    const schemaValidation = validateAgainstFormSchema(data, formResult.rows[0].schema);
    if (!schemaValidation.success) {
      return res.status(400).json({ error: schemaValidation.error });
    }

    const honeypot = detectHoneypot(website);
    let isSpam = honeypot.isSpam;
    let spamReason = honeypot.reason;

    if (!isSpam) {
      const recaptcha = await verifyRecaptcha(recaptchaToken, req.ip);
      if (!recaptcha.ok) {
        isSpam = true;
        spamReason = recaptcha.reason;
      }
    }

    const insert = await pool.query(
      `INSERT INTO submissions(form_id, ip, user_agent, payload, is_spam, spam_reason)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING id, created_at`,
      [
        formResult.rows[0].id,
        req.ip,
        req.get('user-agent') || null,
        JSON.stringify(data),
        isSpam,
        spamReason
      ]
    );

    if (!isSpam) {
      sendFormNotification({
        to: formResult.rows[0].notify_email,
        formName: formResult.rows[0].name,
        submissionId: insert.rows[0].id,
        data
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Email notification failed:', error.message);
      });
    }

    if (isSpam) {
      return res.status(202).json({ accepted: true });
    }

    return res.status(201).json({
      accepted: true,
      submission_id: insert.rows[0].id,
      created_at: insert.rows[0].created_at
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
