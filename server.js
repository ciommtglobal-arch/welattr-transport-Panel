import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'WelatTR API calisiyor' });
});

app.get('/', (req, res) => {
  res.send(`
    <!doctype html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>WelatTR Lojistik Panel</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #0f172a;
          color: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
        }
        .box {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 16px;
          padding: 32px 48px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        h1 { margin: 0 0 12px 0; font-size: 28px; }
        p { margin: 0; color: #cbd5e1; }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>WelatTR Lojistik Panel</h1>
        <p>Render startup hatasi cozuldu. Sunucu calisiyor.</p>
      </div>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
