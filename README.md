# 🤖 WhatsApp-Discord Bridge Bot

Bot que conecta mensajes de WhatsApp con Discord, permitiendo recibir avisos de grupos de WhatsApp directamente en canales de Discord.

## ✨ Características

- 📱 Recibe mensajes de grupos de WhatsApp
- 💬 Envía mensajes formateados a Discord
- ⚙️ Configuración fácil mediante comandos
- 🐳 Listo para Docker
- 🚀 CI/CD automatizado

## 📋 Requisitos Previos

- Node.js 18 o superior
- Una cuenta de Discord con permisos de administrador
- Una cuenta de WhatsApp
- (Opcional) Docker y Docker Compose

## 🚀 Instalación Rápida

### Método 1: Instalación Local

1. **Clonar el repositorio**
   ```bash
   git clone <tu-repo>
   cd whatsapp-discord-bridge
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp env.example .env
   ```
   Edita `.env` y añade tu token de Discord:
   ```
   DISCORD_TOKEN=tu_token_aqui
   ```

4. **Crear un bot de Discord**
   - Ve a https://discord.com/developers/applications
   - Crea una nueva aplicación
   - Ve a "Bot" y copia el token
   - Activa los "Privileged Gateway Intents": 
     - Message Content Intent
     - Server Members Intent
   - Invita el bot a tu servidor con permisos de:
     - Send Messages
     - Embed Links
     - Read Message History

5. **Iniciar el bot**
   ```bash
   npm start
   ```

6. **Escanear código QR**
   - Aparecerá un código QR en la terminal
   - Abre WhatsApp en tu teléfono
   - Ve a Configuración → Dispositivos vinculados
   - Escanea el código QR

### Método 2: Docker

1. **Configurar variables de entorno**
   ```bash
   cp env.example .env
   # Edita .env con tu token
   ```

2. **Iniciar con Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Ver logs y escanear QR**
   ```bash
   docker-compose logs -f
   ```

## 🎮 Comandos del Bot

Una vez el bot esté en tu servidor de Discord:

| Comando | Descripción |
|---------|-------------|
| `!setcanal` | Configura el canal actual para recibir mensajes |
| `!setgrupo <nombre>` | Configura el grupo de WhatsApp a escuchar |
| `!status` | Muestra el estado y configuración actual |
| `!ayuda` | Muestra la lista de comandos |

## 📝 Configuración Paso a Paso

### 1. Configurar el canal de Discord

En el canal donde quieres recibir los mensajes, escribe:
```
!setcanal
```

### 2. Configurar el grupo de WhatsApp

Escribe el nombre exacto del grupo de WhatsApp:
```
!setgrupo Avisos Comunidad
```

### 3. Verificar configuración

```
!status
```

¡Listo! Los mensajes del grupo de WhatsApp ahora aparecerán en Discord.

## 🔧 CI/CD Pipeline

El proyecto incluye un pipeline completo de GitHub Actions con:

### Stages del Pipeline

1. **🧪 Test**: Ejecuta pruebas y linting
2. **🐳 Build**: Construye y publica imagen Docker
3. **🚀 Deploy**: Despliega automáticamente a producción
4. **📢 Notify**: Notifica el resultado del pipeline

### Configurar CI/CD

1. **Agregar secrets en GitHub**:
   - `SSH_PRIVATE_KEY`: Clave SSH para el servidor
   - `SERVER_HOST`: IP o dominio del servidor
   - `SERVER_USER`: Usuario SSH
   - `DISCORD_WEBHOOK_URL`: (Opcional) Para notificaciones

2. **Preparar el servidor**:
   ```bash
   # En tu servidor VPS
   sudo apt update
   sudo apt install docker docker-compose git
   
   cd /opt
   git clone <tu-repo> whatsapp-discord-bridge
   cd whatsapp-discord-bridge
   
   # Configurar .env
   cp env.example .env
   nano .env
   ```

3. **Push a main**: El deploy se ejecuta automáticamente

## 🐳 Docker

### Build manual
```bash
docker build -t whatsapp-discord-bridge .
```

### Ejecutar
```bash
docker run -d \
  --name whatsapp-bot \
  -e DISCORD_TOKEN=tu_token \
  -v $(pwd)/.wwebjs_auth:/app/.wwebjs_auth \
  -v $(pwd)/config.json:/app/config.json \
  whatsapp-discord-bridge
```

## 📁 Estructura del Proyecto

```
.
├── bot.js                  # Código principal del bot
├── package.json            # Dependencias
├── Dockerfile             # Imagen Docker
├── docker-compose.yml     # Orquestación Docker
├── .github/
│   └── workflows/
│       └── ci-cd.yml      # Pipeline CI/CD
├── env.example            # Template de variables
└── README.md              # Esta documentación
```

## 🔒 Seguridad

- ⚠️ **Nunca** compartas tu token de Discord
- 🔐 Mantén `.env` fuera del control de versiones
- 🔑 La sesión de WhatsApp se guarda localmente
- 🛡️ Usa variables de entorno en producción

## 🐛 Solución de Problemas

### El bot no se conecta a Discord
- Verifica que el token sea correcto
- Comprueba que los intents estén activados

### No aparece el código QR de WhatsApp
- Revisa que Chromium esté instalado
- En Docker, verifica los logs: `docker-compose logs -f`

### Los mensajes no llegan a Discord
- Usa `!status` para verificar la configuración
- Comprueba que el nombre del grupo sea exacto
- Asegúrate de que el bot tenga permisos en el canal

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

MIT License - Siente libre de usar este proyecto como quieras.

## 🆘 Soporte

Si encuentras algún problema, abre un issue en GitHub.

---

Desarrollado con ❤️ para conectar comunidades
