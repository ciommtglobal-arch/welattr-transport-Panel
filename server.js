const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;

// Check the production builds first, in the requested priority order.
function findStaticDirectory(baseDir) {
  const possibleDirectories = [
    path.join(baseDir, 'artifacts', 'mmt-global-website', 'dist', 'public'),
    path.join(baseDir, 'artifacts', 'kasa', 'dist', 'public'),
    // Keep common output locations as fallbacks for local and legacy builds.
    path.join(baseDir, 'public'),
    path.join(baseDir, 'static'),
    path.join(baseDir, 'dist', 'public'),
    path.join(baseDir, 'dist'),
    path.join(baseDir, 'build'),
    path.join(baseDir, 'client'),
    baseDir
  ];

  for (const directory of possibleDirectories) {
    const indexPath = path.join(directory, 'index.html');
    try {
      if (fs.statSync(indexPath).isFile()) return directory;
    } catch (error) {
      // This output directory is not present; try the next candidate.
    }
  }
  return null;
}

const staticDirectory = findStaticDirectory(__dirname);
const indexPath = staticDirectory ? path.join(staticDirectory, 'index.html') : null;

if (staticDirectory) {
  console.log(`Statik dosya dizini: ${staticDirectory}`);
} else {
  console.warn('Build çıktısında index.html bulunamadı; dahili panel arayüzü sunuluyor.');
}

const fallbackHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MMT Global Panel</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0b0f19; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; padding: 2.5rem; border-radius: 12px; text-align: center; max-width: 440px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { font-size: 1.5rem; margin-bottom: 0.75rem; color: #38bdf8; }
    p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; }
    .badge { display: inline-block; background: #065f46; color: #34d399; padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div style="margin-bottom: 1rem;"><span class="badge">Sistem Aktif</span></div>
    <h1>MMT Global</h1>
    <p>Yönetim Portalı ve Operasyon Merkezi başarıyla yayında.</p>
  </div>
</body>
</html>`;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf'
};

function sendFile(filePath, res, method) {
  const contentType = contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff' });
  if (method === 'HEAD') {
    res.end();
    return;
  }

  const stream = fs.createReadStream(filePath);
  stream.on('error', (error) => {
    console.error(`Dosya okunamadı (${filePath}):`, error.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Dosya okuma hatasi');
  });
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  if (!staticDirectory) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : fallbackHtml);
    return;
  }

  let requestPath;
  try {
    requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Geçersiz istek yolu.');
    return;
  }

  const rootPath = path.resolve(staticDirectory);
  const requestedFile = path.resolve(rootPath, `.${requestPath}`);
  if (requestedFile !== rootPath && !requestedFile.startsWith(rootPath + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Erişim reddedildi.');
    return;
  }

  const filePath = requestPath === '/' ? indexPath : requestedFile;
  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(filePath, res, req.method);
      return;
    }

    // Serve index.html for client-side routes, but don't disguise missing assets as HTML.
    if (path.extname(requestPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Dosya bulunamadı.');
      return;
    }
    sendFile(indexPath, res, req.method);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MMT Global Web Paneli aktif. Port: ${PORT}`);
});
