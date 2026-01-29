// Discord + WhatsApp Bridge Bot - Versión Final Corregida
require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

const CONFIG_FILE = './config.json';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;

let config = {
    targetChannelId: null,
    whatsappGroup: null,
    communityName: '✨📖 El Club De Monika 🗡️✨',
    channelName: 'Avisos'
};

if (fs.existsSync(CONFIG_FILE)) {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = { ...config, ...savedConfig };
}

const saveConfig = () => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

const discordClient = new DiscordClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote']
    }
});

// --- SISTEMA DE VINCULACIÓN ---
whatsappClient.on('qr', async () => {
    if (WHATSAPP_PHONE) {
        try {
            console.log('⏳ Esperando 5s para evitar error de carga en WhatsApp...');
            await new Promise(resolve => setTimeout(resolve, 5000)); 
            
            const pairingCode = await whatsappClient.requestPairingCode(WHATSAPP_PHONE);
            console.log('\n' + '='.repeat(40));
            console.log(`🔑 CÓDIGO DE VINCULACIÓN: ${pairingCode}`);
            console.log('='.repeat(40));
        } catch (err) {
            console.error('❌ Error al solicitar código:', err.message);
        }
    }
});

whatsappClient.on('ready', () => console.log('✅ WhatsApp Conectado!'));

// Reenvío de mensajes
whatsappClient.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        if (!chat.isGroup) return;

        const isTarget = (config.whatsappGroup && chat.name === config.whatsappGroup) || 
                         chat.name.toLowerCase().includes(config.channelName.toLowerCase());

        if (!isTarget || !config.targetChannelId) return;

        const channel = await discordClient.channels.fetch(config.targetChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `📱 WhatsApp: ${message.author || message.from}` })
                .setDescription(message.body || '*Multimedia*')
                .setColor(0x25D366)
                .setTimestamp();
            await channel.send({ embeds: [embed] });
        }
    } catch (e) { console.error('Error reenvío:', e); }
});

// Comandos de Discord (CORREGIDOS)
discordClient.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    if (msg.content.startsWith('!setcanal')) {
        config.targetChannelId = msg.channel.id;
        saveConfig();
        msg.reply('✅ Canal de destino guardado.');
    }

    if (msg.content === '!status') {
        const waStatus = whatsappClient.info ? '✅ Conectado' : '❌ Desconectado';
        msg.reply(`📊 **Estado:**\nWA: ${waStatus}\nDiscord: ✅ Online`);
    }
});

whatsappClient.initialize();
discordClient.login(DISCORD_TOKEN);
