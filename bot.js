// bot.js - Versión Segura para GitHub y Render
require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

// --- VARIABLES DE ENTORNO ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PHONE_NUMBER = process.env.PHONE_NUMBER; // Se cargará desde Render

// Configuración de persistencia
const CONFIG_FILE = './config.json';
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

// Clientes
const discordClient = new DiscordClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process']
    }
});

// --- SISTEMA DE VINCULACIÓN POR NÚMERO ---
whatsappClient.on('qr', async () => {
    if (!PHONE_NUMBER) {
        console.error('❌ ERROR: No se ha configurado la variable PHONE_NUMBER en Render.');
        return;
    }
    try {
        const code = await whatsappClient.requestPairingCode(PHONE_NUMBER);
        console.log('\n' + '='.repeat(40));
        console.log(`🔑 CÓDIGO DE VINCULACIÓN: ${code}`);
        console.log('='.repeat(40));
        console.log(`Ingresa este código en tu WhatsApp vinculado al: ${PHONE_NUMBER}\n`);
    } catch (err) {
        console.error('❌ Error al pedir código:', err);
    }
});

whatsappClient.on('ready', () => console.log('✅ WhatsApp Conectado!'));

// Reenvío de mensajes WA -> Discord
whatsappClient.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        if (!chat.isGroup) return;

        const isTarget = (config.whatsappGroup && chat.name === config.whatsappGroup) || 
                         chat.name.toLowerCase().includes(config.channelName.toLowerCase());

        if (!isTarget || !config.targetChannelId) return;

        const contact = await message.getContact();
        const channel = await discordClient.channels.fetch(config.targetChannelId);
        
        if (channel) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `📱 ${contact.pushname || contact.number}` })
                .setDescription(message.body || '*[Multimedia]*')
                .setColor(0x25D366)
                .setFooter({ text: `${config.communityName} → ${chat.name}` })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        }
    } catch (e) { console.error('Error reenvío:', e); }
});

// Comandos de Discord
discordClient.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    if (msg.content.startsWith('!setcanal')) {
        config.targetChannelId = msg.channel.id;
        saveConfig();
        msg.reply('✅ Canal de destino guardado.');
    }
});

// Inicio
(async () => {
    if (!DISCORD_TOKEN) {
        console.error("❌ ERROR: Falta DISCORD_TOKEN en las variables de entorno.");
        process.exit(1);
    }
    await whatsappClient.initialize();
    await discordClient.login(DISCORD_TOKEN);
})();
