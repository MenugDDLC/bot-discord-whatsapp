FROM node:18-bullseye

# Instalar dependencias de Chromium para WhatsApp Web
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Configurar Chromium para que Puppeteer lo encuentre
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copiar y ejecutar instalación
COPY package*.json ./
RUN npm ci --only=production

# Copiar el resto del código
COPY . .

# Crear carpetas para la sesión de WhatsApp
RUN mkdir -p .wwebjs_auth .wwebjs_cache

# Permisos para el usuario botuser
RUN useradd -m -u 1000 botuser && \
    chown -R botuser:botuser /app
USER botuser

# IMPORTANTE: Iniciar con index.js para que Render no apague el bot
CMD ["node", "index.js"]

