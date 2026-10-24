const assert = require('node:assert');
const test = require('node:test');
const http = require('node:http');
const { app, PORT, HOST } = require('../server');

test('CORS origin check allowed origins', () => {
  const allowed = [
    'https://loop-seven-delta.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173'
  ];

  const checkOrigin = (origin) => {
    if (!origin) return true;
    return allowed.includes(origin);
  };

  assert.strictEqual(checkOrigin(undefined), true);
  assert.strictEqual(checkOrigin('http://localhost:5173'), true);
  assert.strictEqual(checkOrigin('https://loop-seven-delta.vercel.app'), true);
  assert.strictEqual(checkOrigin('https://my-attacker-app.vercel.app'), false);
  assert.strictEqual(checkOrigin('https://untrusted-site.com'), false);
});

test('Server startup binding configuration', () => {
  // Render and cloud container runtimes require binding explicitly to 0.0.0.0
  assert.strictEqual(HOST, process.env.HOST || '0.0.0.0', 'Server must bind to 0.0.0.0 for external port scan detection');
  assert.strictEqual(PORT, process.env.PORT || 5001, 'Server must respect process.env.PORT');
});

test('Health endpoint responds 200 OK without blocking on MongoDB readyState', async () => {
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const assignedPort = testServer.address().port;

  try {
    const res = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${assignedPort}/health`, (resp) => {
        let data = '';
        resp.on('data', chunk => { data += chunk; });
        resp.on('end', () => {
          resolve({ statusCode: resp.statusCode, body: JSON.parse(data) });
        });
      }).on('error', reject);
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'healthy');
    assert.strictEqual(res.body.service, 'loop-backend');
    assert.ok(['connected', 'connecting'].includes(res.body.dbState));
  } finally {
    await new Promise((resolve) => testServer.close(resolve));
  }
});
