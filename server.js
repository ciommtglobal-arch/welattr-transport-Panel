const http = require('http');
const fs = require('fs');
const path = require('path');

// --- 1. TELEGRAM BOT AYARLARI ---
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN || 'BOT_TOKENINIZI_BURAYA_GIRIN';
const bot = new TelegramBot(token, { polling: true });

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

// --- 3. TELEGRAM BUTON & DİJİTAL KANIT AKIŞI ---

bot.onText(/\/test_yuk/, (msg) => {
  const chatId = msg.chat.id;
  const messageThreadId = msg.message_thread_id;

  const cardText = 
    `🚨 *YENİ OPERASYON TALEBİ (#TST-001)*\n\n` +
    `📍 *Rota:* Cizre (Şırnak) ➡️ Mersin Limanı\n` +
    `📦 *Yük Cinsi:* 24 Ton Paletli Ticari Yük (Dorse)\n` +
    `🚛 *Pilot Araç:* 73 MMT 001\n` +
    `📑 *Evrak Durumu:* Beklemede (Kantar/İrsaliye Yok)\n` +
    `⏳ *Statü:* Yönetici Onayı Bekleniyor`;

  const options = {
    message_thread_id: messageThreadId,
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

  bot.sendMessage(chatId, cardText, options);
});

bot.on('callback_query', (query) => {
  const data = query.data;
  const msg = query.message;
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  if (data === 'sefer_onayla') {
    const approvedText = 
      `✅ *SEFER ONAYLANDI & BAŞLATILDI (#TST-001)*\n\n` +
      `📍 *Rota:* Cizre ➡️ Mersin Limanı\n` +
      `🚛 *Araç:* 73 MMT 001\n` +
      `🕒 *Başlangıç Kaydı:* ${new Date().toLocaleTimeString('tr-TR')}\n` +
      `📑 *Evrak Zinciri:* Açıldı (Saha yüklemesi bekleniyor)\n\n` +
      `👇 *Lütfen ilgili operasyon butonunu seçin:*`;

    const nextButtons = {
      chat_id: chatId,
      message_id: messageId,
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
    };

    bot.editMessageText(approvedText, nextButtons);
  } else if (data === 'sefer_reddet') {
    const rejectedText = 
      `❌ *SEFER İPTAL EDİLDİ (#TST-001)*\n\n` +
      `Yönetici tarafından işlem sonlandırıldı. İlan arşive kaldırıldı.`;

    bot.editMessageText(rejectedText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });
  } else if (data === 'evrak_kantar') {
    bot.sendMessage(chatId, `📸 *#TST-001 Kantar Kaydı:* Fiş sisteme bağlandı. Tartım: *24.180 KG* (Dorse toleransı dahilinde onaylandı).`, {
      message_thread_id: msg.message_thread_id,
      parse_mode: 'Markdown'
    });
  } else if (data === 'evrak_irsaliye') {
    bot.sendMessage(chatId, `📄 *#TST-001 İrsaliye Kaydı:* Sevk irsaliyesi dijital havuzda mühürlendi. Teslim kodu oluşturuldu: *MMT-TRS-99*`, {
      message_thread_id: msg.message_thread_id,
      parse_mode: 'Markdown'
    });
  } else if (data === 'sefer_kapat') {
    bot.sendMessage(chatId, `🏁 *#TST-001 SEFER TAMAMLANDI!*\n\nEvrak zinciri doğrulandı, varış onayı alındı. Dijital kanıt raporu arşive işlendi.`, {
      message_thread_id: msg.message_thread_id,
      parse_mode: 'Markdown'
    });
  }

  bot.answerCallbackQuery(query.id);
});
