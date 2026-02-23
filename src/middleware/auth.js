const { pool } = require('../db/pool');
const { hashApiKey } = require('../services/apiKeys');

async function requireApiKey(req, res, next) {
  try {
    const raw = extractApiKey(req);
    if (!raw) {
      return res.status(401).json({ error: 'Missing API key.' });
    }

    const keyHash = hashApiKey(raw);
    const result = await pool.query(
      `
      SELECT
        ak.id AS api_key_id,
        ak.user_id,
        u.plan,
        u.email
      FROM api_keys ak
      JOIN users u ON u.id = ak.user_id
      WHERE ak.key_hash = $1
      AND ak.revoked_at IS NULL
      LIMIT 1
      `,
      [keyHash]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }

    req.auth = result.rows[0];

    if (req.auth.plan === 'unpaid') {
      return res.status(402).json({ error: 'Payment required.' });
    }

    await pool.query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [req.auth.api_key_id]);

    return next();
  } catch (error) {
    return next(error);
  }
}

function extractApiKey(req) {
  const header = req.header('x-api-key');
  if (header) {
    return header.trim();
  }

  const authHeader = req.header('authorization');
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme && scheme.toLowerCase() === 'bearer' && token) {
    return token.trim();
  }

  return null;
}

module.exports = {
  requireApiKey,
  extractApiKey
};
