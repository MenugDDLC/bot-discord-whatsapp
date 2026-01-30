require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TARGET_NAME = "✨📖𝑬𝒍 𝑪𝒍𝒖𝒃 𝑫𝒆 𝑴𝒐𝒏𝒊𝒌𝒂 ✒✨";

let lastMessages = [];
let bridgeConfig = { whatsappChatId: null, discordChannelId: null, groupName: TARGET_NAME };
let isWaReady = false;
let updateQR = null;

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Estado del bot'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Canal de Discord para avisos')
        .addChannelOption(o => o.setName('canal').setDescription('Selecciona el canal').addChannelTypes(ChannelType.GuildText).setRequired(true)),
    new SlashCommandBuilder().setName('ultimo').setDescription('Ver últimos avisos')
].map(c => c.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// --- CONFIGURACIÓN REFORZADA CONTRA TIMEOUTS ---
const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    authTimeoutMs: 60000, // Aumentamos a 60 segundos el tiempo de espera de autenticación
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--disable-gpu', 
            '--no-zygote', 
            '--single-process'
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

async function safeReply(interaction, content) {
    try {
        if (interaction.deferred || interaction.replied) return await interaction.editReply({ content }).catch(() => null);
        await interaction.reply({ content }).catch(() => null);
    } catch (e) { console.log("Error Discord:", e.message); }
}

async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;
        
        const contact = await msg.getContact().catch(() => ({ pushname: 'Admin' }));
        const pfp = await contact.getProfilePicUrl().catch(() => null);
        
        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + (contact.pushname || "Admin"), iconURL: pfp || 'https://i.imgur.com/83p7ihD.png' })
            .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Multimedia]" : "Aviso sin texto"))
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (msg.hasMedia) {
            const media = await msg.downloadMedia().catch(() => null);
            if (media) {
                files.push(new AttachmentBuilder(Buffer.from(media.data, 'base64'), { name: 'archivo.png' }));
                embed.setImage('attachment://archivo.png');
            }
        }
        await channel.send({ embeds: [embed], files }).catch(() => null);
    } catch (e) { console.log("Error Reenvío:", e.message); }
}

// --- EVENTOS WA ---
whatsappClient.on('qr', qr => { 
    isWaReady = false; 
    if (updateQR) updateQR(qr); 
    console.log("Nuevo QR generado. Escanéalo pronto.");
});

whatsappClient.on('ready', async () => {
    isWaReady = true;
    console.log('✅ WhatsApp Conectado');
    try {
        const chats = await whatsappClient.getChats();
        const target = chats.find(c => c.name.includes("Monika") || c.name.includes("Club"));
        if (target) {
            bridgeConfig.whatsappChatId = target.id._serialized;
            bridgeConfig.groupName = target.name;
            console.log(`📢 Vinculado a: ${target.name}`);
        }
    } catch (e) { console.log("Error buscando chat inicial:", e.message); }
});

whatsappClient.on('auth_failure', msg => {
    console.error('❌ Error de autenticación:', msg);
    console.log('Reiniciando sesión...');
});

const processMsg = async (msg) => {
    try {
        const fromId = msg.fromMe ? msg.to : msg.from;
        if (bridgeConfig.whatsappChatId && fromId === bridgeConfig.whatsappChatId) {
            lastMessages.push(msg);
            if (lastMessages.length > 5) lastMessages.shift();
            await sendToDiscord(msg);
        }
    } catch (e) { console.log("Error procesando msg:", e.message); }
};

whatsappClient.on('message', processMsg);
whatsappClient.on('message_create', processMsg);

// --- DISCORD ---
discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    try {
        if (i.commandName === 'configurar') {
            bridgeConfig.discordChannelId = i.options.getChannel('canal').id;
            await safeReply(i, `✅ Configurado para avisos de **${bridgeConfig.groupName}**.`);
        }
        if (i.commandName === 'status') {
            await safeReply(i, `📊 WA: ${isWaReady ? '✅' : '⏳'}\nGrupo: \`${bridgeConfig.groupName}\``);
        }
        if (i.commandName === 'ultimo') {
            if (!i.deferred && !i.replied) await i.deferReply();
            if (lastMessages.length > 0) {
                for (const m of lastMessages) await sendToDiscord(m, true);
                await safeReply(i, "✅ Mostrando avisos recientes.");
            } else {
                await safeReply(i, "❌ No hay avisos en memoria. Envía uno en WhatsApp.");
            }
        }
    } catch (e) { console.log("Error Interaction:", e.message); }
});

// --- INICIALIZACIÓN CON MANEJO DE ERRORES ---
whatsappClient.initialize().catch(err => console.error("Error inicializando WA:", err.message));
discordClient.login(DISCORD_TOKEN).catch(err => console.error("Error login Discord:", err.message));

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();

// Captura de rechazos no manejados para evitar crasheos (IMPORTANTE)
process.on('unhandledRejection', error => {
    console.error('Rechazo no manejado:', error.message);
    if (error.message.includes('auth timeout')) {
        console.log('Sugerencia: Haz un "Clear cache and redeploy" en Koyeb.');
    }
});

module.exports.setQRHandler = h => { updateQR = h; };
