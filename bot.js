require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal'); // Librería para ver el QR en consola
const fs = require('fs');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote']
    }
});

// --- GENERACIÓN DE QR ---
whatsappClient.on('qr', (qr) => {
    console.log('📱 ESCANEA EL SIGUIENTE CÓDIGO QR CON TU WHATSAPP:');
    // Genera el QR pequeño para que quepa bien en los logs de Koyeb
    qrcode.generate(qr, { small: true });
});

whatsappClient.on('ready', () => console.log('✅ WhatsApp Conectado y Listo!'));

const discordClient = new DiscordClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

whatsappClient.initialize();
discordClient.login(DISCORD_TOKEN);

// Reenvío de mensajes (Mantenemos la lógica anterior)
whatsappClient.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        if (!chat.isGroup) return;
        // Aquí puedes añadir tu lógica de filtrado por nombre de grupo
        console.log(`Mensaje recibido de: ${chat.name}`);
    } catch (e) { console.error('Error:', e); }
});
