function buildLog(level, message, meta = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };
}

function write(level, message, meta) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const payload = buildLog(level, message, meta);
  const serialized = JSON.stringify(payload);

  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(serialized);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(serialized);
}

function info(message, meta) {
  write('info', message, meta);
}

function error(message, meta) {
  write('error', message, meta);
}

module.exports = {
  info,
  error
};
