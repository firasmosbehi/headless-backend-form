const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function runMigrations(options = {}) {
  const {
    dbPool = pool,
    migrationsDir = path.resolve(__dirname, '../../migrations'),
    logger = console,
    closePool = false
  } = options;

  const client = await dbPool.connect();
  let inTransaction = false;

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const existing = await client.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [file]
      );

      if (existing.rowCount > 0) {
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      inTransaction = true;
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      inTransaction = false;
      logger.log(`Applied migration: ${file}`);
    }

    logger.log('Migrations complete.');
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK');
    }

    throw error;
  } finally {
    client.release();

    if (closePool) {
      await dbPool.end();
    }
  }
}

module.exports = {
  runMigrations
};
