const express = require('express');
const { z } = require('zod');
const { pool } = require('../db/pool');
const { requireApiKey } = require('../middleware/auth');
const { generateApiKey } = require('../services/apiKeys');

const router = express.Router();

const keyIdParamSchema = z.object({
  id: z.string().uuid()
});

router.use(requireApiKey);

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT
        ak.id,
        ak.key_prefix,
        ak.created_at,
        ak.last_used_at,
        ak.revoked_at,
        (ak.id = $2::uuid) AS is_current
      FROM api_keys ak
      WHERE ak.user_id = $1
      ORDER BY ak.created_at DESC
      `,
      [req.auth.user_id, req.auth.api_key_id]
    );

    return res.json({ keys: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const key = generateApiKey();
    const inserted = await pool.query(
      `
      INSERT INTO api_keys(user_id, key_hash, key_prefix)
      VALUES ($1, $2, $3)
      RETURNING id, key_prefix, created_at, last_used_at, revoked_at
      `,
      [req.auth.user_id, key.hash, key.prefix]
    );

    return res.status(201).json({
      key: inserted.rows[0],
      api_key: key.raw
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/revoke', async (req, res, next) => {
  try {
    const parsed = keyIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const targetResult = await pool.query(
      `
      SELECT id, user_id, key_prefix, created_at, last_used_at, revoked_at
      FROM api_keys
      WHERE id = $1
      AND user_id = $2
      LIMIT 1
      `,
      [parsed.data.id, req.auth.user_id]
    );

    if (targetResult.rowCount === 0) {
      return res.status(404).json({ error: 'API key not found.' });
    }

    const targetKey = targetResult.rows[0];

    if (targetKey.revoked_at) {
      return res.json({ key: targetKey });
    }

    if (targetKey.id === req.auth.api_key_id) {
      const activeCountResult = await pool.query(
        `
        SELECT COUNT(*)::int AS active_count
        FROM api_keys
        WHERE user_id = $1
        AND revoked_at IS NULL
        `,
        [req.auth.user_id]
      );

      if (activeCountResult.rows[0].active_count <= 1) {
        return res.status(409).json({
          error: 'Cannot revoke your only active API key. Create another key first.'
        });
      }
    }

    const revokedResult = await pool.query(
      `
      UPDATE api_keys
      SET revoked_at = now()
      WHERE id = $1
      AND user_id = $2
      RETURNING id, user_id, key_prefix, created_at, last_used_at, revoked_at
      `,
      [parsed.data.id, req.auth.user_id]
    );

    return res.json({ key: revokedResult.rows[0] });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
