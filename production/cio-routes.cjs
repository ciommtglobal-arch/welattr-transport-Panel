const { constants } = require('node:fs');
const { open } = require('node:fs/promises');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { authPolicy, authorize, projectRows, projectTaskBoard } = require('./cio-security.cjs');

const paths = new Set(['access', 'task-board', 'memory', 'corporate-follow-up']);
const boardPath = '/etc/secrets/mmt-cio-task-board.md';
const loadPg = createRequire(resolve(__dirname, '../lib/db/package.json'));

function makeSources(env, policy) {
  let pool;
  return {
    async withTenant(action) {
      if (!pool) {
        const url = new URL(env.MMT_CIO_READ_DATABASE_URL);
        const database = decodeURIComponent(url.pathname.slice(1));
        if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.search || url.hash ||
            !url.hostname || !database || !url.username || !url.password ||
            url.hostname !== env.MMT_CIO_EXPECTED_DATABASE_HOST ||
            database !== env.MMT_CIO_EXPECTED_DATABASE_NAME) throw new Error('unverified source');
        const { Pool } = loadPg('pg');
        pool = new Pool({
          host: url.hostname, port: Number(url.port || 5432), database,
          user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
          ssl: { rejectUnauthorized: true }, max: 3, connectionTimeoutMillis: 3000,
          statement_timeout: 3000, query_timeout: 3500, idleTimeoutMillis: 10000,
        });
        pool.on('error', () => { /* Never log driver errors containing private configuration. */ });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const scope = [policy.tenant, policy.founder];
        const { rowCount } = await client.query(
          `SELECT 1 FROM public.b2b_business_profiles
           WHERE id = $1 AND owner_clerk_user_id = $2 AND status = 'verified'`, scope);
        if (rowCount !== 1) return null;
        return { items: await action(client, scope) };
      } finally {
        try { await client.query('ROLLBACK'); client.release(); }
        catch { client.release(true); }
      }
    },
    async read(kind) {
      return this.withTenant(async (client, scope) => {
        if (kind === 'access') return [];
        // These existing sources have owner-only (or no per-row) scope. Never use
        // them as tenant sources until this exact workspace's ownership is attested.
        if (env.MMT_CIO_OWNER_ONLY_SOURCES_VERIFIED !== 'true') throw new Error('unverified source');
        if (kind === 'task-board') {
          const file = await open(boardPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
          try {
            const info = await file.stat();
            const max = 512 * 1024;
            if (!info.isFile() || (info.mode & 0o077) !== 0 || info.size > max) throw new Error('unsafe board');
            const contents = Buffer.alloc(max + 1);
            let length = 0;
            while (length < contents.length) {
              const { bytesRead } = await file.read(contents, length, contents.length - length, null);
              if (!bytesRead) break;
              length += bytesRead;
            }
            if (length > max) throw new Error('unsafe board');
            return projectTaskBoard(contents.toString('utf8', 0, length));
          } finally { await file.close(); }
        }
        const corporate = kind === 'corporate-follow-up';
        const query = corporate
          ? `SELECT id, version, at, approval FROM (
               SELECT DISTINCT ON (record_id) record_id AS id, version, created_at AS at,
                 event ->> 'approval' AS approval FROM public.founder_follow_up_versions
               WHERE owner_clerk_user_id = $1 ORDER BY record_id, version DESC
             ) latest ORDER BY at DESC, id LIMIT 100`
          : `SELECT id, version, created_at AS at FROM public.memory_store
             WHERE owner_clerk_user_id = $1 ORDER BY created_at DESC, id LIMIT 100`;
        // The first query verified the tenant and owner in this same read-only snapshot.
        const { rows } = await client.query(query, [scope[1]]);
        return projectRows(rows, corporate);
      });
    },
  };
}

function createCioRoutes(env = process.env, make = makeSources) {
  const policy = authPolicy(env);
  let source;
  return async (req, res, pathname) => {
    const kind = pathname.slice('/api/staff/cio/'.length);
    const json = (status, value) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        ...(status === 405 ? { Allow: 'GET' } : {}),
      });
      res.end(JSON.stringify(value));
    };
    if (!paths.has(kind)) return json(404, { error: 'not_found' });
    if (req.method !== 'GET') return json(405, { error: 'method_not_allowed' });
    const status = authorize(req.headers.authorization, policy);
    if (status !== 200) return json(status, { error: status === 401 ? 'unauthenticated' :
      status === 403 ? 'forbidden' : 'unverified' });
    try {
      source ??= make(env, policy);
      const result = await source.read(kind);
      if (!result) return json(403, { error: 'forbidden' });
      return json(200, kind === 'access' ? { role: 'founder' } : result);
    } catch {
      return json(503, { error: 'unverified' });
    }
  };
}

module.exports = { createCioRoutes };
