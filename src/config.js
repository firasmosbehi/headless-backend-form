const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://postgres:postgres@localhost:5432/headless_form'),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  ALLOWED_DASHBOARD_ORIGINS: z.string().default('http://localhost:5173'),
  PUBLIC_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  PUBLIC_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  PUBLIC_BODY_LIMIT: z.string().default('100kb'),
  RECAPTCHA_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('no-reply@example.com')
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast on broken runtime config.
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

const cfg = parsed.data;

module.exports = {
  nodeEnv: cfg.NODE_ENV,
  isProd: cfg.NODE_ENV === 'production',
  isTest: cfg.NODE_ENV === 'test',
  port: cfg.PORT,
  databaseUrl: cfg.DATABASE_URL,
  trustProxy: cfg.TRUST_PROXY,
  allowedDashboardOrigins: cfg.ALLOWED_DASHBOARD_ORIGINS
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  publicRateLimitWindowMs: cfg.PUBLIC_RATE_LIMIT_WINDOW_MS,
  publicRateLimitMax: cfg.PUBLIC_RATE_LIMIT_MAX,
  publicBodyLimit: cfg.PUBLIC_BODY_LIMIT,
  recaptchaSecret: cfg.RECAPTCHA_SECRET,
  resendApiKey: cfg.RESEND_API_KEY,
  emailFrom: cfg.EMAIL_FROM
};
