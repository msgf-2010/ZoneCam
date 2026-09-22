FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN node scripts/prisma-for-env.mjs && npx prisma generate && npx next build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "scripts/railway-boot.mjs"]
