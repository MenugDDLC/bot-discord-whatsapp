require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Configuración de la comunidad
const DEFAULT_COMMUNITY_NAME = "✨📖𝑬𝒍 𝑪𝒍𝒖𝒃 𝑫𝒆 𝑴𝒐𝒏𝒊𝒌𝒂 ✒✨";

let lastMessages = [];
let bridgeConfig = { 
    whatsappGroupName: DEFAULT_COMMUNITY_NAME, 
    whatsappChatId: null, // Guardaremos el ID interno para mayor precisión
    discordChannelId: null 
};
let isWaReady = false;
let updateQR = null;

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado del puente'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Vincula el canal de Discord')
        .addChannelOption(option => option.setName('canal').setDescription('Canal de destino').addChannelTypes(ChannelType.GuildText).setRequired(true)),
    new SlashCommandBuilder().setName('ultimo').setDescription('Muestra los últimos 2 mensajes')
].map(command => command.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--single-process']
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

async function safeReply(interaction, content) {
    try {
        if (interaction.deferred || interaction.replied) await interaction.editReply({ content }).catch(() => null);
        else await interaction.reply({ content }).catch(() => null);
    } catch (e) { console.log("Error:", e.message); }
}

async function sendToDiscord(msg, chatName, isHistory = false) {
    try {
        if (!bridgeConfig.discordChannelId) return;
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;

        const contact = await msg.getContact().catch(() => ({ pushname: 'Admin' }));
        const pfp = await contact.getProfilePicUrl().catch(() => null);
        
        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#7289da' : '#fb92b3') 
            .setAuthor({ 
                name: (isHistory ? "[HISTORIAL] " : "") + (contact.pushname || "Anuncios"), 
                iconURL: pfp || 'https://i.imgur.com/83p7ihD.png' 
            })
            .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Archivo de Anuncio]" : "Mensaje vacío"))
            .setFooter({ text: `Canal de Avisos: ${chatName}` })
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (msg.hasMedia) {
            const media = await msg.downloadMedia().catch(() => null);
            if (media && media.data) {
                files.push(new AttachmentBuilder(Buffer.from(media.data, 'base64'), { name: 'anuncio.png' }));
                embed.setImage('attachment://anuncio.png');
            }
        }
        await channel.send({ embeds: [embed], files: files }).catch(() => null);
    } catch (e) { console.log("Error reenvío:", e.message); }
}

// --- EVENTOS ---
whatsappClient.on('qr', (qr) => {
    isWaReady = false;
    if (updateQR) updateQR(qr);
});

whatsappClient.on('ready', async () => {
    isWaReady = true;
    console.log('✅ WhatsApp listo.');
    
    // Buscar el chat de anuncios específicamente
    const chats = await whatsappClient.getChats().catch(() => []);
    const target = chats.find(c => c.name.includes(DEFAULT_COMMUNITY_NAME));
    
    if (target) {
        bridgeConfig.whatsappGroupName = target.name;
        bridgeConfig.whatsappChatId = target.id._serialized;
        console.log(`📢 Canal de Avisos vinculado: ${target.name} (${target.id._serialized})`);
    }
});

whatsappClient.on('message', async (msg) => {
    // Filtro mejorado: Compara por ID único para no fallar con emojis o nombres raros
    if (bridgeConfig.whatsappChatId && msg.from === bridgeConfig.whatsappChatId) {
        lastMessages.push(msg);
        if (lastMessages.length > 5) lastMessages.shift();
        await sendToDiscord(msg, bridgeConfig.whatsappGroupName);
    }
});

// También escuchamos 'message_create' por si tú eres quien envía los avisos
whatsappClient.on('message_create', async (msg) => {
    if (msg.fromMe && bridgeConfig.whatsappChatId && msg.to === bridgeConfig.whatsappChatId) {
        lastMessages.push(msg);
        if (lastMessages.length > 5) lastMessages.shift();
        await sendToDiscord(msg, bridgeConfig.whatsappGroupName);
    }
});

discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'configurar') {
        bridgeConfig.discordChannelId = interaction.options.getChannel('canal').id;
        await safeReply(interaction, `✅ Discord listo. Reenviando avisos de: **${bridgeConfig.whatsappGroupName}**`);
    }

    if (interaction.commandName === 'status') {
        const idStatus = bridgeConfig.whatsappChatId ? "Vinculado ID ✅" : "Buscando ID ❌";
        await safeReply(interaction, `📊 **Estado**\nWA: ${isWaReady ? '✅' : '⏳'}\nCanal: \`${bridgeConfig.whatsappGroupName}\`\n${idStatus}`);
    }

    if (interaction.commandName === 'ultimo') {
        await interaction.deferReply();
        if (lastMessages.length > 0) {
            for (const m of lastMessages) await sendToDiscord(m, bridgeConfig.whatsappGroupName, true);
            await safeReply(interaction, "✅ Últimos avisos mostrados.");
        } else {
            // Intento de rescate desde el historial
            const chat = await whatsappClient.getChatById(bridgeConfig.whatsappChatId).catch(() => null);
            if (chat) {
                const msgs = await chat.fetchMessages({ limit: 2 }).catch(() => []);
                for (const m of msgs) await sendToDiscord(m, bridgeConfig.whatsappGroupName, true);
                await safeReply(interaction, "✅ Avisos recuperados del historial.");
            } else {
                await safeReply(interaction, "❌ No hay avisos en memoria. Envía uno nuevo en WhatsApp.");
            }
        }
    }
});

whatsappClient.initialize().catch(() => {});
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();

module.exports.setQRHandler = (handler) => { updateQR = handler; };
