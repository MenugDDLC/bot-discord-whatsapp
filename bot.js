require('dotenv').config();
const { 
    Client: DiscordClient, GatewayIntentBits, REST, Routes, 
    SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, 
    ChannelType, PermissionFlagsBits 
} = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

// --- 1. CONFIGURACIÓN ---
const TARGET_CHAT_ID = process.env.TARGET_CHAT_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

let lastMessages = [];
let bridgeConfig = { discordChannelId: null };
let isWaReady = false;
let updateQR = null; 

// --- 2. INICIALIZACIÓN DE CLIENTES ---
const discordClient = new DiscordClient({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    authTimeoutMs: 0, // ⚡ Evita el crash por timeout
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
});

// --- 3. LÓGICA DE REENVÍO ---
async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;

        const [contact, media] = await Promise.all([
            msg.getContact().catch(() => ({ pushname: 'Usuario' })),
            msg.hasMedia ? msg.downloadMedia().catch(() => null) : Promise.resolve(null)
        ]);

        const pushname = msg.fromMe ? "Tú (Admin)" : (contact.pushname || contact.number || "Admin");
        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#25D366')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + pushname })
            .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Archivo Adjunto]" : "Mensaje sin texto"))
            .setTimestamp(new Date(msg.timestamp * 1000))
            .setFooter({ text: '⚡ Reenvío Instantáneo' });

        let files = [];
        if (media?.data) {
            const extension = media.mimetype.split('/')[1]?.split(';')[0] || 'png';
            const attachment = new AttachmentBuilder(Buffer.from(media.data, 'base64'), { name: `file.${extension}` });
            files.push(attachment);
            if (media.mimetype.startsWith('image/')) embed.setImage(`attachment://file.${extension}`);
        }

        await channel.send({ embeds: [embed], files });
    } catch (e) { console.log("⚠️ Error Bridge:", e.message); }
}

// --- 4. EVENTOS WHATSAPP ---
whatsappClient.on('qr', qr => { 
    if (updateQR) updateQR(qr); 
    console.log("🔲 QR generado y enviado al Dashboard.");
});

whatsappClient.on('ready', () => {
    isWaReady = true;
    if (updateQR) updateQR(null); 
    console.log('✅ WhatsApp Conectado Correctamente');
});

whatsappClient.on('message_create', async (msg) => {
    if (msg.from !== TARGET_CHAT_ID && msg.to !== TARGET_CHAT_ID) return;
    if (msg.isStatus) return;

    try {
        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const participant = chat.participants?.find(p => p.id._serialized === contact.id._serialized);
        const esAdmin = participant?.isAdmin || participant?.isSuperAdmin || msg.fromMe;

        if (esAdmin) {
            lastMessages.push(msg);
            if (lastMessages.length > 10) lastMessages.shift();
            sendToDiscord(msg);
        }
    } catch (e) { console.log("❌ Error procesando mensaje:", e.message); }
});

// --- 5. COMANDOS DISCORD (FIXED) ---
const commands = [
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Muestra el estado actual del bot y la conexión'),
    new SlashCommandBuilder()
        .setName('ultimo')
        .setDescription('Reenvía los últimos mensajes detectados en el grupo'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Establece el canal donde se recibirán los mensajes')
        .addChannelOption(o => 
            o.setName('canal')
             .setDescription('El canal de texto de Discord')
             .setRequired(true)
             .addChannelTypes(ChannelType.GuildText)
        )
].map(c => c.toJSON());

discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'configurar') {
        bridgeConfig.discordChannelId = i.options.getChannel('canal').id;
        await i.reply({ content: `✅ **Configuración exitosa.** Los mensajes se enviarán a <#${bridgeConfig.discordChannelId}>`, ephemeral: true });
    }
    
    if (i.commandName === 'status') {
        const status = isWaReady ? 'Conectado ✅' : 'Esperando autenticación ⏳';
        await i.reply({ content: `**Estado del Bot:**\nWhatsApp: ${status}\nDiscord: Online 🟢`, ephemeral: true });
    }

    if (i.commandName === 'ultimo') {
        if (lastMessages.length === 0) return i.reply({ content: 'No hay mensajes recientes.', ephemeral: true });
        await i.reply({ content: 'Reenviando...', ephemeral: true });
        lastMessages.slice(-2).forEach(m => sendToDiscord(m, true));
    }
});

// --- 6. ARRANQUE DEL SISTEMA ---
(async () => {
    try {
        console.log('🔄 Iniciando Discord...');
        await discordClient.login(DISCORD_TOKEN);
        
        const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos de Discord registrados.');

        console.log('🔄 Iniciando WhatsApp (Puppeteer)...');
        whatsappClient.initialize();
    } catch (e) {
        console.error("❌ Error Crítico en el arranque:", e.message);
    }
})();

// Exportación para index.js
module.exports = {
    setQRHandler: (handler) => { updateQR = handler; }
};
