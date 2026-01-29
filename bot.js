require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

const CONFIG_FILE = './config.json';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;

let config = { targetChannelId: null, communityName: '✨📖 El Club De Monika 🗡️✨', channelName: 'Avisos' };
if (fs.existsSync(CONFIG_FILE)) {
    try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) { console.error("Error cargando config"); }
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

// --- VINCULACIÓN ---
whatsappClient.on('qr', async () => {
    if (WHATSAPP_PHONE) {
        console.log('⏳ Esperando 5s a que WhatsApp cargue...');
        await new Promise(r => setTimeout(r, 5000));
        try {
            const pairingCode = await whatsappClient.requestPairingCode(WHATSAPP_PHONE);
            console.log('\n' + '='.repeat(20) + '\n🔑 CÓDIGO: ' + pairingCode + '\n' + '='.repeat(20));
        } catch (err) {
            console.error('❌ Error código:', err.message);
        }
    }
});

whatsappClient.on('ready', () => console.log('✅ WhatsApp Listo'));

// Reenvío WA -> Discord
whatsappClient.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        if (!chat.isGroup || !config.targetChannelId) return;
        if (!chat.name.toLowerCase().includes(config.channelName.toLowerCase())) return;

        const channel = await discordClient.channels.fetch(config.targetChannelId);
        if (channel) {
            const contact = await message.getContact();
            const embed = new EmbedBuilder()
                .setAuthor({ name: `📱 ${contact.pushname || contact.number}` })
                .setDescription(message.body || '*Multimedia*')
                .setColor(0x25D366)
                .setFooter({ text: `${config.communityName}` })
                .setTimestamp();
            await channel.send({ embeds: [embed] });
        }
    } catch (e) { console.error('Error reenvío:', e); }
});

// Comandos Discord
discordClient.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    if (msg.content.startsWith('!setcanal')) {
        config.targetChannelId = msg.channel.id;
        saveConfig();
        msg.reply('✅ Canal guardado.');
    }
    if (msg.content === '!status') {
        msg.reply(`📊 WA: ${whatsappClient.info ? '✅' : '❌'} | Discord: ✅`);
    }
});

whatsappClient.initialize().catch(err => console.error("Error init WA:", err));
discordClient.login(DISCORD_TOKEN).catch(err => console.error("Error login Discord:", err));
