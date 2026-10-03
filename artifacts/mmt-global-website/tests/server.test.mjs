import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createWebsiteApp, readPort } from '../server.mjs';

let directory, server, origin;
const html = '<!doctype html><html><body>MMT server fixture</body></html>';

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'mmt-web-server-'));
  await mkdir(path.join(directory, 'assets'));
  await writeFile(path.join(directory, 'index.html'), html);
  await writeFile(path.join(directory, 'assets', 'app.js'), 'window.testAsset = true;');
  await writeFile(path.join(directory, '.hidden'), 'private fixture');
  server = createWebsiteApp(directory).listen(0, '0.0.0.0');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
});

test('root, company, staff, recovery and invite deep links serve uncached HTML', async () => {
  for (const route of ['/', '/sign-in', '/sign-in/standart/reset-password', '/b2b-agi/panel?invite=fixture', '/staff/giris', '/staff/yonetim-paneli']) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(await response.text(), html);
  }
});

test('built assets are served as JavaScript, not the page fallback', async () => {
  const response = await fetch(origin + '/assets/app.js');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.equal(await response.text(), 'window.testAsset = true;');
});

test('API, missing files, JSON requests and POST never return SPA HTML', async () => {
  for (const route of ['/api/healthz', '/api/b2b', '/kasa/api/requests', '/assets/missing.js', '/missing.css', '/.hidden']) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 404, route);
    assert.notEqual(await response.text(), html);
  }
  assert.equal((await fetch(origin + '/sign-in', { headers: { Accept: 'application/json' } })).status, 404);
  assert.equal((await fetch(origin + '/sign-in', { method: 'POST' })).status, 404);
});

test('HEAD is supported without a response body', async () => {
  const response = await fetch(origin + '/b2b-agi/panel', { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});

test('invalid ports and missing builds fail explicitly', () => {
  assert.equal(readPort('5000'), 5000);
  assert.equal(readPort('25030'), 25030);
  for (const port of ['', '0', '-1', '65536', 'abc', '1.5', ' 5000 ']) {
    assert.throws(() => readPort(port), /PORT/);
  }
  assert.throws(() => createWebsiteApp(path.join(directory, 'missing')), /build is missing/);
});