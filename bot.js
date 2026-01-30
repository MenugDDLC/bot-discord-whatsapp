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

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    authTimeoutMs: 60000, 
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
        
        // Detectar si es emoji o texto vacío
        const contentText = msg.body && msg.body.trim().length > 0 ? msg.body : (msg.hasMedia ? "🖼️ [Multimedia]" : "✨ [Reacción/Emoji]");

        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + (contact.pushname || "Admin"), iconURL: pfp || 'https://i.imgur.com/83p7ihD.png' })
            .setDescription(contentText)
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

whatsappClient.on('qr', qr => { 
    isWaReady = false; 
    if (updateQR) updateQR(qr); 
});

whatsappClient.on('ready', async () => {
    isWaReady = true;
    const chats = await whatsappClient.getChats().catch(() => []);
    const target = chats.find(c => c.name.includes("Monika") || c.name.includes("Club"));
    if (target) {
        bridgeConfig.whatsappChatId = target.id._serialized;
        bridgeConfig.groupName = target.name;
        console.log(`✅ Conectado a: ${target.name}`);
    }
});

const processMsg = async (msg) => {
    try {
        const chat = await msg.getChat().catch(() => null);
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

discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    try {
        if (i.commandName === 'configurar') {
            bridgeConfig.discordChannelId = i.options.getChannel('canal').id;
            await safeReply(i, `✅ Configurado para avisos.`);
        }
        if (i.commandName === 'status') {
            await safeReply(i, `📊 WA: ${isWaReady ? '✅' : '⏳'}\nGrupo: \`${bridgeConfig.groupName}\``);
        }
        if (i.commandName === 'ultimo') {
            if (!i.deferred && !i.replied) await i.deferReply();
            if (lastMessages.length > 0) {
                for (const m of lastMessages) await sendToDiscord(m, true);
                await safeReply(i, "✅ Enviado.");
            } else {
                await safeReply(i, "❌ No hay mensajes en memoria.");
            }
        }
    } catch (e) { console.log("Error Interaction:", e.message); }
});

whatsappClient.initialize().catch(() => {});
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();

process.on('unhandledRejection', error => console.error('Error:', error.message));

module.exports.setQRHandler = h => { updateQR = h; };
