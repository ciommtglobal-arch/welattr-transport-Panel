const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildApiProxyTarget,
  createApiProxyHandler,
  isApiProxyPath,
  parseApiUpstreamBase,
} = require('../../api-proxy.cjs');

function responseRecorder() {
  return {
    headersSent: false,
    statusCode: null,
    headers: null,
    body: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
      this.headersSent = true;
    },
    end(body = '') {
      this.body = body;
    },
    destroy() {
      this.destroyed = true;
    },
  };
}

test('API proxy routes only the API and Kasa API path prefixes', () => {
  assert.equal(isApiProxyPath('/api'), true);
  assert.equal(isApiProxyPath('/api/staff/access'), true);
  assert.equal(isApiProxyPath('/kasa/api/requests'), true);
  assert.equal(isApiProxyPath('/apiary'), false);
  assert.equal(isApiProxyPath('/assets/app.js'), false);
  assert.equal(isApiProxyPath('/api/__clerk/npm/file.js'), true);
});

test('upstream configuration accepts an exact HTTPS origin and local development', () => {
  assert.equal(parseApiUpstreamBase(' https://welattr-api-test.onrender.com/ '), 'https://welattr-api-test.onrender.com');
  assert.equal(parseApiUpstreamBase('http://localhost:5000'), 'http://localhost:5000');
  assert.throws(() => parseApiUpstreamBase('http://example.com'));
  assert.throws(() => parseApiUpstreamBase('https://example.com/api'));
  assert.throws(() => parseApiUpstreamBase('https://user:pass@example.com'));
});

test('proxy target preserves the API path and query on the configured host', () => {
  assert.equal(
    buildApiProxyTarget('https://api.example.com', '/api/staff/access?view=compact'),
    'https://api.example.com/api/staff/access?view=compact',
  );
  assert.equal(buildApiProxyTarget('https://api.example.com', '/about'), null);
});

test('unconfigured proxy fails closed with JSON instead of returning the SPA', async () => {
  const proxy = createApiProxyHandler({ upstreamBase: '' });
  const res = responseRecorder();
  const handled = await proxy({ method: 'GET', url: '/api/health', headers: {} }, res);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(res.body), { error: 'API service is not configured.' });
});

test('proxy forwards browser session headers to the fixed API origin', async () => {
  const res = responseRecorder();
  const req = {
    method: 'GET',
    url: '/api/staff/access?view=compact',
    headers: {
      host: 'panel.mmtglobal.com.tr',
      cookie: '__session=example',
      origin: 'https://panel.mmtglobal.com.tr',
      'content-length': '12',
      connection: 'keep-alive',
    },
  };
  let seen;
  const proxy = createApiProxyHandler({
    upstreamBase: 'https://api.example.com',
    fetchImpl: async (url, options) => {
      seen = { url: String(url), options };
      return { status: 204, headers: new Headers({ 'x-upstream': 'ok' }), body: null };
    },
  });

  await proxy(req, res);

  assert.equal(seen.url, 'https://api.example.com/api/staff/access?view=compact');
  assert.equal(seen.options.method, 'GET');
  assert.equal(seen.options.headers.get('cookie'), '__session=example');
  assert.equal(seen.options.headers.get('origin'), 'https://panel.mmtglobal.com.tr');
  assert.equal(seen.options.headers.get('x-forwarded-host'), 'panel.mmtglobal.com.tr');
  assert.equal(seen.options.headers.get('x-forwarded-proto'), 'https');
  assert.equal(seen.options.headers.has('content-length'), false);
  assert.equal(seen.options.headers.has('connection'), false);
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['x-upstream'], 'ok');
});
