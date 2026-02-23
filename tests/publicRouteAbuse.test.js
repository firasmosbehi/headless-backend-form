jest.mock('../src/db/pool', () => ({
  pool: {
    query: jest.fn()
  }
}));

jest.mock('../src/services/spam', () => ({
  detectHoneypot: jest.fn(),
  verifyRecaptcha: jest.fn()
}));

jest.mock('../src/services/email', () => ({
  sendFormNotification: jest.fn().mockResolvedValue({ sent: false, skipped: true })
}));

const request = require('supertest');
const { app } = require('../src/app');
const { pool } = require('../src/db/pool');
const { detectHoneypot, verifyRecaptcha } = require('../src/services/spam');
const { sendFormNotification } = require('../src/services/email');

function mockPoolForPublicRoute() {
  pool.query.mockImplementation((sql, params) => {
    if (sql.includes('FROM forms')) {
      return Promise.resolve({
        rowCount: 1,
        rows: [
          {
            id: params[0],
            name: 'Contact',
            notify_email: 'owner@example.com',
            is_active: true
          }
        ]
      });
    }

    if (sql.includes('INSERT INTO submissions')) {
      return Promise.resolve({
        rows: [{ id: 101, created_at: '2026-02-23T00:00:00.000Z' }]
      });
    }

    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
}

describe('public submission abuse controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolForPublicRoute();
    detectHoneypot.mockReturnValue({ isSpam: false, reason: null });
    verifyRecaptcha.mockResolvedValue({ ok: true, skipped: true });
  });

  it('accepts valid submission and sends notification', async () => {
    const response = await request(app)
      .post('/f/form-valid')
      .send({ data: { name: 'Jane', message: 'Hello' } })
      .expect(201);

    expect(response.body.accepted).toBe(true);
    expect(sendFormNotification).toHaveBeenCalledTimes(1);
  });

  it('marks submission as spam via honeypot and suppresses email', async () => {
    detectHoneypot.mockReturnValue({ isSpam: true, reason: 'honeypot_triggered' });

    const response = await request(app)
      .post('/f/form-honeypot')
      .send({
        data: { name: 'Spam Bot' },
        website: 'http://bot.example'
      })
      .expect(202);

    expect(response.body.accepted).toBe(true);
    expect(sendFormNotification).not.toHaveBeenCalled();

    const insertCall = pool.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO submissions'));
    expect(insertCall[1][4]).toBe(true);
    expect(insertCall[1][5]).toBe('honeypot_triggered');
  });

  it('marks submission as spam when recaptcha verification fails', async () => {
    verifyRecaptcha.mockResolvedValue({ ok: false, reason: 'recaptcha_failed' });

    await request(app)
      .post('/f/form-recaptcha')
      .send({ data: { name: 'Suspicious User' }, recaptchaToken: 'bad-token' })
      .expect(202);

    expect(sendFormNotification).not.toHaveBeenCalled();
    const insertCall = pool.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO submissions'));
    expect(insertCall[1][4]).toBe(true);
    expect(insertCall[1][5]).toBe('recaptcha_failed');
  });

  it('rate limits repeated submissions on the same form and ip', async () => {
    for (let i = 0; i < 20; i += 1) {
      await request(app)
        .post('/f/form-rate')
        .send({ data: { attempt: i } })
        .expect(201);
    }

    const response = await request(app)
      .post('/f/form-rate')
      .send({ data: { attempt: 21 } })
      .expect(429);

    expect(response.body.error).toBe('Rate limit exceeded. Please retry later.');
  });
});
