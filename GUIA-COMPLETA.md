# 🚀 Guía Completa: Deploy del Bot WhatsApp-Discord

## 📋 Tabla de Contenidos
1. [Preparar GitHub](#1-preparar-github)
2. [Configurar el Bot de Discord](#2-configurar-el-bot-de-discord)
3. [Configurar WispByte](#3-configurar-wispbyte)
4. [Conectar GitHub con WispByte](#4-conectar-github-con-wispbyte)
5. [Primera Ejecución](#5-primera-ejecución)
6. [Uso del Bot](#6-uso-del-bot)

---

## 1. Preparar GitHub

### Paso 1.1: Crear el repositorio
1. Ve a [GitHub](https://github.com) e inicia sesión
2. Haz clic en el botón verde **"New"** (o el **+** arriba a la derecha → New repository)
3. Configura el repositorio:
   - **Repository name**: `whatsapp-discord-bot` (o el nombre que prefieras)
   - **Description**: "Bot que conecta WhatsApp con Discord"
   - Marca como **Private** (recomendado por seguridad)
   - NO marques "Add a README file" (ya lo tenemos)
4. Haz clic en **"Create repository"**

### Paso 1.2: Subir el código a GitHub

#### Opción A: Usando Git en tu computadora
```bash
# 1. Abre la terminal en la carpeta donde descargaste los archivos
cd ruta/a/whatsapp-discord-bridge

# 2. Inicializa git
git init

# 3. Agrega todos los archivos
git add .

# 4. Haz el primer commit
git commit -m "Initial commit: WhatsApp-Discord bot"

# 5. Conecta con tu repositorio (usa la URL que te dio GitHub)
git remote add origin https://github.com/TU_USUARIO/whatsapp-discord-bot.git

# 6. Sube los archivos
git branch -M main
git push -u origin main
```

#### Opción B: Subir archivos directamente desde GitHub
1. En tu repositorio nuevo, haz clic en **"uploading an existing file"**
2. Arrastra todos los archivos del bot
3. Escribe un mensaje de commit: "Initial commit"
4. Haz clic en **"Commit changes"**

### Paso 1.3: Configurar GitHub Actions (opcional pero recomendado)
1. En tu repositorio, ve a **Settings** → **Secrets and variables** → **Actions**
2. Haz clic en **"New repository secret"**
3. Agrega estos secrets (uno por uno):

| Name | Value | Descripción |
|------|-------|-------------|
| `DISCORD_TOKEN` | `tu_token_de_discord` | Token del bot (lo obtendrás en el paso 2) |
| `DISCORD_WEBHOOK_URL` | `url_del_webhook` | (Opcional) Para notificaciones |

---

## 2. Configurar el Bot de Discord

### Paso 2.1: Crear la aplicación
1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Haz clic en **"New Application"**
3. Dale un nombre: "WhatsApp Bridge Bot"
4. Acepta los términos y haz clic en **"Create"**

### Paso 2.2: Configurar el Bot
1. En el menú lateral, ve a **"Bot"**
2. Haz clic en **"Add Bot"** → **"Yes, do it!"**
3. En la sección **TOKEN**:
   - Haz clic en **"Reset Token"** → **"Yes, do it!"**
   - **IMPORTANTE**: Copia el token y guárdalo (nunca lo compartas)
   - Este token lo necesitarás para WispByte

### Paso 2.3: Activar permisos necesarios
En la misma página de Bot, baja hasta **"Privileged Gateway Intents"** y activa:
- ✅ **Presence Intent**
- ✅ **Server Members Intent**
- ✅ **Message Content Intent**

Haz clic en **"Save Changes"**

### Paso 2.4: Invitar el bot a tu servidor
1. Ve a **"OAuth2"** → **"URL Generator"** en el menú lateral
2. En **SCOPES**, marca:
   - ✅ `bot`
   - ✅ `applications.commands`
3. En **BOT PERMISSIONS**, marca:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Use Slash Commands
4. Copia la URL generada al final
5. Pégala en tu navegador y selecciona tu servidor
6. Haz clic en **"Autorizar"**

---

## 3. Configurar WispByte

### Paso 3.1: Crear el servidor
1. En WispByte, ve a **"Servidores"** o **"Servers"**
2. Haz clic en **"Crear servidor"** o **"Create server"**
3. Selecciona:
   - **Tipo**: Node.js (o Custom si te pide imagen Docker)
   - **Imagen**: `nodejs_20` o la versión más reciente de Node.js
   - **Recursos**: Los que necesites (mínimo 512MB RAM)

### Paso 3.2: Configurar el comando de inicio
En la configuración del servidor de WispByte, configura:

**Comando de inicio**:
```bash
if [[ -d .git ]] && [[ ! -d node_modules ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -f /home/container/package.json ]]; then /usr/local/bin/npm install; fi; if [[ -f package.json ]]; then /usr/local/bin/npm install; fi; /usr/local/bin/node /home/container/index.js
```

**IMPORTANTE**: Cambia la última parte a:
```bash
/usr/local/bin/node /home/container/bot.js
```

El comando completo quedaría:
```bash
if [[ -d .git ]] && [[ ! -d node_modules ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -f /home/container/package.json ]]; then /usr/local/bin/npm install; fi; if [[ -f package.json ]]; then /usr/local/bin/npm install; fi; /usr/local/bin/node /home/container/bot.js
```

### Paso 3.3: Variables de entorno
En la sección **"Variables de entorno"** o **"Environment Variables"** de WispByte, agrega:

| Variable | Valor |
|----------|-------|
| `DISCORD_TOKEN` | El token que copiaste del Discord Developer Portal |
| `NODE_ENV` | `production` |

---

## 4. Conectar GitHub con WispByte

### Método 1: Deploy automático desde GitHub (Recomendado)

Si WispByte soporta integración con GitHub:

1. En WispByte, busca la opción **"GitHub"** o **"Git"** en la configuración del servidor
2. Conecta tu cuenta de GitHub
3. Selecciona el repositorio `whatsapp-discord-bot`
4. Selecciona la rama `main`
5. Guarda la configuración

Cada vez que hagas `git push`, WispByte actualizará el bot automáticamente.

### Método 2: Subir archivos manualmente

Si WispByte no tiene integración con GitHub:

1. Descarga todos los archivos del repositorio de GitHub como ZIP
2. En WispByte, ve al **File Manager** o **Administrador de archivos**
3. Sube todos los archivos:
   - `bot.js`
   - `package.json`
   - `.gitignore` (opcional)
   - NO subas `node_modules` (se instalará automáticamente)
4. Asegúrate de que `package.json` y `bot.js` estén en la raíz

### Método 3: Usar el instalador de GitHub de WispByte

Según tu captura de pantalla, WispByte tiene una función de instalación desde GitHub:

1. En la consola de WispByte, busca **"Instalación"** o **"Installation"**
2. Pega la URL de tu repositorio de GitHub:
   ```
   https://github.com/TU_USUARIO/whatsapp-discord-bot
   ```
3. WispByte clonará el repositorio automáticamente

---

## 5. Primera Ejecución

### Paso 5.1: Instalar dependencias
1. En WispByte, ve a **"Consola"** o **"Console"**
2. Antes de iniciar el servidor, ejecuta:
   ```bash
   npm install
   ```
   O simplemente inicia el servidor (el comando de inicio instalará las dependencias)

### Paso 5.2: Iniciar el servidor
1. Haz clic en **"Start"** o **"Iniciar"**
2. Espera a que aparezca en la consola:
   ```
   🚀 Iniciando bot...
   📱 Escanea este código QR con WhatsApp:
   ```

### Paso 5.3: Conectar WhatsApp
1. **Verás un código QR en la consola de WispByte**
2. En tu teléfono:
   - Abre **WhatsApp**
   - Ve a **Configuración** (⋮) → **Dispositivos vinculados**
   - Toca **"Vincular un dispositivo"**
   - Escanea el QR que apareció en la consola
3. Espera a ver el mensaje:
   ```
   ✅ WhatsApp conectado correctamente
   ✅ Discord bot conectado como [nombre_del_bot]
   ```

### Paso 5.4: Verificar que funciona
En Discord, escribe:
```
!status
```
Deberías ver un mensaje mostrando el estado de conexión.

---

## 6. Uso del Bot

### Configuración inicial en Discord

1. **Elige el canal** donde quieres recibir mensajes de WhatsApp
2. En ese canal, escribe:
   ```
   !setcanal
   ```
3. El bot responderá: "✅ Canal configurado correctamente"

4. **Configura el grupo de WhatsApp** (usa el nombre exacto):
   ```
   !setgrupo Avisos Comunidad
   ```
5. El bot responderá: "✅ Grupo de WhatsApp configurado"

### Comandos disponibles

| Comando | Uso |
|---------|-----|
| `!setcanal` | Configura el canal actual |
| `!setgrupo <nombre>` | Configura el grupo de WhatsApp |
| `!status` | Muestra el estado actual |
| `!ayuda` | Lista de comandos |

### ¡Listo! 🎉
Los mensajes del grupo de WhatsApp ahora llegarán automáticamente al canal de Discord configurado.

---

## 🔧 Solución de Problemas

### El bot no inicia en WispByte
- Verifica que el comando de inicio termine en `/bot.js`
- Revisa que `DISCORD_TOKEN` esté en las variables de entorno
- Mira los logs en la consola para ver errores

### No aparece el código QR
- Asegúrate de que la imagen Docker sea Node.js 18+
- Verifica que todas las dependencias se instalaron correctamente
- Reinicia el servidor

### El bot no recibe mensajes de WhatsApp
- Verifica con `!status` que todo esté configurado
- Asegúrate de usar el nombre EXACTO del grupo de WhatsApp
- El grupo debe tener mensajes recientes

### El bot se desconecta de WhatsApp
- La sesión de WhatsApp se guarda en `.wwebjs_auth`
- En WispByte, asegúrate de que este directorio persista
- Si el servidor se reinicia mucho, escanea el QR nuevamente

---

## 📝 Notas Importantes

1. **Persistencia de datos**: La configuración se guarda en `config.json`. En WispByte, asegúrate de que este archivo persista entre reinicios.

2. **Sesión de WhatsApp**: La carpeta `.wwebjs_auth` contiene tu sesión. No la borres o tendrás que escanear el QR nuevamente.

3. **Actualizaciones**: Para actualizar el bot:
   - Haz cambios en GitHub
   - Haz `git push`
   - En WispByte, reinicia el servidor (se actualizará automáticamente si está conectado a GitHub)

4. **Seguridad**: NUNCA compartas tu `DISCORD_TOKEN` ni subas archivos `.env` a GitHub.

---

¿Necesitas ayuda con algún paso específico? ¡Solo pregunta! 🚀
