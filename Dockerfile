FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM node:20-alpine
WORKDIR /app

RUN addgroup -S nodeapp && adduser -S -G nodeapp nodeapp

COPY --chown=nodeapp:nodeapp package*.json ./

RUN npm ci --only=production

COPY --from=builder --chown=nodeapp:nodeapp /app/build ./build

EXPOSE 8002

ENV NODE_ENV=production \
    API_PORT=8002

USER nodeapp

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8002/health || exit 1

CMD ["node", "build/api/server.js"]
