const { generateApiKey, hashApiKey } = require('../src/services/apiKeys');

describe('api key service', () => {
  it('generates key with hash and prefix', () => {
    const key = generateApiKey();

    expect(key.raw.startsWith('hbf_live_')).toBe(true);
    expect(key.hash).toHaveLength(64);
    expect(key.prefix).toHaveLength(16);
    expect(hashApiKey(key.raw)).toBe(key.hash);
  });
});
