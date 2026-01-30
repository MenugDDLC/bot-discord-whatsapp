require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

let bridgeConfig = { whatsappGroupName: null, discordChannelId: null };
let isWaReady = false;

// --- COMANDOS ---
const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado del puente'),
    new SlashBuilder = new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Vincula el grupo/comunidad y el canal de reenvío')
        .addStringOption(option => option.setName('nombre').setDescription('Nombre del chat en WhatsApp (Comunidad o Grupo)').setRequired(true))
        .addChannelOption(option => option.setName('canal').setDescription('Canal de Discord donde llegarán los mensajes').addChannelTypes(ChannelType.GuildText).setRequired(false)),
    new SlashCommandBuilder().setName('ultimo').setDescription('Muestra los 2 mensajes anteriores')
].map(command => command.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
});

// --- FUNCIONES DE SEGURIDAD ---
async function safeReply(interaction, content, isEphemeral = false) {
    try {
        const options = { content: content };
        if (isEphemeral) options.flags = [MessageFlags.Ephemeral];
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(options).catch(() => null);
        } else {
            await interaction.reply(options).catch(() => null);
        }
    } catch (e) { console.log("Error en safeReply:", e.message); }
}

async function sendToDiscord(msg, chatName, prefix = "") {
    try {
        if (!bridgeConfig.discordChannelId) return;
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;

        const contact = await msg.getContact();
        const pfp = await contact.getProfilePicUrl().catch(() => null);
        
        const embed = new EmbedBuilder()
            .setColor('#fb92b3') 
            .setAuthor({ name: `${prefix}${contact.pushname || contact.number}`, iconURL: pfp || 'https://i.imgur.com/83p7ihD.png' })
            .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Imagen]" : "Mensaje vacío"))
            .setFooter({ text: `WhatsApp: ${chatName}` })
            .setTimestamp(new Date(msg.timestamp * 1000));

        const files = [];
        if (msg.hasMedia) {
            const media = await msg.downloadMedia().catch(() => null);
            if (media && media.data) {
                const buffer = Buffer.from(media.data, 'base64');
                files.push(new AttachmentBuilder(buffer, { name: 'imagen.png' }));
                embed.setImage('attachment://imagen.png');
            }
        }
        await channel.send({ embeds: [embed], files: files }).catch(() => null);
    } catch (e) { console.log("Error reenviando:", e.message); }
}

// --- EVENTOS ---
whatsappClient.on('ready', () => { isWaReady = true; console.log('✅ WhatsApp Conectado y Listo.'); });

whatsappClient.on('message', async (msg) => {
    if (!isWaReady) return;
    const chat = await msg.getChat().catch(() => null);
    if (chat && bridgeConfig.whatsappGroupName && chat.name === bridgeConfig.whatsappGroupName) {
        await sendToDiscord(msg, chat.name);
    }
});

discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (!isWaReady) {
        return await safeReply(interaction, "⏳ WhatsApp aún se está conectando. Re
