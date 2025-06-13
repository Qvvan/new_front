FROM node:18-alpine

WORKDIR /app

COPY . .

RUN addgroup -g 1001 -S nodejs && \
    adduser -S frontend -u 1001 && \
    chown -R frontend:nodejs /app

USER frontend

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["node", "server.js"]