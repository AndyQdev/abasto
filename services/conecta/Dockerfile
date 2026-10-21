# conecta · NestJS. Se construye desde la raíz del repo (contexto ".") porque usa el lockfile del workspace.
FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/conecta/package.json services/conecta/

RUN pnpm install --filter @abasto/conecta --frozen-lockfile
COPY services/conecta services/conecta
RUN pnpm --filter @abasto/conecta build
WORKDIR /repo/services/conecta
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
