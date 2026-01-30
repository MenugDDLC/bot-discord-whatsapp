require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Configuración predeterminada solicitada
const DEFAULT_COMMUNITY_NAME = "✨📖𝑬𝒍 𝑪𝒍𝒖𝒃 𝑫𝒆 𝑴𝒐𝒏𝒊𝒌𝒂 ✒✨";

let bridgeConfig = { 
    whatsappGroupName: DEFAULT_COMMUNITY_NAME, 
    discordChannelId: null 
};
let isWaReady = false;

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado del puente'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Cambia el canal de Discord o el grupo de WA')
        .addStringOption(option => option.setName('nombre').setDescription('Nombre del chat en WhatsApp').setRequired(false))
        .addChannelOption(option => option.setName('canal').setDescription('Canal de Discord destino').addChannelTypes(ChannelType.GuildText).setRequired(false)),
    new SlashCommandBuilder().setName('ultimo').setDescription('Muestra los 2 mensajes anteriores')
].map(command => command.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote']
    }
});

// --- Lógica de Respuesta Segura ---
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
            .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Archivo Multimedia]" : "Mensaje sin texto"))
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

// --- Eventos ---
whatsappClient.on('ready', async () => {
    isWaReady = true;
    console.log('✅ WhatsApp Conectado.');

    // AUTOCONFIGURACIÓN: Busca la comunidad al iniciar
    const chats = await whatsappClient.getChats().catch(() => []);
    const target = chats.find(c => c.name.includes(DEFAULT_COMMUNITY_NAME));
    if (target) {
        bridgeConfig.whatsappGroupName = target.name;
        console.log(`📢 Comunidad "${target.name}" vinculada automáticamente.`);
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
    if (!isWaReady) return await safeReply(interaction, "⏳ WhatsApp no está listo todavía.", true);

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

            if (nuevoCanal) {
                bridgeConfig.discordChannelId = nuevoCanal.id;
            } else if (!bridgeConfig.discordChannelId) {
                // Si nunca se configuró un canal, usa el actual
                bridgeConfig.discordChannelId = interaction.channelId;
            }

            await safeReply(interaction, `✅ **Configuración Actualizada**\n📱 WA: \`${bridgeConfig.whatsappGroupName}\`\n📍 Discord: <#${bridgeConfig.discordChannelId}>`);
        }

        if (interaction.commandName === 'status') {
            await safeReply(interaction, `📊 **Estado**\nWA: ${isWaReady ? '✅' : '⏳'}\nVinculado a: \`${bridgeConfig.whatsappGroupName || 'Buscando...'}\`\nCanal: <#${bridgeConfig.discordChannelId || 'No definido'}>`);
        }
    } catch (e) { console.log("Error interacción:", e.message); }
});

whatsappClient.initialize().catch(() => {});
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();

// Captura de errores para evitar que Koyeb cierre la app
process.on('uncaughtException', (err) => console.log('Exception:', err.message));
process.on('unhandledRejection', (reason) => console.log('Rejection:', reason));

let updateQR = null;
whatsappClient.on('qr', (qr) => { isWaReady = false; if (updateQR) updateQR(qr); });
module.exports.setQRHandler = (handler) => { updateQR = handler; };
