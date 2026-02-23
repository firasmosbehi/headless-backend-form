const express = require('express');
const { z } = require('zod');
const { pool } = require('../db/pool');
const { requireApiKey } = require('../middleware/auth');

const router = express.Router();

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const formFieldRuleSchema = z
  .object({
    type: z.enum(['string', 'number', 'boolean', 'null']).optional(),
    required: z.boolean().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    enum: z.array(scalarSchema).min(1).optional()
  })
  .superRefine((rules, ctx) => {
    if (
      typeof rules.minLength === 'number'
      && typeof rules.maxLength === 'number'
      && rules.minLength > rules.maxLength
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minLength cannot be greater than maxLength.'
      });
    }

    if (
      typeof rules.minimum === 'number'
      && typeof rules.maximum === 'number'
      && rules.minimum > rules.maximum
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minimum cannot be greater than maximum.'
      });
    }
  });

const createFormSchema = z.object({
  name: z.string().min(1).max(120),
  notify_email: z.string().email(),
  schema: z.record(z.string().min(1), formFieldRuleSchema).optional(),
  is_active: z.boolean().optional()
});

const submissionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

router.use(requireApiKey);

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, notify_email, schema, is_active, created_at
       FROM forms
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.auth.user_id]
    );

    return res.json({ forms: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = createFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const result = await pool.query(
      `INSERT INTO forms(user_id, name, notify_email, schema, is_active)
       VALUES ($1, $2, $3, $4::jsonb, COALESCE($5, TRUE))
       RETURNING id, user_id, name, notify_email, schema, is_active, created_at`,
      [
        req.auth.user_id,
        parsed.data.name,
        parsed.data.notify_email.toLowerCase(),
        JSON.stringify(parsed.data.schema || {}),
        parsed.data.is_active
      ]
    );

    return res.status(201).json({ form: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/submissions', async (req, res, next) => {
  try {
    const parsedQuery = submissionQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error.flatten() });
    }

    const { limit, offset } = parsedQuery.data;

    const result = await pool.query(
      `
      SELECT s.id, s.form_id, s.payload, s.is_spam, s.spam_reason, s.created_at
      FROM submissions s
      JOIN forms f ON f.id = s.form_id
      WHERE s.form_id = $1
      AND f.user_id = $2
      ORDER BY s.created_at DESC
      LIMIT $3
      OFFSET $4
      `,
      [req.params.id, req.auth.user_id, limit, offset]
    );

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM submissions s
      JOIN forms f ON f.id = s.form_id
      WHERE s.form_id = $1
      AND f.user_id = $2
      `,
      [req.params.id, req.auth.user_id]
    );

    const total = countResult.rows[0]?.total || 0;

    return res.json({
      submissions: result.rows,
      pagination: {
        limit,
        offset,
        total,
        has_more: offset + result.rows.length < total
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
