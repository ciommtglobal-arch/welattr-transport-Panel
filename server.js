const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;

function findIndexHtml(baseDir) {
  const possiblePaths = [
    path.join(baseDir, 'index.html'),
    path.join(baseDir, 'public', 'index.html'),
    path.join(baseDir, 'static', 'index.html'),
    path.join(baseDir, 'dist', 'index.html'),
    path.join(baseDir, 'build', 'index.html'),
    path.join(baseDir, 'client', 'index.html')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
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

const server = http.createServer((req, res) => {
  const indexPath = findIndexHtml(__dirname);
  
  if (indexPath && fs.existsSync(indexPath)) {
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Dosya okuma hatasi');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fallbackHtml);
  }
});

server.listen(PORT, () => {
  console.log(`MMT Global Web Paneli aktif. Port: ${PORT}`);
});
