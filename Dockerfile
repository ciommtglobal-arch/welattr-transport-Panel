FROM node:20-slim

WORKDIR /app

COPY . .

ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.js"]
