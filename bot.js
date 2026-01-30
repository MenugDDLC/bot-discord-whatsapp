require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Configuración automática de tu comunidad
const DEFAULT_COMMUNITY_NAME = "✨📖𝑬𝒍 𝑪𝒍𝒖𝒃 𝑫𝒆 𝑴𝒐𝒏𝒊𝒌𝒂 ✒✨";

let lastMessages = []; // Memoria volátil para mensajes recientes
let bridgeConfig = { 
    whatsappGroupName: DEFAULT_COMMUNITY_NAME, 
    discordChannelId: null 
};
let isWaReady = false;
let updateQR = null;

// --- REGISTRO DE COMANDOS ---
const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado del puente'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Vincula el canal de Discord')
        .addChannelOption(option => option.setName('canal').setDescription('Canal de destino').addChannelTypes(ChannelType.GuildText).setRequired(true)),
    new SlashCommandBuilder().setName('ultimo').setDescription('Muestra los últimos 2 mensajes')
].map(command => command.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// --- CONFIGURACIÓN DE WHATSAPP (OPTIMIZADA PARA KOYEB) ---
const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    qrMaxRetries: 10,
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        protocolTimeout: 0, 
        args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', 
            '--disable-gpu', '--no-zygote', '--single-process'
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

// --- FUNCIONES DE APOYO ---
async function safeReply(interaction, content) {
    try {
        if (interaction.deferred || interaction.replied) await interaction.editReply({ content }).catch(() => null);
        else await interaction.reply({ content }).catch(() => null);
    } catch (e) { console.log("Error en respuesta:", e.message); }
}

async function sendToDiscord(msg, chatName, isHistory = false) {
    try {
        if (!bridgeConfig.discordChannelId) return;
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;

        const contact = await msg.getContact().catch(() => ({ pushname: 'Usuario' }));
        const pfp = await contact.getProfilePicUrl().catch(() => null);
        
        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#7289da' : '#fb92b3') 
            .setAuthor({ 
                name: (isHistory ? "[HISTORIAL] " : "") + (contact.pushname || contact.number || "Usuario"), 
                iconURL: pfp || 'https://i.imgur.com/83p7ihD.png' 
            })
            .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Multimedia]" : "Sin texto"))
            .setFooter({ text: `WA: ${chatName}` })
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (msg.hasMedia) {
            const media = await msg.downloadMedia().catch(() => null);
            if (media && media.data) {
                files.push(new AttachmentBuilder(Buffer.from(media.data, 'base64'), { name: 'archivo.png' }));
                embed.setImage('attachment://archivo.png');
            }
        }
        await channel.send({ embeds: [embed], files: files }).catch(() => null);
    } catch (e) { console.log("Error en reenvío:", e.message); }
}

// --- EVENTOS WHATSAPP ---
whatsappClient.on('qr', (qr) => {
    isWaReady = false;
    if (updateQR) updateQR(qr);
});

whatsappClient.on('ready', async () => {
    isWaReady = true;
    console.log('✅ WhatsApp listo.');
    const chats = await whatsappClient.getChats().catch(() => []);
    const target = chats.find(c => c.name.includes(DEFAULT_COMMUNITY_NAME));
    if (target) bridgeConfig.whatsappGroupName = target.name;
});

whatsappClient.on('message', async (msg) => {
    const chat = await msg.getChat().catch(() => null);
    if (chat && chat.name === bridgeConfig.whatsappGroupName) {
        lastMessages.push(msg);
        if (lastMessages.length > 5) lastMessages.shift();
        await sendToDiscord(msg, chat.name);
    }
});

// --- INTERACCIONES DISCORD ---
discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'configurar') {
        bridgeConfig.discordChannelId = interaction.options.getChannel('canal').id;
        await safeReply(interaction, `✅ Canal vinculado a: **${bridgeConfig.whatsappGroupName}**`);
    }

    if (interaction.commandName === 'status') {
        await safeReply(interaction, `📊 **Estado**\nWA: ${isWaReady ? '✅' : '⏳'}\nGrupo: \`${bridgeConfig.whatsappGroupName}\`\nCanal: <#${bridgeConfig.discordChannelId || 'No definido'}>`);
    }

    if (interaction.commandName === 'ultimo') {
        await interaction.deferReply();
        try {
            // Intento de búsqueda real con timeout de 8 segundos
            const chats = await Promise.race([
                whatsappClient.getChats(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
            ]).catch(() => []);

            const target = chats.find(c => c.name === bridgeConfig.whatsappGroupName);
            if (target) {
                const messages = await target.fetchMessages({ limit: 2 }).catch(() => []);
                for (const m of messages) await sendToDiscord(m, target.name, true);
                await safeReply(interaction, "✅ Historial recuperado directamente de WhatsApp.");
            } else { throw new Error('Not found'); }
        } catch (e) {
            // Plan B: Usar memoria flash si WhatsApp falla
            if (lastMessages.length > 0) {
                for (const m of lastMessages) await sendToDiscord(m, bridgeConfig.whatsappGroupName, true);
                await safeReply(interaction, "⚠️ WhatsApp lento, mostrando mensajes en memoria.");
            } else {
                await safeReply(interaction, "❌ No hay historial disponible. Envía un mensaje en el grupo primero.");
            }
        }
    }
});

// --- INICIO ---
whatsappClient.initialize().catch(() => {});
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();

// Exportaciones para index.js
module.exports.setQRHandler = (handler) => { updateQR = handler; };

process.on('uncaughtException', (err) => console.log('Error critico:', err.message));
process.on('unhandledRejection', (reason) => console.log('Rechazo:', reason));
