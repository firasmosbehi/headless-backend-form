const { validateSubmissionPayload } = require('../src/services/payloadValidation');

describe('submission payload validation', () => {
  it('accepts valid payload', () => {
    const result = validateSubmissionPayload({
      data: {
        email: 'a@example.com',
        message: 'hello',
        agreed: true
      }
    });

    expect(result.success).toBe(true);
  });

  it('rejects giant field values', () => {
    const result = validateSubmissionPayload({
      data: {
        message: 'x'.repeat(5001)
      }
    });

    expect(result.success).toBe(false);
  });

  it('rejects too many fields', () => {
    const data = {};
    for (let i = 0; i < 101; i += 1) {
      data[`k${i}`] = 'v';
    }

    const result = validateSubmissionPayload({ data });
    expect(result.success).toBe(false);
  });
});
