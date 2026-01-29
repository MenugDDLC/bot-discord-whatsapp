# 🤖 WhatsApp-Discord Bridge Bot

Bot que conecta mensajes de WhatsApp con Discord usando **código de emparejamiento** (sin necesidad de escanear QR).

## ✨ Características

- 📱 Conecta con WhatsApp usando código de 8 dígitos
- 💬 Reenvía mensajes de WhatsApp a Discord con formato elegante
- ⚙️ Configuración simple mediante comandos en Discord
- 🚀 Listo para Render.com (gratis)
- 🏘️ Pre-configurado para "El Club De Monika"

## 🎯 Pre-configurado para

- **Comunidad**: ✨📖 El Club De Monika 🗡️✨
- **Canal**: Avisos

## 📋 Requisitos

- Node.js 18 o superior
- Token de bot de Discord
- Número de WhatsApp
- Cuenta en Render.com (gratis)

## 🚀 Deploy en Render (Recomendado)

### Paso 1: Preparar el repositorio

1. Sube estos archivos a GitHub:
   - `bot.js`
   - `index.js`
   - `package.json`
   - `render.yaml`
   - `.gitignore`

### Paso 2: Crear bot de Discord

1. Ve a https://discord.com/developers/applications
2. Crea nueva aplicación → Bot → Copia el token
3. Activa los intents:
   - ✅ Message Content Intent
   - ✅ Server Members Intent
   - ✅ Presence Intent
4. Invita el bot a tu servidor con permisos:
   - Send Messages, Embed Links, Read Message History

### Paso 3: Deploy en Render

1. Ve a https://render.com y regístrate con GitHub
2. New + → Web Service
3. Conecta tu repositorio
4. Render detectará `render.yaml` automáticamente
5. Agrega variables de entorno:
   - `DISCORD_TOKEN`: Tu token del bot
   - `WHATSAPP_PHONE`: Tu número (formato: 521234567890)
6. Haz clic en "Create Web Service"

### Paso 4: Vincular WhatsApp

1. Espera a que el deploy termine
2. Ve a "Logs" en Render
3. Verás algo como:
   ```
   ═══════════════════════════════════════
   📱 CÓDIGO DE EMPAREJAMIENTO: ABCD-1234
   ═══════════════════════════════════════
   ```
4. En tu teléfono:
   - Abre WhatsApp
   - Configuración → Dispositivos vinculados
   - "Vincular un dispositivo"
   - "Vincular con número de teléfono"
   - Ingresa el código: `ABCD-1234`

### Paso 5: Configurar Discord

En el canal donde quieres recibir mensajes:
```
!setcanal
```

¡Listo! ✅

## 📱 Formato del Número de WhatsApp

**Muy importante**: El número debe estar en formato internacional SIN el signo `+`, espacios ni guiones.

| País | Tu número | Formato correcto |
|------|-----------|------------------|
| 🇲🇽 México | +52 123 456 7890 | `521234567890` |
| 🇨🇴 Colombia | +57 300 123 4567 | `573001234567` |
| 🇪🇸 España | +34 612 34 56 78 | `34612345678` |
| 🇦🇷 Argentina | +54 11 2345 6789 | `541123456789` |
| 🇺🇸 USA | +1 234 567 8900 | `12345678900` |

## 💬 Comandos de Discord

| Comando | Descripción |
|---------|-------------|
| `!setcanal` | Configura el canal actual para recibir mensajes |
| `!setgrupo <nombre>` | Configura un grupo adicional de WhatsApp |
| `!setcomunidad <nombre>` | Cambia el nombre de la comunidad |
| `!setcanal-wa <nombre>` | Cambia el canal de WhatsApp (por defecto: Avisos) |
| `!status` | Muestra la configuración actual |
| `!ayuda` | Lista de comandos |

## 🔧 Instalación Local (Opcional)

```bash
# Clonar repositorio
git clone <tu-repo>
cd whatsapp-discord-bridge

# Instalar dependencias
npm install

# Configurar variables
cp .env.example .env
# Edita .env con tus credenciales

# Iniciar
npm start
```

## 📁 Estructura del Proyecto

```
whatsapp-discord-bridge/
├── bot.js              # Lógica principal del bot
├── index.js            # Servidor Express para Render
├── package.json        # Dependencias
├── render.yaml         # Configuración de Render
├── .env.example        # Template de variables
├── .gitignore          # Archivos a ignorar
└── README.md           # Esta documentación
```

## 🐛 Solución de Problemas

### No aparece el código de emparejamiento

- Verifica que `WHATSAPP_PHONE` esté configurado
- El formato debe ser: `521234567890` (sin +, espacios ni guiones)
- Revisa los logs en Render para ver errores

### El código no funciona

- El código expira en unos minutos
- Solicita uno nuevo reiniciando el servicio en Render
- Asegúrate de que el número sea el mismo que configuraste

### Los mensajes no llegan a Discord

- Verifica con `!status` que todo esté configurado
- El bot debe estar en el canal "Avisos" de la comunidad
- Asegúrate de que el nombre del canal/comunidad sea exacto

### El bot se desconecta

- Render puede dormir el servicio después de inactividad
- Usa UptimeRobot.com (gratis) para hacer ping cada 10 minutos
- URL para ping: tu-app.onrender.com/health

## 🔒 Seguridad

- ✅ Nunca subas `.env` a GitHub
- ✅ Usa variables de entorno en Render
- ✅ El token de Discord es secreto
- ✅ La sesión de WhatsApp se guarda localmente

## 🆘 Soporte

¿Problemas? Abre un issue en GitHub.

## 📄 Licencia

MIT License

---

Desarrollado con ❤️ para conectar comunidades
