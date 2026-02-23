const request = require('supertest');
const { app } = require('../src/app');

describe('http behaviors', () => {
  it('attaches a request id header and body on health responses', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body.ok).toBe(true);
    expect(response.body.service).toBe('headless-form-api');
  });

  it('echoes inbound x-request-id', async () => {
    const response = await request(app)
      .get('/health')
      .set('x-request-id', 'req-12345')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('req-12345');
  });

  it('blocks dashboard route for disallowed origins with 403', async () => {
    const response = await request(app)
      .get('/api/forms')
      .set('origin', 'https://evil.example')
      .expect(403);

    expect(response.body.error).toBe('CORS blocked for dashboard origin.');
    expect(response.body.request_id).toBeDefined();
  });

  it('allows preflight for configured dashboard origins', async () => {
    const response = await request(app)
      .options('/api/forms')
      .set('origin', 'http://localhost:5173')
      .set('access-control-request-method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
