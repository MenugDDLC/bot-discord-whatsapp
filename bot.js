require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes } = require('discord.js');
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

// --- MODO ESPÍA: ENCONTRAR EL ID ---
whatsappClient.on('ready', async () => {
    console.log('✅ WA Conectado en Modo Espía');
    console.log('🔍 Escaneando lista de chats...');

    try {
        const chats = await whatsappClient.getChats();
        
        console.log('\n--- LISTA DE GRUPOS DETECTADOS ---');
        let count = 0;
        chats.forEach(chat => {
            // Filtramos para mostrar solo grupos o canales de avisos
            if (chat.isGroup || chat.isReadOnly) {
                console.log(`📌 Nombre: "${chat.name}"`);
                console.log(`🆔 ID: ${chat.id._serialized}`);
                console.log('-----------------------------------');
                count++;
            }
        });
        console.log(`📂 Total encontrados: ${count}`);
        console.log('👉 Busca arriba el ID que corresponde a "El Club De Monika" o "Avisos".\n');
        
    } catch (e) {
        console.log('Error obteniendo chats:', e.message);
    }
});

// ESCUCHAR MENSAJES EN TIEMPO REAL PARA CAZAR EL ID
const logMessage = async (msg) => {
    try {
        const chat = await msg.getChat();
        const fromId = msg.fromMe ? msg.to : msg.from;
        
        console.log(`\n📩 NUEVO MENSAJE DETECTADO`);
        console.log(`De: "${chat.name}"`);
        console.log(`🆔 ID DEL CHAT: ${fromId}`);
        console.log(`Contenido: ${msg.body || '[Multimedia]'}`);
        console.log('-----------------------------------\n');
    } catch (e) { console.log("Error log:", e); }
};

whatsappClient.on('message', logMessage);
whatsappClient.on('message_create', logMessage); // Escucha también tus propios mensajes

whatsappClient.on('qr', qr => { 
    if (updateQR) updateQR(qr); 
});

whatsappClient.initialize().catch(err => console.log("Error init:", err.message));
discordClient.login(DISCORD_TOKEN);

// Exportamos solo el manejador de QR, sin crear servidor web extra
module.exports.setQRHandler = (handler) => { updateQR = handler; };
