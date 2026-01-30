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

// --- 1. AL INICIAR: Imprimir lista de grupos ---
whatsappClient.on('ready', async () => {
    console.log('✅ WhatsApp Conectado (MODO ESPÍA)');
    console.log('🔍 Escaneando chats... Espera un momento.');

    try {
        const chats = await whatsappClient.getChats();
        console.log('\n--- LISTA DE GRUPOS/CANALES ---');
        chats.forEach(chat => {
            // Solo mostramos grupos o canales de anuncios
            if (chat.isGroup || chat.isReadOnly) {
                console.log(`📌 Nombre: "${chat.name}"`);
                console.log(`🆔 ID: ${chat.id._serialized}`);
                console.log('-----------------------------------');
            }
        });
        console.log('--- FIN DE LA LISTA ---\n');
    } catch (e) {
        console.log('Error leyendo chats:', e.message);
    }
});

// --- 2. AL RECIBIR MENSAJE: Imprimir ID del remitente ---
const logMessage = async (msg) => {
    try {
        const chat = await msg.getChat();
        const fromId = msg.fromMe ? msg.to : msg.from; // Si lo envías tú, cogemos el destino. Si te lo envían, el origen.
        
        console.log(`\n📩 ¡MENSAJE DETECTADO!`);
        console.log(`📂 Nombre del Chat: "${chat.name}"`);
        console.log(`🔑 ID EXACTO: ${fromId}`); // <--- ESTE ES EL DATO QUE NECESITAMOS
        console.log(`💬 Contenido: ${msg.body}`);
        console.log('-----------------------------------\n');
    } catch (e) { console.log("Error log:", e.message); }
};

// Escuchamos TODO: lo que llega y lo que tú envías
whatsappClient.on('message', logMessage);
whatsappClient.on('message_create', logMessage); 

whatsappClient.on('qr', qr => { 
    if (updateQR) updateQR(qr); 
});

whatsappClient.initialize().catch(err => console.log("Error init:", err.message));
discordClient.login(DISCORD_TOKEN);

// Exportación simple para que index.js no falle
module.exports.setQRHandler = (handler) => { updateQR = handler; };
