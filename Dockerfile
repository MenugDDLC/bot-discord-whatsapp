FROM node:18-bullseye

# Instalar Chromium y dependencias necesarias para Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libnss3 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Configurar variables de entorno para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (usamos install porque no hay lockfile)
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Crear directorios de sesión con permisos totales
RUN mkdir -p .wwebjs_auth .wwebjs_cache && chmod -R 777 .wwebjs_auth .wwebjs_cache

# Ejecutar como root para garantizar acceso a Chromium en Render
USER root

# Comando de inicio (ejecuta el servidor web que luego llama al bot)
CMD ["node", "index.js"]
