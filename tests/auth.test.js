const { extractApiKey } = require('../src/middleware/auth');

describe('extractApiKey', () => {
  it('reads x-api-key header', () => {
    const req = {
      header(name) {
        if (name === 'x-api-key') return 'abc123';
        return null;
      }
    };

    expect(extractApiKey(req)).toBe('abc123');
  });

  it('reads bearer auth header', () => {
    const req = {
      header(name) {
        if (name === 'authorization') return 'Bearer tokenxyz';
        return null;
      }
    };

    expect(extractApiKey(req)).toBe('tokenxyz');
  });

  it('returns null if absent', () => {
    const req = { header: () => null };
    expect(extractApiKey(req)).toBeNull();
  });
});
