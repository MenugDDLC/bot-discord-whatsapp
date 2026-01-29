FROM node:18-bullseye

# Instalar Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libnss3 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# Permisos para archivos de sesión
RUN mkdir -p .wwebjs_auth .wwebjs_cache && chmod -R 777 .wwebjs_auth .wwebjs_cache

# Ejecutar como root es necesario para Puppeteer en Render Free
USER root

EXPOSE 3000
CMD ["node", "index.js"]
