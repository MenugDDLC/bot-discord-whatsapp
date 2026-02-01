FROM node:18-bullseye

# 1. Instalar dependencias esenciales para Puppeteer y Chromium 
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 2. Variables de entorno críticas 
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PORT=8080

WORKDIR /app

# 3. Instalar dependencias primero (aprovecha el cache de capas) 
COPY package*.json ./
RUN npm install --omit=dev

# 4. Corregir error de copiado (el punto debe estar separado) [cite: 1, 2]
COPY . .

# 5. Permisos para persistencia de sesión 
RUN mkdir -p .wwebjs_auth .wwebjs_cache && chmod -R 777 .wwebjs_auth .wwebjs_cache

# 6. Exponer puerto 
EXPOSE 8080

# 7. Ejecutar el servidor web (que a su vez arranca el bot) 
CMD ["node", "index.js"]
