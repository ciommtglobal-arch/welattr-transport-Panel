const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;

// Olası tüm derleme klasörlerini sırayla kontrol eder
const possibleDirs = [
  path.join(__dirname, 'artifacts/mmt-global-website/dist/public'),
  path.join(__dirname, 'dist/public'),
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'public')
];

let distDir = possibleDirs.find(dir => fs.existsSync(dir)) || path.join(__dirname, 'dist');
console.log(`Statik dosya dizini: ${distDir}`);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  const safeUrl = req.url.split('?')[0];
  let filePath = path.join(distDir, safeUrl === '/' ? 'index.html' : safeUrl);
  let ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      const indexPath = path.join(distDir, 'index.html');
      fs.readFile(indexPath, (indexErr, content) => {
        if (indexErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('MMT Global Arayuz Dosyalari Bulunamadi.');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MMT Global Web Paneli aktif: http://0.0.0.0:${PORT}`);
});

