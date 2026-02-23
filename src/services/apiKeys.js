const crypto = require('crypto');

function hashApiKey(rawApiKey) {
  return crypto.createHash('sha256').update(rawApiKey).digest('hex');
}

function generateApiKey() {
  const secret = crypto.randomBytes(24).toString('hex');
  const raw = `hbf_live_${secret}`;
  return {
    raw,
    hash: hashApiKey(raw),
    prefix: raw.slice(0, 16)
  };
}

module.exports = {
  hashApiKey,
  generateApiKey
};
