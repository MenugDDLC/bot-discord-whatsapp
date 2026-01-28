# 📝 index.js vs bot.js - ¿Cuál usar?

## ✅ Solución Implementada

Ahora el proyecto incluye **ambos archivos**:

- **`index.js`** - Punto de entrada principal (llama a bot.js)
- **`bot.js`** - Código completo del bot

## 🎯 ¿Cuál necesitas en WispByte?

### Opción 1: Usar index.js (RECOMENDADO)

Si el comando de inicio en WispByte ya dice `/home/container/index.js`, **no cambies nada**.

El archivo `index.js` que te acabo de crear simplemente carga `bot.js`, así que ambos archivos trabajan juntos.

**✅ Ventaja:** No necesitas modificar nada en WispByte

---

### Opción 2: Cambiar a bot.js directamente

Si prefieres ir directo al grano, cambia el comando de inicio en WispByte:

**Comando ORIGINAL (con index.js):**
```bash
/usr/local/bin/node /home/container/index.js
```

**Comando MODIFICADO (con bot.js):**
```bash
/usr/local/bin/node /home/container/bot.js
```

**✅ Ventaja:** Más directo, un archivo menos

---

## 📂 Estructura de Archivos

```
whatsapp-discord-bridge/
├── index.js          ← Punto de entrada (llama a bot.js)
├── bot.js            ← Código principal del bot
├── package.json      ← Dependencias
├── Dockerfile        ← Para Docker
├── docker-compose.yml
├── .gitignore
└── README.md
```

## 🚀 Comandos de Inicio

Ambos funcionan igual:

```bash
# Usando index.js (predeterminado)
npm start

# Usando bot.js directamente
npm run start:bot

# Desarrollo con recarga automática
npm run dev
```

## ❓ ¿Qué archivo subir a GitHub?

**AMBOS archivos:**
- `index.js`
- `bot.js`
- `package.json`

De esta forma funcionará con cualquier configuración de WispByte.

---

## 🔧 Para WispByte

### Si tu comando de inicio es este:
```bash
/usr/local/bin/node /home/container/index.js
```
✅ **No necesitas cambiar nada** - Sube ambos archivos (index.js y bot.js)

### Si prefieres usar bot.js directamente:
```bash
/usr/local/bin/node /home/container/bot.js
```
✅ **También funciona** - Pero igual sube ambos archivos por si acaso

---

## 📌 Resumen

| Archivo | Descripción | ¿Necesario? |
|---------|-------------|-------------|
| **index.js** | Punto de entrada que carga bot.js | ✅ Sí (para compatibilidad) |
| **bot.js** | Código completo del bot | ✅ Sí (contiene la lógica) |
| **package.json** | Dependencias y scripts | ✅ Sí (esencial) |

**Conclusión:** Sube **ambos archivos** a GitHub y funcionará con cualquier configuración de WispByte.
