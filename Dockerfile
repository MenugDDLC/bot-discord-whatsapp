FROM node:18-bullseye

# Instalar Chromium y fuentes mínimas
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Variables de entorno para ahorrar RAM
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_OPTIONS="--max-old-space-size=400"
ENV PORT=10000

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Corregido: Separación del punto
COPY . .

# Permisos
RUN mkdir -p .wwebjs_auth .wwebjs_cache && chmod -R 777 .wwebjs_auth .wwebjs_cache

EXPOSE 8080

CMD ["node", "index.js"]
