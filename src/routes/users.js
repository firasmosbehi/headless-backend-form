const express = require('express');
const { z } = require('zod');
const { pool } = require('../db/pool');
const { generateApiKey } = require('../services/apiKeys');

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional()
});

router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { email, name } = parsed.data;

    const userInsert = await pool.query(
      `INSERT INTO users(email, name)
       VALUES ($1, $2)
       ON CONFLICT(email) DO NOTHING
       RETURNING id, email, name, plan, created_at`,
      [email.toLowerCase(), name || null]
    );

    if (userInsert.rowCount === 0) {
      return res.status(409).json({ error: 'User already exists. Please rotate/create a key via dashboard flow.' });
    }

    const user = userInsert.rows[0];
    const key = generateApiKey();

    await pool.query(
      `INSERT INTO api_keys(user_id, key_hash, key_prefix)
       VALUES ($1, $2, $3)`,
      [user.id, key.hash, key.prefix]
    );

    return res.status(201).json({
      user,
      api_key: key.raw
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
