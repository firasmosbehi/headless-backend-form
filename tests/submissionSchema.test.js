const { validateAgainstFormSchema } = require('../src/services/submissionSchema');

describe('validateAgainstFormSchema', () => {
  it('passes when form schema is empty', () => {
    const result = validateAgainstFormSchema({ name: 'Jane' }, {});
    expect(result.success).toBe(true);
  });

  it('fails when required field is missing', () => {
    const result = validateAgainstFormSchema(
      { name: 'Jane' },
      { email: { type: 'string', required: true } }
    );

    expect(result.success).toBe(false);
    expect(result.error.fieldErrors.email).toContain('Required field is missing.');
  });

  it('fails when value type does not match expected type', () => {
    const result = validateAgainstFormSchema(
      { age: '22' },
      { age: { type: 'number', required: true } }
    );

    expect(result.success).toBe(false);
    expect(result.error.fieldErrors.age).toContain('Expected number.');
  });

  it('fails on string and number bounds', () => {
    const result = validateAgainstFormSchema(
      { message: 'hi', score: 3 },
      {
        message: { type: 'string', minLength: 5 },
        score: { type: 'number', minimum: 5 }
      }
    );

    expect(result.success).toBe(false);
    expect(result.error.fieldErrors.message).toContain('Must be at least 5 characters.');
    expect(result.error.fieldErrors.score).toContain('Must be >= 5.');
  });

  it('passes when values satisfy rule set', () => {
    const result = validateAgainstFormSchema(
      { email: 'owner@example.com', age: 24, tier: 'pro', active: true },
      {
        email: { type: 'string', required: true, minLength: 3, maxLength: 255 },
        age: { type: 'number', minimum: 18, maximum: 100 },
        tier: { type: 'string', enum: ['free', 'pro'] },
        active: { type: 'boolean' }
      }
    );

    expect(result.success).toBe(true);
  });
});
