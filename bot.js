require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

let lastMessages = [];
let bridgeConfig = { 
    whatsappChatId: "120363311667281009@g.us", 
    discordChannelId: null 
};
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

// --- FUNCIÓN DE REENVÍO ---
async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;
        
        let pushname = msg.fromMe ? "Tú (Admin)" : "Admin de la Comunidad";
        let pfp = 'https://i.imgur.com/83p7ihD.png'; 

        try {
            if (msg.author || msg.from) {
                const contact = await msg.getContact().catch(() => null);
                if (contact && contact.id && contact.id._serialized) {
                    pushname = contact.pushname || pushname;
                    if (typeof contact.getProfilePicUrl === 'function') {
                        const url = await contact.getProfilePicUrl().catch(() => null);
                        if (url) pfp = url;
                    }
                }
            }
        } catch (e) {}

        const text = msg.body && msg.body.trim().length > 0 ? msg.body : (msg.hasMedia ? "🖼️ [Archivo Multimedia]" : "📢 Nuevo Aviso");

        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + pushname, iconURL: pfp })
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
whatsappClient.on('ready', () => { isWaReady = true; console.log('✅ WA Conectado'); });

// --- PROCESADOR DE MENSAJES ---
whatsappClient.on('message_create', async (msg) => {
    try {
        const chatId = msg.fromMe ? msg.to : msg.from;
        const chat = await msg.getChat().catch(() => ({ name: "" }));

        // Si es el ID guardado O el nombre coincide (Monika/Club)
        if (chatId === bridgeConfig.whatsappChatId || chat.name.includes("Monika") || chat.name.includes("Club")) {
            if (chatId !== bridgeConfig.whatsappChatId) bridgeConfig.whatsappChatId = chatId;
            
            lastMessages.push(msg);
            if (lastMessages.length > 5) lastMessages.shift();
            
            await sendToDiscord(msg);
        }
    } catch (e) { console.log("Error msg:", e.message); }
});

// --- COMANDOS DE DISCORD ---
discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply().catch(() => null);

    if (i.commandName === 'configurar') {
        bridgeConfig.discordChannelId = i.options.getChannel('canal').id;
        await i.editReply(`✅ Canal configurado. Reenviaré avisos aquí.`);
    }
    
    if (i.commandName === 'status') {
        await i.editReply(`📊 **WA:** ${isWaReady ? 'Conectado ✅' : '⏳'}\nID: \`${bridgeConfig.whatsappChatId}\``);
    }

    if (i.commandName === 'ultimo') {
        if (lastMessages.length > 0) {
            // Reenvía los últimos 2 mensajes de la memoria
            const toSend = lastMessages.slice(-2);
            for (const m of toSend) await sendToDiscord(m, true);
            await i.editReply("✅ Últimos 2 mensajes reenviados.");
        } else {
            await i.editReply("❌ No hay mensajes en memoria.");
        }
    }
});

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado'),
    new SlashCommandBuilder().setName('ultimo').setDescription('Ver últimos 2 mensajes'),
    new SlashCommandBuilder().setName('configurar').setDescription('Vincular canal').addChannelOption(o => o.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText).setRequired(true))
].map(c => c.toJSON());

whatsappClient.initialize().catch(() => {});
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => { try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {} })();

module.exports.setQRHandler = h => { updateQR = h; };
