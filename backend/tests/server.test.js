const assert = require('node:assert');
const test = require('node:test');

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
