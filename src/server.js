const { app } = require('./app');
const config = require('./config');
const { pool } = require('./db/pool');
const logger = require('./lib/logger');

const server = app.listen(config.port, () => {
  logger.info('server.started', { port: config.port, node_env: config.nodeEnv });
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info('server.shutdown.start', { signal });

  server.close(async () => {
    try {
      await pool.end();
      logger.info('server.shutdown.complete');
      process.exit(0);
    } catch (error) {
      logger.error('server.shutdown.failed', { error: error.message });
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('server.shutdown.timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
