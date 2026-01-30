require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TARGET_CHAT_ID = "120363311667281009@g.us"; 

let lastMessages = [];
let bridgeConfig = { discordChannelId: null };
let isWaReady = false;
let updateQR = null;

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--single-process']
    }
});

// --- RESPUESTA SEGURA PARA EVITAR "UNKNOWN INTERACTION" ---
async function safeReply(interaction, content) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply(content);
        } else {
            await interaction.editReply(content);
        }
    } catch (e) { console.log("Error respondiendo a Discord:", e.message); }
}

async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;
        
        const contact = await msg.getContact().catch(() => ({ pushname: 'Admin' }));
        const pfp = await contact.getProfilePicUrl().catch(() => null);
        const text = msg.body && msg.body.trim().length > 0 ? msg.body : (msg.hasMedia ? "🖼️ [Archivo Multimedia]" : "📢 Nuevo Aviso");

        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ 
                name: (isHistory ? "[HISTORIAL] " : "📢 ") + (contact.pushname || "Comunidad"), 
                iconURL: pfp || 'https://i.imgur.com/83p7ihD.png' 
            })
            .setDescription(text)
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
    } catch (e) { console.log("Error reenvío:", e.message); }
}

whatsappClient.on('qr', qr => { if (updateQR) updateQR(qr); });
whatsappClient.on('ready', () => {
    isWaReady = true;
    console.log(`✅ Conectado al ID: ${TARGET_CHAT_ID}`);
});

const processMsg = async (msg) => {
    const fromId = msg.fromMe ? msg.to : msg.from;
    if (fromId === TARGET_CHAT_ID) {
        lastMessages.push(msg);
        if (lastMessages.length > 5) lastMessages.shift();
        await sendToDiscord(msg);
    }
};

whatsappClient.on('message', processMsg);
whatsappClient.on('message_create', processMsg);

// --- INTERACCIONES DE DISCORD ---
discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;

    // Usamos deferReply para ganar tiempo y evitar el crash
    await i.deferReply().catch(() => null);

    if (i.commandName === 'configurar') {
        bridgeConfig.discordChannelId = i.options.getChannel('canal').id;
        await safeReply(i, { content: `✅ Canal vinculado exitosamente.` });
    }
    
    if (i.commandName === 'status') {
        const statusMsg = `📊 **Estado:** ${isWaReady ? 'Conectado ✅' : 'Esperando WhatsApp ⏳'}\nID: \`${TARGET_CHAT_ID}\``;
        await safeReply(i, { content: statusMsg });
    }

    if (i.commandName === 'ultimo') {
        if (lastMessages.length > 0) {
            for (const m of lastMessages) await sendToDiscord(m, true);
            await safeReply(i, { content: "✅ Mensajes enviados." });
        } else {
            await safeReply(i, { content: "❌ No hay mensajes en memoria." });
        }
    }
});

// --- COMANDOS ---
const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado'),
    new SlashCommandBuilder().setName('ultimo').setDescription('Ver últimos mensajes'),
    new SlashCommandBuilder().setName('configurar').setDescription('Vincular canal').addChannelOption(o => o.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText).setRequired(true))
].map(c => c.toJSON());

whatsappClient.initialize().catch(() => {});
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => { try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {} })();

module.exports.setQRHandler = h => { updateQR = h; };
