const { z } = require('zod');

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const submissionSchema = z
  .object({
    data: z.record(z.string().min(1), scalar).refine((obj) => Object.keys(obj).length <= 100, {
      message: 'Too many fields in submission payload.'
    }),
    recaptchaToken: z.string().optional(),
    website: z.string().optional()
  })
  .superRefine((value, ctx) => {
    for (const [key, field] of Object.entries(value.data)) {
      if (typeof field === 'string' && field.length > 5000) {
        ctx.addIssue({
          path: ['data', key],
          code: z.ZodIssueCode.too_big,
          maximum: 5000,
          inclusive: true,
          type: 'string',
          message: 'Field value exceeds max length.'
        });
      }
    }

    const serializedSize = Buffer.byteLength(JSON.stringify(value.data), 'utf8');
    if (serializedSize > 50_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payload too large.'
      });
    }
  });

function validateSubmissionPayload(input) {
  return submissionSchema.safeParse(input);
}

module.exports = {
  validateSubmissionPayload
};
