require('dotenv').config();
const { 
    Client: DiscordClient, GatewayIntentBits, REST, Routes, 
    SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, 
    ChannelType 
} = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const TARGET_CHAT_ID = process.env.TARGET_CHAT_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

let lastMessages = [];
let bridgeConfig = { discordChannelId: null };
let isWaReady = false;
let updateQR = null; 

const discordClient = new DiscordClient({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    authTimeoutMs: 0,
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
        headless: true,
        // ⚡ OPTIMIZACIÓN DE MEMORIA CRÍTICA
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Reduce múltiples procesos a uno solo
            '--disable-gpu',
            '--disable-extensions',
            '--js-flags="--max-old-space-size=350"' // Limita RAM de JS a 350MB
        ],
    }
});

// --- LÓGICA DE REENVÍO ---
async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;

        const [contact, media] = await Promise.all([
            msg.getContact().catch(() => ({ pushname: 'Usuario' })),
            msg.hasMedia ? msg.downloadMedia().catch(() => null) : Promise.resolve(null)
        ]);

        const pushname = msg.fromMe ? "Tú (Admin)" : (contact.pushname || "Admin");
        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#25D366')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + pushname })
            .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Archivo]" : "Mensaje vacío"))
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (media?.data) {
            const attachment = new AttachmentBuilder(Buffer.from(media.data, 'base64'), { name: 'archivo.png' });
            files.push(attachment);
            if (media.mimetype.startsWith('image/')) embed.setImage('attachment://archivo.png');
        }

        await channel.send({ embeds: [embed], files });
    } catch (e) { console.log("⚠️ Error Bridge:", e.message); }
}

// --- EVENTOS ---
whatsappClient.on('qr', qr => { if (updateQR) updateQR(qr); });
whatsappClient.on('ready', () => { isWaReady = true; if (updateQR) updateQR(null); });

whatsappClient.on('message_create', async (msg) => {
    if (msg.from !== TARGET_CHAT_ID && msg.to !== TARGET_CHAT_ID) return;
    try {
        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const participant = chat.participants?.find(p => p.id._serialized === contact.id._serialized);
        if (participant?.isAdmin || participant?.isSuperAdmin || msg.fromMe) {
            lastMessages.push(msg);
            if (lastMessages.length > 5) lastMessages.shift(); // Bajamos historial a 5 para ahorrar RAM
            sendToDiscord(msg);
        }
    } catch (e) {}
});

// --- COMANDOS DISCORD ---
const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Estado del bot'),
    new SlashCommandBuilder().setName('ultimo').setDescription('Reenvía últimos mensajes'),
    new SlashCommandBuilder().setName('configurar').setDescription('Configurar canal')
        .addChannelOption(o => o.setName('canal').setDescription('Canal de Discord').setRequired(true).addChannelTypes(ChannelType.GuildText))
].map(c => c.toJSON());

discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    if (i.commandName === 'configurar') {
        bridgeConfig.discordChannelId = i.options.getChannel('canal').id;
        await i.reply({ content: '✅ Canal configurado.', ephemeral: true });
    }
    if (i.commandName === 'status') {
        await i.reply({ content: `WhatsApp: ${isWaReady ? '✅' : '⏳'}`, ephemeral: true });
    }
});

(async () => {
    try {
        await discordClient.login(DISCORD_TOKEN);
        const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        whatsappClient.initialize();
    } catch (e) { console.error(e); }
})();

module.exports = { setQRHandler: (h) => { updateQR = h; } };
