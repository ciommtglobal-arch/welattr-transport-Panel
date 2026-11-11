const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;

// Derlenen MMT Global web panelinin statik klasörü
const distDir = path.join(__dirname, 'artifacts/mmt-global-website/dist/public');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  // Gelen isteğin URL'ini temizle (query parametrelerini ayır)
  const safeUrl = req.url.split('?')[0];

  // Sağlık kontrolü
  if (req.method === 'GET' && safeUrl === '/api/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8'
    });
    res.end(JSON.stringify({
      status: 'OK',
      uptime: process.uptime()
    }));
    return;
  }

  let filePath = path.join(distDir, safeUrl === '/' ? 'index.html' : safeUrl);
  let ext = path.extname(filePath).toLowerCase();

  // Dosya mevcut mu kontrol et
  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      // Dosya bulundu, istemciye gönder
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // SPA (Single Page Application) yönlendirmesi: Bulunamayan rotalarda index.html'e dön
    const indexPath = path.join(distDir, 'index.html');
    fs.readFile(indexPath, (indexErr, content) => {
      if (indexErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Arayüz dosyaları artifacts klasöründe bulunamadı.');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MMT Global Web Paneli aktif: http://0.0.0.0:${PORT}`);
});
