# Web build stage — the server image ships the SPA (SPEC-016 R1: one public service)
FROM node:22-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY server/package*.json server/tsconfig.json ./
RUN npm ci
COPY server/src ./src
COPY server/migrations ./migrations
RUN npm run build
COPY --from=web /web/dist ./web-dist
ENV WEB_DIST=/app/web-dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
