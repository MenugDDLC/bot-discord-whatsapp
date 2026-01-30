require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let updateQR = null;

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

whatsappClient.on('qr', (qr) => {
    // 1. Mostrar en consola (por si acaso)
    qrcode.generate(qr, { small: true });
    // 2. Enviar a la web
    if (updateQR) updateQR(qr);
    console.log('📱 QR generado. Míralo en tu URL de Koyeb.');
});

whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp Conectado!');
    if (updateQR) updateQR(null); // Limpia el QR de la web al conectar
});

const discordClient = new DiscordClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Función para conectar con index.js
module.exports.setQRHandler = (handler) => { updateQR = handler; };

whatsappClient.initialize();
discordClient.login(process.env.DISCORD_TOKEN);
