require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const DEFAULT_COMMUNITY_NAME = "✨📖𝑬𝒍 𝑪𝒍𝒖𝒃 𝑫𝒆 𝑴𝒐𝒏𝒊𝒌𝒂 ✒✨";

let lastMessages = [];
let bridgeConfig = { whatsappGroupName: DEFAULT_COMMUNITY_NAME, whatsappChatId: null, discordChannelId: null };
let isWaReady = false;
let updateQR = null;

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado del puente'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Vincula el canal de Discord')
        .addChannelOption(option => option.setName('canal').setDescription('Canal de destino').addChannelTypes(ChannelType.GuildText).setRequired(true)),
    new SlashCommandBuilder().setName('ultimo').setDescription('Muestra los últimos 2 avisos')
].map(command => command.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--single-process']
    }
});

// --- FUNCIONES DE SEGURIDAD ---
async function safeReply(interaction, content) {
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content }).catch(() => null);
        } else {
            await interaction.reply({ content }).catch(() => null);
        }
    } catch (e) { console.log("Error en safeReply:", e.message); }
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
            .setAuthor({ name: (isHistory ? "[AVISO PASADO] " : "📢 ") + (contact.pushname || "Anuncios"), iconURL: pfp || 'https://i.imgur.com/83p7ihD.png' })
            .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Contenido Multimedia]" : "Mensaje sin texto"))
            .setFooter({ text: `Canal: ${chatName}` })
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

// --- EVENTOS WA ---
whatsappClient.on('qr', (qr) => { isWaReady = false; if (updateQR) updateQR(qr); });

whatsappClient.on('ready', async () => {
    isWaReady = true;
    console.log('✅ WA Listo.');
    const chats = await whatsappClient.getChats().catch(() => []);
    // Intentamos buscar por nombre
    const target = chats.find(c => c.name.includes(DEFAULT_COMMUNITY_NAME));
    if (target) {
        bridgeConfig.whatsappGroupName = target.name;
        bridgeConfig.whatsappChatId = target.id._serialized;
        console.log(`🚀 ID DETECTADO: ${target.id._serialized} (Nombre: ${target.name})`);
    }
});

// RASTREADOR DE MENSAJES (Para encontrar el ID si falla la detección automática)
const handleMsg = async (msg) => {
    const chat = await msg.getChat().catch(() => null);
    const fromId = msg.fromMe ? msg.to : msg.from;

    // ESTO IMPRIMIRÁ EN KOYEB EL ID DE CUALQUIER MENSAJE QUE LLEGUE
    console.log(`📩 Mensaje recibido de: ${chat ? chat.name : 'Desconocido'} | ID: ${fromId}`);

    if (bridgeConfig.whatsappChatId && fromId === bridgeConfig.whatsappChatId) {
        lastMessages.push(msg);
        if (lastMessages.length > 5) lastMessages.shift();
        await sendToDiscord(msg, bridgeConfig.whatsappGroupName);
    }
};

whatsappClient.on('message', handleMsg);
whatsappClient.on('message_create', handleMsg);

// --- INTERACCIONES DISCORD ---
discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        if (interaction.commandName === 'configurar') {
            bridgeConfig.discordChannelId = interaction.options.getChannel('canal').id;
            await safeReply(interaction, `✅ Puente configurado.`);
        }

        if (interaction.commandName === 'status') {
            await safeReply(interaction, `📊 WA: ${isWaReady ? '✅' : '⏳'}\nID Actual: \`${bridgeConfig.whatsappChatId || 'No vinculado'}\``);
        }

        if (interaction.commandName === 'ultimo') {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
            if (lastMessages.length > 0) {
                for (const m of lastMessages) await sendToDiscord(m, bridgeConfig.whatsappGroupName, true);
                await safeReply(interaction, "✅ Historial enviado.");
            } else if (bridgeConfig.whatsappChatId) {
                const chat = await whatsappClient.getChatById(bridgeConfig.whatsappChatId).catch(() => null);
                const msgs = chat ? await chat.fetchMessages({ limit: 2 }).catch(() => []) : [];
                for (const m of msgs) await sendToDiscord(m, bridgeConfig.whatsappGroupName, true);
                await safeReply(interaction, "✅ Avisos recuperados de WhatsApp.");
            } else {
                await safeReply(interaction, "❌ No hay avisos. Escribe en el canal para vincularlo.");
            }
        }
    } catch (err) { console.log("Error:", err.message); }
});

whatsappClient.initialize().catch(() => {});
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();

module.exports.setQRHandler = (handler) => { updateQR = handler; };
