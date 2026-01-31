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

async function safeReply(interaction, content) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply(content).catch(() => null);
        } else {
            await interaction.editReply(content).catch(() => null);
        }
    } catch (e) { console.log("Error safeReply:", e.message); }
}

async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;
        
        let pushname = "Admin";
        let pfp = 'https://i.imgur.com/83p7ihD.png'; 

        try {
            const contact = await msg.getContact();
            pushname = contact.pushname || (msg.fromMe ? "Tú (Admin)" : "Anuncios");
            if (typeof contact.getProfilePicUrl === 'function') {
                pfp = await contact.getProfilePicUrl().catch(() => pfp);
            }
        } catch (err) { console.log("Error contacto:", err.message); }

        const text = msg.body && msg.body.trim().length > 0 ? msg.body : (msg.hasMedia ? "🖼️ [Archivo Multimedia]" : "📢 Nuevo Aviso");

        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ 
                name: (isHistory ? "[HISTORIAL] " : "📢 ") + pushname, 
                iconURL: pfp 
            })
            .setDescription(text)
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (msg.hasMedia) {
            const media = await msg.downloadMedia().catch(() => null);
            if (media && media.data) {
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
    console.log(`✅ Bot activo. Escuchando avisos en: ${TARGET_CHAT_ID}`);
});

// --- PROCESADOR MEJORADO PARA MENSAJES PROPIOS Y AJENOS ---
const processMsg = async (msg) => {
    try {
        // Si el mensaje lo envías tú (fromMe), el ID del chat destino está en msg.to
        // Si lo envía otra persona, el ID del chat está en msg.from
        const chatId = msg.fromMe ? msg.to : msg.from;

        if (chatId === TARGET_CHAT_ID) {
            console.log(`📩 Aviso detectado (Enviado por: ${msg.fromMe ? 'Tú' : 'Otro'})`);
            lastMessages.push(msg);
            if (lastMessages.length > 5) lastMessages.shift();
            await sendToDiscord(msg);
        }
    } catch (e) { console.log("Error procesando mensaje:", e.message); }
};

// message: detecta lo que llega | message_create: detecta TODO (lo que llega y lo que tú envías)
whatsappClient.on('message', processMsg);
whatsappClient.on('message_create', processMsg);

discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply().catch(() => null);

    if (i.commandName === 'configurar') {
        bridgeConfig.discordChannelId = i.options.getChannel('canal').id;
        await safeReply(i, { content: `✅ Canal vinculado correctamente.` });
    }
    
    if (i.commandName === 'status') {
        await safeReply(i, { content: `📊 **Estado:** ${isWaReady ? 'WhatsApp Conectado ✅' : 'Esperando WhatsApp ⏳'}\nID Configurado: \`${TARGET_CHAT_ID}\`` });
    }

    if (i.commandName === 'ultimo') {
        if (lastMessages.length > 0) {
            for (const m of lastMessages) await sendToDiscord(m, true);
            await safeReply(i, { content: "✅ Mensajes reenviados." });
        } else {
            await safeReply(i, { content: "❌ No hay mensajes en memoria. ¡Escribe algo en el canal de avisos!" });
        }
    }
});

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
