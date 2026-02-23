const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const logger = require('./lib/logger');
const { pool } = require('./db/pool');
const { requestContext } = require('./middleware/requestContext');
const usersRouter = require('./routes/users');
const formsRouter = require('./routes/forms');
const apiKeysRouter = require('./routes/apiKeys');
const publicRouter = require('./routes/public');

const app = express();

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(express.json({ limit: config.publicBodyLimit }));
app.use(requestContext);

const dashboardCors = cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (config.allowedDashboardOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error('CORS blocked for dashboard origin.');
    error.status = 403;
    return callback(error);
  },
  credentials: true
});

const publicCors = cors({
  origin: '*',
  methods: ['POST', 'OPTIONS']
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'headless-form-api' });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true });
  } catch (error) {
    logger.error('readiness.failed', {
      request_id: req.requestId,
      error: error.message
    });
    return res.status(503).json({ error: 'Database unavailable.', request_id: req.requestId });
  }
});

app.use('/f', publicCors, publicRouter);

app.use('/api', dashboardCors);
app.use('/api/users', usersRouter);
app.use('/api/forms', formsRouter);
app.use('/api/keys', apiKeysRouter);

app.use((error, req, res, next) => {
  logger.error('request.failed', {
    request_id: req.requestId,
    method: req.method,
    path: req.originalUrl,
    error: error.message
  });
  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || 500;
  return res.status(status).json({
    error: status === 500 ? 'Internal server error.' : error.message,
    request_id: req.requestId
  });
});

module.exports = { app };
