const rateLimit = require('express-rate-limit');
const config = require('../config');

const publicSubmissionRateLimit = rateLimit({
  windowMs: config.publicRateLimitWindowMs,
  max: config.publicRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.params.formId || 'unknown'}`,
  message: {
    error: 'Rate limit exceeded. Please retry later.'
  }
});

module.exports = {
  publicSubmissionRateLimit
};
