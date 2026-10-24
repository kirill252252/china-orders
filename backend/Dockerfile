# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Установка зависимостей
COPY package*.json ./
RUN npm ci --only=production

# Копирование исходного кода
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/

# Создание пользователя для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

USER nodejs

EXPOSE 3000

CMD ["node", "src/app.js"]