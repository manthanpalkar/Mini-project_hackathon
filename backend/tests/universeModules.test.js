const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const { app } = require('../server');

describe('UniVerse Extension Modules (B, C, D, E) Health & Route Verification', () => {
  let server;
  let baseUrl;
  let originalReadyState;

  before(async () => {
    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (originalReadyState !== undefined) {
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: originalReadyState,
        configurable: true
      });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('Module B (Ride-Pooling) health check responds 200 OK', async () => {
    const res = await fetch(`${baseUrl}/api/modules/b/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'ready');
    assert.match(json.module, /Ride-Pooling/);
  });

  test('Module C (Sustainable Computing) health check responds 200 OK', async () => {
    const res = await fetch(`${baseUrl}/api/modules/c/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'ready');
    assert.match(json.module, /Sustainable Computing/);
  });

  test('Module D (Digital Wellbeing) health check responds 200 OK', async () => {
    const res = await fetch(`${baseUrl}/api/modules/d/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'ready');
    assert.match(json.module, /Digital Wellbeing/);
  });

  test('Module E (Exam Monitoring) health check responds 200 OK', async () => {
    const res = await fetch(`${baseUrl}/api/modules/e/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'ready');
    assert.match(json.module, /Responsible Examination Monitoring/);
  });
});
