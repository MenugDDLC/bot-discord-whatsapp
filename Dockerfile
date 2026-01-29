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

# Configurar Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias usando install para evitar errores de package-lock
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Crear directorios necesarios para la sesión
RUN mkdir -p .wwebjs_auth .wwebjs_cache

# Ejecutamos como root para evitar el error de useradd/chown en Render
# Render maneja la seguridad de sus contenedores internamente
USER root

# Comando de inicio usando el index.js (servidor web)
CMD ["node", "index.js"]
