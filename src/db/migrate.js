const { runMigrations } = require('./runMigrations');

runMigrations({ closePool: true }).catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
