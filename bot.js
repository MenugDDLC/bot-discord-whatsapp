require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

whatsappClient.on('qr', async () => {
    if (WHATSAPP_PHONE) {
        try {
            console.log('⏳ Iniciando protocolo de vinculación (espera 5s)...');
            await new Promise(r => setTimeout(r, 5000)); 

            const pairingCode = await whatsappClient.requestPairingCode(WHATSAPP_PHONE);
            console.log('\n' + '⭐'.repeat(20));
            console.log(`🔑 TU CÓDIGO ES: ${pairingCode}`);
            console.log('⭐'.repeat(20) + '\n');
        } catch (err) {
            console.error('❌ Error vinculación:', err.message);
        }
    }
});

whatsappClient.on('ready', () => console.log('✅ WhatsApp Conectado en Koyeb'));

const discordClient = new DiscordClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

whatsappClient.initialize();
discordClient.login(DISCORD_TOKEN);
