FROM node:18-bullseye

# Instalar Chromium y dependencias de sistema
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libnss3 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Variables de entorno para Puppeteer en Railway
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Crear carpetas de sesión y dar permisos totales para el volumen de Railway
RUN mkdir -p .wwebjs_auth .wwebjs_cache && chmod -R 777 .wwebjs_auth .wwebjs_cache

EXPOSE 3000

# Comando de inicio
CMD ["node", "index.js"]
