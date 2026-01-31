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

// --- REENVÍO CON IMÁGENES PRIORITARIAS ---
async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;

        const contact = await msg.getContact().catch(() => null);
        let pushname = msg.fromMe ? "Tú (Admin)" : (contact?.pushname || "Admin de la Comunidad");
        let pfp = 'https://i.imgur.com/83p7ihD.png';

        if (contact && typeof contact.getProfilePicUrl === 'function') {
            pfp = await contact.getProfilePicUrl().catch(() => pfp);
        }

        const text = msg.body?.trim() || (msg.hasMedia ? "🖼️ [Imagen/Multimedia]" : "📢 Nuevo Aviso");

        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + pushname, iconURL: pfp })
            .setDescription(text)
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (msg.hasMedia) {
            // Descarga la imagen sin límites de tiempo para asegurar que llegue
            const media = await msg.downloadMedia().catch(() => null);
            if (media && media.data) {
                const attachment = new AttachmentBuilder(Buffer.from(media.data, 'base64'), { name: 'archivo.png' });
                files.push(attachment);
                embed.setImage('attachment://archivo.png');
            }
        }

        await channel.send({ embeds: [embed], files }).catch(console.error);
    } catch (e) {
        console.log("Error en reenvío:", e.message);
    }
}

whatsappClient.on('qr', qr => { if (updateQR) updateQR(qr); });
whatsappClient.on('ready', () => { isWaReady = true; console.log('✅ WA Conectado'); });

// --- PROCESADOR DE MENSAJES ---
whatsappClient.on('message_create', async (msg) => {
    try {
        const chatId = msg.fromMe ? msg.to : msg.from;
        
        // Verificamos si es el chat de avisos por ID o por Nombre
        const chat = await msg.getChat().catch(() => null);
        const isTarget = (chatId === bridgeConfig.whatsappChatId) || 
                         (chat && (chat.name.includes("Monika") || chat.name.includes("Club")));

        if (isTarget) {
            if (chatId !== bridgeConfig.whatsappChatId) bridgeConfig.whatsappChatId = chatId;
            
            lastMessages.push(msg);
            if (lastMessages.length > 10) lastMessages.shift();
            
            // Enviamos el mensaje (incluyendo imágenes)
            await sendToDiscord(msg);
        }
    } catch (e) { console.log("Error msg:", e.message); }
});

// --- COMANDOS DE DISCORD (TODOS INTACTOS) ---
discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply().catch(() => null);

    if (i.commandName === 'configurar') {
        bridgeConfig.discordChannelId = i.options.getChannel('canal').id;
        await i.editReply(`✅ Canal de avisos configurado.`);
    }
    
    if (i.commandName === 'status') {
        await i.editReply(`📊 **WA:** ${isWaReady ? 'Conectado ✅' : '⏳'}\nID: \`${bridgeConfig.whatsappChatId}\``);
    }

    if (i.commandName === 'ultimo') {
        if (lastMessages.length > 0) {
            const aEnviar = lastMessages.slice(-2);
            for (const m of aEnviar) {
                await sendToDiscord(m, true);
            }
            await i.editReply("✅ Últimos 2 mensajes reenviados (incluyendo imágenes).");
        } else {
            await i.editReply("❌ No hay mensajes en memoria.");
        }
    }
});

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado del bot'),
    new SlashCommandBuilder().setName('ultimo').setDescription('Ver últimos 2 mensajes'),
    new SlashCommandBuilder().setName('configurar').setDescription('Vincular canal de avisos').addChannelOption(o => o.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText).setRequired(true))
].map(c => c.toJSON());

whatsappClient.initialize().catch(() => {});
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => { try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {} })();

module.exports.setQRHandler = h => { updateQR = h; };
    
