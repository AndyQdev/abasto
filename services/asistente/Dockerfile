# asistente · NestJS. Se construye desde la raíz del repo (contexto ".") porque usa el lockfile del workspace.
FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/asistente/package.json services/asistente/

RUN pnpm install --filter @abasto/asistente --frozen-lockfile
COPY services/asistente services/asistente
RUN pnpm --filter @abasto/asistente build
WORKDIR /repo/services/asistente
ENV NODE_ENV=production
CMD ["sh", "-c", "node scripts/semilla.mjs && node dist/main.js"]
