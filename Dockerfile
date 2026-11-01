FROM node:20-slim

WORKDIR /app

# pnpm aktif et
RUN corepack enable && corepack prepare pnpm@latest --activate

# Paket dosyalarını kopyala
COPY package.json pnpm-lock.yaml* ./

# Düz (hoisted) modül yapısıyla yükle ve express'i garantiye al
RUN pnpm install --shamefully-hoist
RUN pnpm add express

# Tüm kaynak kodları kopyala
COPY . .

# Port ayarı
ENV PORT=10000
EXPOSE 10000

# Uygulamayı başlat
CMD ["node", "server.js"]
