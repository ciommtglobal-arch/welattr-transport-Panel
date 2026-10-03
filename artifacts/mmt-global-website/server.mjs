import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const publicDir = path.join(path.dirname(filename), 'dist', 'public');

export function readPort(value = process.env.PORT ?? '5000') {
  const port = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

export function createWebsiteApp(directory = publicDir) {
  const indexFile = path.join(directory, 'index.html');
  if (!existsSync(indexFile)) {
    throw new Error('Website build is missing. Run the website build before starting the server.');
  }

  const app = express();
  app.disable('x-powered-by');

  // API requests belong to the separately routed API service, not the SPA.
  app.use(['/api', '/kasa/api'], (_req, res) => {
    res.status(404).json({ error: 'API requests must use the API service.' });
  });

  app.use(express.static(directory, {
    dotfiles: 'ignore',
    setHeaders(res, file) {
      if (path.extname(file) === '.html') res.setHeader('Cache-Control', 'no-store');
    },
  }));

  // Express 5 named wildcard includes "/" and direct links to company/auth pages.
  app.get('/{*splat}', (req, res, next) => {
    const missingAsset = req.path.split('/').some((segment) => segment.startsWith('.')) ||
      req.path.startsWith('/assets/') ||
      /\.(?:js|mjs|css|map|json|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|pdf|txt|xml)$/i.test(req.path);
    if (missingAsset || !req.accepts('html')) {
      res.status(404).type('text').send('Not found');
      return;
    }
    res.sendFile(indexFile, { headers: { 'Cache-Control': 'no-store' } }, (error) => {
      if (error) next(error);
    });
  });

  app.use((_req, res) => res.status(404).type('text').send('Not found'));
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(500).type('text').send('The website could not be loaded.');
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === filename) {
  const port = readPort();
  const server = createWebsiteApp().listen(port, '0.0.0.0', () => {
    process.stdout.write(JSON.stringify({ level: 'info', event: 'website_listening', port }) + '\n');
  });
  server.on('error', (error) => {
    process.stderr.write(JSON.stringify({ level: 'error', event: 'website_start_failed', code: error.code }) + '\n');
    process.exit(1);
  });
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      const deadline = setTimeout(() => process.exit(1), 10000);
      deadline.unref();
      server.close(() => {
        clearTimeout(deadline);
        process.exit(0);
      });
    });
  }
}