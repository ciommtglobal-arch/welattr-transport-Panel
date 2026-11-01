FROM node:20-slim

WORKDIR /app

# pnpm aktif et
RUN corepack enable && corepack prepare pnpm@latest --activate

# Paket dosyalarını kopyala
COPY package.json pnpm-lock.yaml* ./

# Bağımlılıkları pnpm ile yükle
RUN pnpm install --prod

# Tüm kaynak kodları kopyala
COPY . .

# Port ayarı
ENV PORT=10000
EXPOSE 10000

# Uygulamayı başlat
CMD ["node", "server.js"]

