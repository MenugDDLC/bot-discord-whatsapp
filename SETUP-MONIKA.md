# 🎮 Configuración Rápida - El Club De Monika

## ✨ Configuración Pre-cargada

El bot ya viene configurado con estos valores por defecto:

```json
{
  "communityName": "✨📖 El Club De Monika 🗡️✨",
  "channelName": "Avisos"
}
```

**¡No necesitas configurar nada más de WhatsApp!** El bot automáticamente escuchará el canal "Avisos" de tu comunidad.

---

## 🚀 Pasos Rápidos

### 1️⃣ Subir a GitHub
Sube todos los archivos (incluyendo el `bot.js` actualizado)

### 2️⃣ Configurar en WispByte
- Token de Discord en variables de entorno
- Iniciar el servidor
- Escanear código QR con WhatsApp

### 3️⃣ En Discord
Solo necesitas configurar el canal de Discord:

```
!setcanal
```

**¡Listo!** Los mensajes del canal "Avisos" empezarán a llegar automáticamente.

---

## 📋 Comandos Disponibles

| Comando | Uso | ¿Necesario? |
|---------|-----|-------------|
| `!setcanal` | Configura el canal de Discord | ✅ **SÍ** |
| `!status` | Ver configuración actual | ✅ Recomendado |
| `!setcomunidad <nombre>` | Cambiar comunidad | ❌ Ya está configurada |
| `!setcanal-wa <nombre>` | Cambiar canal de WhatsApp | ❌ Ya está en "Avisos" |
| `!setgrupo <nombre>` | Grupo adicional (opcional) | ❌ Opcional |
| `!ayuda` | Ver todos los comandos | ℹ️ Info |

---

## 🎯 Funcionamiento

El bot escuchará mensajes de:
1. **Canal "Avisos"** de la comunidad (por defecto) ✅
2. **Cualquier grupo** que tenga "Avisos" en el nombre
3. **Grupo adicional** si usas `!setgrupo` (opcional)

---

## 🔧 Comandos Opcionales (solo si quieres cambiar algo)

### Cambiar la comunidad:
```
!setcomunidad Tu Otra Comunidad
```

### Cambiar el canal de avisos:
```
!setcanal-wa Anuncios
```

### Agregar un grupo adicional:
```
!setgrupo Club de Memes
```

---

## 📊 Verificar Configuración

Escribe en Discord:
```
!status
```

Verás algo como:
```
Discord: ✅ Conectado como WhatsApp Bridge Bot
WhatsApp: ✅ Conectado
Canal de Discord: #avisos
Comunidad de WhatsApp: ✨📖 El Club De Monika 🗡️✨
Canal de WhatsApp: Avisos
Grupo adicional: ⚪ No configurado
```

---

## 💡 Ejemplos de Mensajes

Cuando alguien escriba en el canal "Avisos" de tu comunidad, en Discord aparecerá:

```
┌─────────────────────────────┐
│ 📱 calaca                   │
│                             │
│ ¡Nuevo aviso para todos!   │
│                             │
│ ✨📖 El Club De Monika →    │
│ Avisos                      │
│ 5:48 p.m.                  │
└─────────────────────────────┘
```

---

## ⚠️ Notas Importantes

1. **El bot escucha TODOS los mensajes** del canal "Avisos" - no solo los de administradores
2. **Las comunidades de WhatsApp** son diferentes a los grupos normales
3. **El nombre debe coincidir exactamente** - el bot ya lo tiene configurado
4. **Si cambias el nombre del canal** en WhatsApp, actualízalo con `!setcanal-wa`

---

## 🐛 Solución de Problemas

### Los mensajes no llegan
1. Verifica con `!status` que todo esté configurado
2. Asegúrate de haber escaneado el QR correctamente
3. Revisa los logs de WispByte para ver si hay errores
4. El bot debe estar en la comunidad de WhatsApp

### ¿El bot ve el canal "Avisos"?
El bot mostrará en los logs:
```
📩 Mensaje recibido de: Avisos
✅ Mensaje reenviado de [usuario] desde Avisos
```

Si no ves esto, el bot no está capturando los mensajes.

---

## 🎉 ¡Eso es todo!

La configuración por defecto ya está lista para "El Club De Monika".

Solo necesitas:
1. ✅ Subir código a GitHub
2. ✅ Configurar WispByte
3. ✅ Escanear QR de WhatsApp
4. ✅ Escribir `!setcanal` en Discord

**¡Y funcionará automáticamente!** 🚀
