require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds] });

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--single-process']
    }
});

let updateQR = null;

// --- MODO ESPÍA: IMPRIMIR TODO ---
whatsappClient.on('ready', async () => {
    console.log('✅ WhatsApp Conectado (Modo Diagnóstico)');
    console.log('🔍 Buscando chats disponibles...');

    try {
        const chats = await whatsappClient.getChats();
        
        console.log('------------------------------------------------');
        console.log(`📂 Se encontraron ${chats.length} chats.`);
        
        // Imprimir cada chat para que busques el tuyo
        chats.forEach((chat, index) => {
            if (chat.isGroup || chat.isReadOnly) { // Filtramos solo grupos o canales
                console.log(`${index + 1}. Nombre: "${chat.name}" | ID: ${chat.id._serialized}`);
            }
        });
        console.log('------------------------------------------------');
        console.log('👉 Busca en esta lista el nombre exacto de tu canal de avisos.');
        
    } catch (e) {
        console.log('Error obteniendo chats:', e.message);
    }
});

// También escuchamos CUALQUIER mensaje que entre para ver su origen
whatsappClient.on('message', async (msg) => {
    const chat = await msg.getChat();
    console.log(`📩 MENSAJE RECIBIDO DE: "${chat.name}" | ID: ${chat.id._serialized} | TIPO: ${msg.type}`);
});

// Escuchamos mensajes que TÚ envías
whatsappClient.on('message_create', async (msg) => {
    if (msg.fromMe) {
        const chat = await msg.getChat();
        console.log(`📤 TU ENVIASTE EN: "${chat.name}" | ID: ${chat.id._serialized} | CONTENIDO: ${msg.body}`);
    }
});

whatsappClient.on('qr', qr => { if (updateQR) updateQR(qr); });
whatsappClient.initialize().catch(err => console.log("Error init:", err));
discordClient.login(DISCORD_TOKEN);

module.exports.setQRHandler = h => { updateQR = h; };

// Servidor web básico para mantener Koyeb vivo y mostrar QR
const http = require('http');
const server = http.createServer((req, res) => res.end('Bot Diagnostico Activo'));
server.listen(8080);
