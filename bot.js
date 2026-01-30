require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Configuración predeterminada
const DEFAULT_COMMUNITY_NAME = "✨📖𝑬𝒍 𝑪𝒍𝒖𝒃 𝑫𝒆 𝑴𝒐𝒏𝒊𝒌𝒂 ✒✨";

let bridgeConfig = { 
    whatsappGroupName: DEFAULT_COMMUNITY_NAME, 
    discordChannelId: null 
};
let isWaReady = false;

// --- COMANDOS ---
const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado del puente'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Configura el canal de Discord o cambia de chat')
        .addStringOption(option => option.setName('nombre').setDescription('Nombre del chat en WhatsApp').setRequired(false))
        .addChannelOption(option => option.setName('canal').setDescription('Canal de Discord destino').addChannelTypes(ChannelType.GuildText).setRequired(false)),
    new SlashCommandBuilder().setName('ultimo').setDescription('Muestra los 2 mensajes anteriores')
].map(command => command.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// --- CLIENTE WHATSAPP ---
const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    qrMaxRetries: 10,
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        protocolTimeout: 0, 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--disable-gpu',
            '--no-zygote',
            '--single-process',
            '--disable-extensions',
            '--no-first-run'
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

// --- RESPUESTA SEGURA ---
async function safeReply(interaction, content, isEphemeral = false) {
    try {
        const options = { content: content };
        if (isEphemeral) options.flags = [MessageFlags.Ephemeral];
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(options).catch(() => null);
        } else {
            await interaction.reply(options).catch(() => null);
        }
    } catch (e) { console.log("Error safeReply:", e.message); }
}

async function sendToDiscord(msg, chatName) {
    try {
        if (!bridgeConfig.discordChannelId) return;
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;

        const contact = await msg.getContact();
        const pfp = await contact.getProfilePicUrl().catch(() => null);
        
        const embed = new EmbedBuilder()
            .setColor('#fb92b3') 
            .setAuthor({ name: contact.pushname || contact.number, iconURL: pfp || 'https://i.imgur.com/83p7ihD.png' })
            .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Multimedia]" : "Sin contenido"))
            .setFooter({ text: `WA: ${chatName}` })
            .setTimestamp(new Date(msg.timestamp * 1000));

        const files = [];
        if (msg.hasMedia) {
            const media = await msg.downloadMedia().catch(() => null);
            if (media && media.data) {
                files.push(new AttachmentBuilder(Buffer.from(media.data, 'base64'), { name: 'archivo.png' }));
                embed.setImage('attachment://archivo.png');
            }
        }
        await channel.send({ embeds: [embed], files: files }).catch(() => null);
    } catch (e) { console.log("Error reenvío:", e.message); }
}

// --- EVENTOS ---
whatsappClient.on('ready', async () => {
    isWaReady = true;
    console.log('✅ WhatsApp Conectado.');
    const chats = await whatsappClient.getChats().catch(() => []);
    const target = chats.find(c => c.name.includes(DEFAULT_COMMUNITY_NAME));
    if (target) {
        bridgeConfig.whatsappGroupName = target.name;
        console.log(`📢 Comunidad vinculada: ${target.name}`);
    }
});

whatsappClient.on('message', async (msg) => {
    if (!isWaReady) return;
    const chat = await msg.getChat().catch(() => null);
    if (chat && bridgeConfig.whatsappGroupName && chat.name === bridgeConfig.whatsappGroupName) {
        await sendToDiscord(msg, chat.name);
    }
});

discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (!isWaReady) return await safeReply(interaction, "⏳ WA cargando...", true);

    try {
        if (interaction.commandName === 'configurar') {
            await interaction.deferReply();
            const nuevoNombre = interaction.options.getString('nombre');
            const nuevoCanal = interaction.options.getChannel('canal');

            if (nuevoNombre) {
                const chats = await whatsappClient.getChats().catch(() => []);
                const target = chats.find(c => c.name.toLowerCase().includes(nuevoNombre.toLowerCase()));
                if (target) bridgeConfig.whatsappGroupName = target.name;
            }

            if (nuevoCanal) bridgeConfig.discordChannelId = nuevoCanal.id;
            else if (!bridgeConfig.discordChannelId) bridgeConfig.discordChannelId = interaction.channelId;

            await safeReply(interaction, `✅ **Configuración Guardada**\n📱 WA: \`${bridgeConfig.whatsappGroupName}\`\n📍 Canal: <#${bridgeConfig.discordChannelId}>`);
        }

        if (interaction.commandName === 'status') {
            await safeReply(interaction, `📊 **Estado**\nWA: ${isWaReady ? '✅' : '⏳'}\nGrupo: \`${bridgeConfig.whatsappGroupName}\``);
        }
    } catch (e) { console.log("Error interacción:", e.message); }
});

whatsappClient.initialize().catch(err => console.log("Error init:", err.message));
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();

process.on('uncaughtException', (err) => console.log('Excepción:', err.message));
process.on('unhandledRejection', (reason) => console.log('Rechazo:', reason));

let updateQR = null;
whatsappClient.on('qr', (qr) => { isWaReady = false; if (updateQR) updateQR(qr); });
module.exports.setQRHandler = (handler) => { updateQR = handler; };
