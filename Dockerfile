FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY shared ./shared
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ARG GIT_SHA=dev
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV GIT_SHA=${GIT_SHA}

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared
COPY server ./server
COPY public ./public
COPY index.html ./

RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/server.js"]