const crypto = require('crypto');
const logger = require('../lib/logger');

function requestContext(req, res, next) {
  const start = process.hrtime.bigint();
  const requestId = req.get('x-request-id') || crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - start;
    const durationMs = Number(elapsedNs) / 1e6;

    logger.info('request.completed', {
      request_id: requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
      ip: req.ip
    });
  });

  next();
}

module.exports = {
  requestContext
};
