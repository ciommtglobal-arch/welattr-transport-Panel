const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// --- 1. TELEGRAM BOT AYARLARI (SIFIR EK KÜTÜPHANE / RESMİ API) ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'BOT_TOKENINIZI_BURAYA_GIRIN';

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
      } catch (err) {}
      setTimeout(pollTelegramUpdates, 1000);
    });
  }).on('error', (err) => {
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

pollTelegramUpdates();

// --- 2. STATİK WEB PANELİ SUNUCUSU ---
const PORT = process.env.PORT || 10000;

const possibleDirs = [
  path.join(__dirname, 'artifacts/mmt-transport'),
  path.join(__dirname, 'dist/public'),
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'public')
];

let distDir = possibleDirs.find(dir => fs.existsSync(dir)) || __dirname;

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
          res.end('MMT Global Arayuz Dosyasi Bulunamadi.');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MMT Global Web Paneli aktif. Port: ${PORT}`);
});
