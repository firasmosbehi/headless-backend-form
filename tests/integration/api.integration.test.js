const request = require('supertest');
const { app } = require('../../src/app');
const { pool } = require('../../src/db/pool');
const { runMigrations } = require('../../src/db/runMigrations');

const describeIntegration = process.env.RUN_INTEGRATION === '1' ? describe : describe.skip;

describeIntegration('API integration (PostgreSQL)', () => {
  beforeAll(async () => {
    await runMigrations({ logger: { log: () => {} } });
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE submissions, forms, api_keys, users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('handles register -> create form -> public submission -> list submissions', async () => {
    const registerResponse = await request(app)
      .post('/api/users/register')
      .send({ email: 'owner@example.com', name: 'Owner' })
      .expect(201);

    const apiKey = registerResponse.body.api_key;

    const formResponse = await request(app)
      .post('/api/forms')
      .set('x-api-key', apiKey)
      .send({ name: 'Contact', notify_email: 'owner@example.com' })
      .expect(201);

    const formId = formResponse.body.form.id;

    const submissionResponse = await request(app)
      .post(`/f/${formId}`)
      .send({ data: { name: 'Jane', message: 'Hello' } })
      .expect(201);

    expect(submissionResponse.body.accepted).toBe(true);
    expect(submissionResponse.body.submission_id).toBeDefined();

    const listResponse = await request(app)
      .get(`/api/forms/${formId}/submissions`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(listResponse.body.submissions).toHaveLength(1);
    expect(listResponse.body.submissions[0].payload).toEqual({ name: 'Jane', message: 'Hello' });
  });

  it('returns 401 for invalid API keys', async () => {
    await request(app)
      .get('/api/forms')
      .set('x-api-key', 'hbf_live_invalid')
      .expect(401);
  });

  it('returns 402 for unpaid plans', async () => {
    const registerResponse = await request(app)
      .post('/api/users/register')
      .send({ email: 'billing@example.com' })
      .expect(201);

    await pool.query(`UPDATE users SET plan = 'unpaid' WHERE email = $1`, ['billing@example.com']);

    await request(app)
      .get('/api/forms')
      .set('x-api-key', registerResponse.body.api_key)
      .expect(402);
  });

  it('supports key creation and revocation', async () => {
    const registerResponse = await request(app)
      .post('/api/users/register')
      .send({ email: 'keys@example.com' })
      .expect(201);

    const firstKey = registerResponse.body.api_key;

    const newKeyResponse = await request(app)
      .post('/api/keys')
      .set('x-api-key', firstKey)
      .expect(201);

    const secondKey = newKeyResponse.body.api_key;

    const keysResponse = await request(app)
      .get('/api/keys')
      .set('x-api-key', firstKey)
      .expect(200);

    expect(keysResponse.body.keys).toHaveLength(2);

    const currentKey = keysResponse.body.keys.find((key) => key.is_current === true);
    expect(currentKey).toBeDefined();

    await request(app)
      .post(`/api/keys/${currentKey.id}/revoke`)
      .set('x-api-key', firstKey)
      .expect(200);

    await request(app)
      .get('/api/forms')
      .set('x-api-key', firstKey)
      .expect(401);

    await request(app)
      .get('/api/forms')
      .set('x-api-key', secondKey)
      .expect(200);
  });

  it('prevents revoking your only active key', async () => {
    const registerResponse = await request(app)
      .post('/api/users/register')
      .send({ email: 'single-key@example.com' })
      .expect(201);

    const key = registerResponse.body.api_key;

    const keysResponse = await request(app)
      .get('/api/keys')
      .set('x-api-key', key)
      .expect(200);

    const currentKey = keysResponse.body.keys.find((item) => item.is_current === true);

    await request(app)
      .post(`/api/keys/${currentKey.id}/revoke`)
      .set('x-api-key', key)
      .expect(409);
  });

  it('enforces per-form submission schema rules', async () => {
    const registerResponse = await request(app)
      .post('/api/users/register')
      .send({ email: 'schema-owner@example.com' })
      .expect(201);

    const apiKey = registerResponse.body.api_key;

    const formResponse = await request(app)
      .post('/api/forms')
      .set('x-api-key', apiKey)
      .send({
        name: 'Typed Contact',
        notify_email: 'schema-owner@example.com',
        schema: {
          email: { type: 'string', required: true },
          age: { type: 'number', required: true, minimum: 18 }
        }
      })
      .expect(201);

    await request(app)
      .post(`/f/${formResponse.body.form.id}`)
      .send({
        data: {
          email: 'owner@example.com',
          age: 'not-a-number'
        }
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.fieldErrors.age).toBeDefined();
      });
  });

  it('paginates form submissions', async () => {
    const registerResponse = await request(app)
      .post('/api/users/register')
      .send({ email: 'paging-owner@example.com', name: 'Paging Owner' })
      .expect(201);

    const apiKey = registerResponse.body.api_key;

    const formResponse = await request(app)
      .post('/api/forms')
      .set('x-api-key', apiKey)
      .send({ name: 'Paging Form', notify_email: 'paging-owner@example.com' })
      .expect(201);

    const formId = formResponse.body.form.id;

    await request(app).post(`/f/${formId}`).send({ data: { idx: 1 } }).expect(201);
    await request(app).post(`/f/${formId}`).send({ data: { idx: 2 } }).expect(201);
    await request(app).post(`/f/${formId}`).send({ data: { idx: 3 } }).expect(201);

    const firstPage = await request(app)
      .get(`/api/forms/${formId}/submissions?limit=2&offset=0`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(firstPage.body.submissions).toHaveLength(2);
    expect(firstPage.body.pagination).toEqual({
      limit: 2,
      offset: 0,
      total: 3,
      has_more: true
    });

    const secondPage = await request(app)
      .get(`/api/forms/${formId}/submissions?limit=2&offset=2`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(secondPage.body.submissions).toHaveLength(1);
    expect(secondPage.body.pagination).toEqual({
      limit: 2,
      offset: 2,
      total: 3,
      has_more: false
    });
  });
});
