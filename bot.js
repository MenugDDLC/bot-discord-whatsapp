require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Nombre exacto detectado en tus capturas
const TARGET_NAME = "✨📖𝑬𝒍 𝑪𝒍𝒖𝒃 𝑫𝒆 𝑴𝒐𝒏𝒊𝒌𝒂 ✒✨";

let bridgeConfig = { 
    whatsappChatId: null, 
    discordChannelId: null,
    groupName: TARGET_NAME
};
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

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--single-process']
    }
});

// --- SEGURIDAD DE RESPUESTA ---
async function safeReply(interaction, content) {
    try {
        if (interaction.deferred || interaction.replied) return await interaction.editReply({ content });
        await interaction.reply({ content });
    } catch (e) { console.log("Error Discord:", e.message); }
}

async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId);
        const contact = await msg.getContact();
        const pfp = await contact.getProfilePicUrl().catch(() => null);
        
        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + (contact.pushname || "Admin"), iconURL: pfp || 'https://i.imgur.com/83p7ihD.png' })
            .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Contenido Multimedia]" : "Aviso sin texto"))
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (msg.hasMedia) {
            const media = await msg.downloadMedia().catch(() => null);
            if (media) {
                files.push(new AttachmentBuilder(Buffer.from(media.data, 'base64'), { name: 'archivo.png' }));
                embed.setImage('attachment://archivo.png');
            }
        }
        await channel.send({ embeds: [embed], files });
    } catch (e) { console.log("Error Reenvío:", e.message); }
}

// --- EVENTOS WA ---
whatsappClient.on('qr', qr => { isWaReady = false; if (updateQR) updateQR(qr); });

whatsappClient.on('ready', async () => {
    isWaReady = true;
    console.log('✅ WhatsApp Conectado');
    const chats = await whatsappClient.getChats();
    // Buscamos el canal de avisos (Suelen ser Read Only para usuarios normales)
    const target = chats.find(c => c.name.includes("Monika") || c.name.includes("Club"));
    if (target) {
        bridgeConfig.whatsappChatId = target.id._serialized;
        bridgeConfig.groupName = target.name;
        console.log(`📢 Canal vinculado: ${target.name} | ID: ${target.id._serialized}`);
    }
});

// Escuchar mensajes (De otros y tuyos como admin)
const processMsg = async (msg) => {
    const chat = await msg.getChat();
    if (bridgeConfig.whatsappChatId && chat.id._serialized === bridgeConfig.whatsappChatId) {
        await sendToDiscord(msg);
    }
};

whatsappClient.on('message', processMsg);
whatsappClient.on('message_create', processMsg);

// --- DISCORD ---
discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'configurar') {
        bridgeConfig.discordChannelId = i.options.getChannel('canal').id;
        await safeReply(i, `✅ Configurado. Los avisos de **${bridgeConfig.groupName}** llegarán aquí.`);
    }

    if (i.commandName === 'status') {
        await safeReply(i, `📊 WA: ${isWaReady ? '✅' : '⏳'}\nCanal: \`${bridgeConfig.groupName}\``);
    }

    if (i.commandName === 'ultimo') {
        await i.deferReply();
        const chat = await whatsappClient.getChatById(bridgeConfig.whatsappChatId).catch(() => null);
        if (chat) {
            const msgs = await chat.fetchMessages({ limit: 2 });
            for (const m of msgs) await sendToDiscord(m, true);
            await safeReply(i, "✅ Últimos avisos recuperados.");
        } else {
            await safeReply(i, "❌ No se pudo acceder al historial.");
        }
    }
});

whatsappClient.initialize().catch(() => {});
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();

module.exports.setQRHandler = h => { updateQR = h; };
