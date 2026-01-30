require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;

// Configuración de WhatsApp con persistencia local
const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote']
    }
});

whatsappClient.on('qr', async () => {
    if (WHATSAPP_PHONE) {
        try {
            console.log('⏳ Cargando WhatsApp Web (5s de espera)...');
            await new Promise(resolve => setTimeout(resolve, 5000)); 

            const pairingCode = await whatsappClient.requestPairingCode(WHATSAPP_PHONE);
            console.log('\n' + '═'.repeat(40));
            console.log(`🔑 CÓDIGO DE VINCULACIÓN: ${pairingCode}`);
            console.log('═'.repeat(40));
        } catch (err) {
            console.error('❌ Error al generar código:', err.message);
        }
    }
});

whatsappClient.on('ready', () => console.log('✅ WhatsApp listo en Railway'));

const discordClient = new DiscordClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Iniciar sesión
whatsappClient.initialize();
discordClient.login(DISCORD_TOKEN);
