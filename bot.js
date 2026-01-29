require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

const CONFIG_FILE = './config.json';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;

let config = { targetChannelId: null, communityName: '✨📖 El Club De Monika 🗡️✨', channelName: 'Avisos' };
if (fs.existsSync(CONFIG_FILE)) {
    try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) { console.error("Error config"); }
}
const saveConfig = () => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

const discordClient = new DiscordClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--disable-extensions'
        ],
        // Esto engaña a WhatsApp para que crea que eres un Chrome real
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

// --- FIX PARA ERROR 't' (REINTENTOS) ---
whatsappClient.on('qr', async () => {
    if (WHATSAPP_PHONE) {
        let attempts = 0;
        const maxAttempts = 3;

        const requestWithRetry = async () => {
            try {
                attempts++;
                console.log(`⏳ Intento ${attempts}: Esperando carga completa de WA Web...`);
                await new Promise(r => setTimeout(r, 15000)); // 15 seg para seguridad

                const pairingCode = await whatsappClient.requestPairingCode(WHATSAPP_PHONE);
                console.log('\n' + '═'.repeat(30));
                console.log(`🔑 TU CÓDIGO: ${pairingCode}`);
                console.log('═'.repeat(30) + '\n');
            } catch (err) {
                console.error(`❌ Error en intento ${attempts}:`, err.message);
                if (attempts < maxAttempts) {
                    console.log('🔄 Reintentando en 10 segundos...');
                    setTimeout(requestWithRetry, 10000);
                }
            }
        };
        requestWithRetry();
    }
});

whatsappClient.on('ready', () => console.log('✅ Conectado a WhatsApp'));

whatsappClient.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        if (!chat.isGroup || !config.targetChannelId) return;
        if (chat.name.toLowerCase().includes(config.channelName.toLowerCase())) {
            const channel = await discordClient.channels.fetch(config.targetChannelId);
            if (channel) {
                const contact = await message.getContact();
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `📱 ${contact.pushname || contact.number}` })
                    .setDescription(message.body || '*Multimedia*')
                    .setColor(0x25D366)
                    .setTimestamp();
                await channel.send({ embeds: [embed] });
            }
        }
    } catch (e) { console.error('Error reenvío:', e); }
});

discordClient.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    if (msg.content.startsWith('!setcanal')) {
        config.targetChannelId = msg.channel.id;
        saveConfig();
        msg.reply('✅ Canal configurado.');
    }
});

whatsappClient.initialize();
discordClient.login(DISCORD_TOKEN);
