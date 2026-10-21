# cobros · NestJS. Se construye desde la raíz del repo (contexto ".") porque usa el lockfile del workspace.
FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/cobros/package.json services/cobros/
COPY services/cobros/prisma services/cobros/prisma
COPY services/cobros/prisma.config.ts services/cobros/
RUN pnpm install --filter @abasto/cobros --frozen-lockfile
COPY services/cobros services/cobros
RUN pnpm --filter @abasto/cobros build
WORKDIR /repo/services/cobros
ENV NODE_ENV=production
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node prisma/semilla.mjs && node dist/main.js"]
