FROM node:20-slim

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/mmt-global-website build

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["node", "server.js"]
