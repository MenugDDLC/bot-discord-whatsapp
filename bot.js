require('dotenv').config();
const { 
    Client: DiscordClient, GatewayIntentBits, REST, Routes, 
    SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, 
    ChannelType, PermissionFlagsBits 
} = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

// --- 1. CONFIGURACIÓN Y ESTADO ---
const TARGET_CHAT_ID = process.env.TARGET_CHAT_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

let lastMessages = [];
let bridgeConfig = { discordChannelId: null };
let isWaReady = false;
let updateQR = null; // Función vinculada desde index.js

console.log('🚀 Iniciando Bot Bridge de alta velocidad...');

// --- 2. CLIENTES ---
const discordClient = new DiscordClient({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    authTimeoutMs: 0, // Evita el error "auth timeout"
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', '--disable-gpu'
        ],
    }
});

// --- 3. FUNCIONES DE APOYO ---
async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;

        const [contact, media] = await Promise.all([
            msg.getContact().catch(() => ({ pushname: 'Desconocido' })),
            msg.hasMedia ? msg.downloadMedia().catch(() => null) : Promise.resolve(null)
        ]);

        const pushname = msg.fromMe ? "Tú (Admin)" : (contact.pushname || contact.number || "Admin");
        const text = msg.body?.trim() || (msg.hasMedia ? "🖼️ [Multimedia]" : "📢 Nuevo Mensaje");

        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + pushname, iconURL: 'https://i.imgur.com/83p7ihD.png' })
            .setDescription(text.substring(0, 4096))
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (media?.data) {
            const buffer = Buffer.from(media.data, 'base64');
            const ext = media.mimetype.split('/')[1]?.split(';')[0] || 'png';
            const fileName = `archivo.${ext}`;
            files.push(new AttachmentBuilder(buffer, { name: fileName }));
            if (media.mimetype.startsWith('image/')) embed.setImage(`attachment://${fileName}`);
        }

        await channel.send({ embeds: [embed], files });
    } catch (e) { console.log("❌ Error Bridge:", e.message); }
}

// --- 4. EVENTOS WHATSAPP ---
whatsappClient.on('qr', qr => { 
    console.log("🔲 Nuevo QR generado. Actualizando Dashboard...");
    if (updateQR) updateQR(qr); 
});

whatsappClient.on('ready', () => {
    isWaReady = true;
    console.log('✅ WhatsApp Conectado');
    if (updateQR) updateQR(null); 
});

whatsappClient.on('message_create', async (msg) => {
    if (msg.to !== TARGET_CHAT_ID && msg.from !== TARGET_CHAT_ID) return;
    if (msg.isStatus) return;

    try {
        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const participant = chat.participants?.find(p => p.id._serialized === contact.id._serialized);
        const esAdmin = participant?.isAdmin || participant?.isSuperAdmin || msg.fromMe;

        if (esAdmin) {
            lastMessages.push(msg);
            if (lastMessages.length > 10) lastMessages.shift();
            sendToDiscord(msg);
        }
    } catch (e) { console.log("❌ Error mensaje:", e.message); }
});

// --- 5. EVENTOS DISCORD ---
discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'configurar') {
        const canal = i.options.getChannel('canal');
        bridgeConfig.discordChannelId = canal.id;
        await i.reply({ content: `✅ Canal fijado en <#${canal.id}>`, ephemeral: true });
    }
    
    if (i.commandName === 'status') {
        await i.reply({ content: `📱 WhatsApp: ${isWaReady ? '✅' : '❌'}\n🔗 Canal: ${bridgeConfig.discordChannelId ? '✅' : '❌'}`, ephemeral: true });
    }
});

// --- 6. COMANDOS ---
const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Estado del bot'),
    new SlashCommandBuilder().setName('configurar').setDescription('Configurar canal').addChannelOption(o => o.setName('canal').setRequired(true).addChannelTypes(ChannelType.GuildText).setDescription('Canal de texto'))
].map(c => c.toJSON());

// --- 7. INICIO ---
(async () => {
    try {
        await discordClient.login(DISCORD_TOKEN);
        const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        whatsappClient.initialize();
    } catch (e) { console.error("❌ Error inicio:", e); }
})();

// EXPORTACIÓN PARA INDEX.JS
module.exports = {
    setQRHandler: (handler) => { updateQR = handler; }
};
