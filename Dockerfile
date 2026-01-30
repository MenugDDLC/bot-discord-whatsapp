FROM node:18-bullseye

# Instalar dependencias esenciales para Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libnss3 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Variables de entorno críticas
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PORT=8080

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Permisos para persistencia de sesión
RUN mkdir -p .wwebjs_auth .wwebjs_cache && chmod -R 777 .wwebjs_auth .wwebjs_cache

# Koyeb usa a menudo el puerto 8080 por defecto
EXPOSE 8080

CMD ["node", "index.js"]
