const { Readable } = require('node:stream');

const HOP_BY_HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host',
]);

function isApiProxyPath(pathname) {
  return pathname === '/api'
    || pathname.startsWith('/api/')
    || pathname === '/kasa/api'
    || pathname.startsWith('/kasa/api/');
}

function parseApiUpstreamBase(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('MMT_API_UPSTREAM_URL must be an exact HTTPS origin.');
  }

  const localDevelopment = parsed.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  const isExactOrigin = raw === parsed.origin || raw === parsed.origin + '/';
  if (
    (parsed.protocol !== 'https:' && !localDevelopment)
    || !isExactOrigin
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('MMT_API_UPSTREAM_URL must be an exact HTTPS origin (HTTP is allowed only for localhost).');
  }

  return parsed.origin;
}

function buildApiProxyTarget(upstreamBase, requestUrl) {
  const base = parseApiUpstreamBase(upstreamBase);
  if (!base) return null;
  const incoming = new URL(requestUrl, 'http://localhost');
  if (!isApiProxyPath(incoming.pathname)) return null;
  return new URL(incoming.pathname + incoming.search, base).toString();
}

function createApiProxyHandler({ upstreamBase, fetchImpl = fetch } = {}) {
  const base = parseApiUpstreamBase(upstreamBase);

  return async function proxyApiRequest(req, res, requestUrl = req.url) {
    const incoming = new URL(requestUrl, 'http://localhost');
    if (!isApiProxyPath(incoming.pathname)) return false;

    if (!base) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'API service is not configured.' }));
      return true;
    }

    const target = new URL(incoming.pathname + incoming.search, base);
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers || {})) {
      const key = name.toLowerCase();
      if (value && !HOP_BY_HOP_HEADERS.has(key) && key !== 'content-length') {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }
    headers.set('x-forwarded-host', req.headers?.host || 'panel.mmtglobal.com.tr');
    headers.set('x-forwarded-proto', 'https');

    try {
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const upstream = await fetchImpl(target, {
        method: req.method,
        headers,
        ...(hasBody ? { body: req, duplex: 'half' } : {}),
        redirect: 'manual',
      });
      const responseHeaders = {};
      for (const [name, value] of upstream.headers) {
        const key = name.toLowerCase();
        if (
          !HOP_BY_HOP_HEADERS.has(key)
          && !['content-encoding', 'content-length', 'content-range', 'accept-ranges'].includes(key)
        ) {
          responseHeaders[name] = value;
        }
      }
      const cookies = upstream.headers.getSetCookie?.();
      if (cookies?.length) responseHeaders['set-cookie'] = cookies;

      res.writeHead(upstream.status, responseHeaders);
      if (req.method === 'HEAD' || !upstream.body) {
        res.end();
      } else {
        Readable.fromWeb(upstream.body).on('error', () => res.destroy()).pipe(res);
      }
    } catch {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      }
      res.end(JSON.stringify({ error: 'API service is temporarily unavailable.' }));
    }
    return true;
  };
}

module.exports = {
  buildApiProxyTarget,
  createApiProxyHandler,
  isApiProxyPath,
  parseApiUpstreamBase,
};
