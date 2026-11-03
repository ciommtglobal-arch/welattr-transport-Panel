const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// --- 1. TELEGRAM BOT AYARLARI (RESMİ API) ---
// Bot token'ını TELEGRAM_BOT_TOKEN ortam değişkeninde saklayın.
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function callTelegram(method, data) {
  const postData = JSON.stringify(data);
  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${TELEGRAM_TOKEN}/${method}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {});
  req.on('error', (e) => console.error('Telegram hata:', e.message));
  req.write(postData);
  req.end();
}

// Telegram'dan gelen mesajları dinleme (Long Polling)
let lastUpdateId = 0;
function pollTelegramUpdates() {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
  
  https.get(url, (res) => {
    let rawData = '';
    res.on('data', (chunk) => rawData += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(rawData);
        if (json.ok && json.result.length > 0) {
          json.result.forEach((update) => {
            lastUpdateId = update.update_id;
            handleTelegramUpdate(update);
          });
        }
      } catch (err) {
        console.error('Telegram yanıtı işlenemedi:', err.message);
      }
      setTimeout(pollTelegramUpdates, 1000);
    });
  }).on('error', (err) => {
    console.error('Telegram güncellemeleri alınamadı:', err.message);
    setTimeout(pollTelegramUpdates, 5000);
  });
}

function handleTelegramUpdate(update) {
  // 1. Komut Kontrolü (/test_yuk)
  if (update.message && update.message.text && update.message.text.startsWith('/test_yuk')) {
    const chatId = update.message.chat.id;
    const threadId = update.message.message_thread_id;

    const cardText = 
      `🚨 *YENİ OPERASYON TALEBİ (#TST-001)*\n\n` +
      `📍 *Rota:* Cizre (Şırnak) ➡️ Mersin Limanı\n` +
      `📦 *Yük Cinsi:* 24 Ton Paletli Ticari Yük (Dorse)\n` +
      `🚛 *Pilot Araç:* 73 MMT 001\n` +
      `📑 *Evrak Durumu:* Beklemede (Kantar/İrsaliye Yok)\n` +
      `⏳ *Statü:* Yönetici Onayı Bekleniyor`;

    const payload = {
      chat_id: chatId,
      text: cardText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Onayla', callback_data: 'sefer_onayla' },
            { text: '❌ Reddet', callback_data: 'sefer_reddet' }
          ]
        ]
      }
    };
    if (threadId) payload.message_thread_id = threadId;

    callTelegram('sendMessage', payload);
  }

  // 2. Buton Tıklamaları (Callback Query)
  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data;
    const chatId = cb.message.chat.id;
    const messageId = cb.message.message_id;

    callTelegram('answerCallbackQuery', { callback_query_id: cb.id });

    if (data === 'sefer_onayla') {
      const text = 
        `✅ *SEFER ONAYLANDI & BAŞLATILDI (#TST-001)*\n\n` +
        `📍 *Rota:* Cizre ➡️ Mersin Limanı\n` +
        `🚛 *Araç:* 73 MMT 001\n` +
        `🕒 *Başlangıç Kaydı:* ${new Date().toLocaleTimeString('tr-TR')}\n` +
        `📑 *Evrak Zinciri:* Açıldı (Saha yüklemesi bekleniyor)\n\n` +
        `👇 *Lütfen ilgili operasyon butonunu seçin:*`;

      callTelegram('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📸 Kantar Fişi Yükle', callback_data: 'evrak_kantar' },
              { text: '📄 Sevk İrsaliyesi Yükle', callback_data: 'evrak_irsaliye' }
            ],
            [
              { text: '🏁 Teslimatı Mühürle & Kapat', callback_data: 'sefer_kapat' }
            ]
          ]
        }
      });
    } else if (data === 'sefer_reddet') {
      callTelegram('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: `❌ *SEFER İPTAL EDİLDİ (#TST-001)*\n\nYönetici tarafından işlem sonlandırıldı. İlan arşive kaldırıldı.`,
        parse_mode: 'Markdown'
      });
    } else if (data === 'evrak_kantar') {
      callTelegram('sendMessage', {
        chat_id: chatId,
        text: `📸 *#TST-001 Kantar Kaydı:* Fiş sisteme bağlandı. Tartım: *24.180 KG* (Dorse toleransı dahilinde onaylandı).`,
        parse_mode: 'Markdown'
      });
    } else if (data === 'evrak_irsaliye') {
      callTelegram('sendMessage', {
        chat_id: chatId,
        text: `📄 *#TST-001 İrsaliye Kaydı:* Sevk irsaliyesi dijital havuzda mühürlendi. Teslim kodu oluşturuldu: *MMT-TRS-99*`,
        parse_mode: 'Markdown'
      });
    } else if (data === 'sefer_kapat') {
      callTelegram('sendMessage', {
        chat_id: chatId,
        text: `🏁 *#TST-001 SEFER TAMAMLANDI!*\n\nEvrak zinciri doğrulandı, varış onayı alındı. Dijital kanıt raporu arşive işlendi.`,
        parse_mode: 'Markdown'
      });
    }
  }
}

if (TELEGRAM_TOKEN) {
  pollTelegramUpdates();
} else {
  console.warn('TELEGRAM_BOT_TOKEN tanımlı değil; Telegram botu başlatılmadı.');
}

// --- 2. STATİK WEB PANELİ SUNUCUSU ---
const PORT = process.env.PORT || 10000;

// Verilen dizinlerde ve alt klasörlerinde index.html dosyasını bulur.
function findIndexDirectory(directory) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (err) {
    return null;
  }

  if (entries.some((entry) => entry.isFile() && entry.name === 'index.html')) {
    return directory;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const foundDirectory = findIndexDirectory(path.join(directory, entry.name));
      if (foundDirectory) return foundDirectory;
    }
  }

  return null;
}

const possibleDirs = [
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'dist/public'),
  path.join(__dirname, 'artifacts/mmt-transport')
];

let distDir = null;
for (const directory of possibleDirs) {
  distDir = findIndexDirectory(directory);
  if (distDir) break;
}
if (!distDir) distDir = __dirname;

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
  let requestPath;
  try {
    requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Geçersiz istek yolu.');
    return;
  }

  const rootPath = path.resolve(distDir);
  const requestedPath = path.resolve(rootPath, `.${requestPath}`);
  if (requestedPath !== rootPath && !requestedPath.startsWith(rootPath + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Erişim reddedildi.');
    return;
  }

  const filePath = requestPath === '/' ? path.join(rootPath, 'index.html') : requestedPath;
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // İstemci tarafı yönlendirmeleri için bulunamayan yolları index.html'e yönlendir.
    fs.readFile(path.join(rootPath, 'index.html'), (indexErr, content) => {
      if (indexErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('MMT Global Arayuz Dosyasi Bulunamadi.');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MMT Global Web Paneli aktif. Port: ${PORT}`);
});
