require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// --- EL ID QUE ENCONTRASTE ---
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

// --- ENVIAR A DISCORD ---
async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;
        
        const contact = await msg.getContact().catch(() => ({ pushname: 'Admin' }));
        const pfp = await contact.getProfilePicUrl().catch(() => null);
        
        // Limpiamos el texto por si viene vacío (solo emoji o sticker)
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
        await channel.send({ embeds: [embed], files }).catch(console.error);
    } catch (e) { console.log("Error reenvío:", e.message); }
}

// --- EVENTOS WHATSAPP ---
whatsappClient.on('qr', qr => { if (updateQR) updateQR(qr); });

whatsappClient.on('ready', () => {
    isWaReady = true;
    console.log(`✅ Conectado y escuchando el ID: ${TARGET_CHAT_ID}`);
});

// PROCESADOR DE MENSAJES CON ID FIJO
const processMsg = async (msg) => {
    try {
        const fromId = msg.fromMe ? msg.to : msg.from;
        
        // Filtro estricto por el ID que nos pasaste
        if (fromId === TARGET_CHAT_ID) {
            console.log("📩 Mensaje detectado en el canal de avisos.");
            lastMessages.push(msg);
            if (lastMessages.length > 5) lastMessages.shift();
            await sendToDiscord(msg);
        }
    } catch (e) { console.log("Error procesando:", e.message); }
};

whatsappClient.on('message', processMsg);
whatsappClient.on('message_create', processMsg);

// --- COMANDOS DISCORD ---
discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'configurar') {
        bridgeConfig.discordChannelId = i.options.getChannel('canal').id;
        await i.reply(`✅ **Puente activado.** Ahora reenviaré los avisos de la comunidad a <#${bridgeConfig.discordChannelId}>.`);
    }
    
    if (i.commandName === 'status') {
        await i.reply(`📊 **Estado:** ${isWaReady ? 'WhatsApp Conectado ✅' : 'Esperando WhatsApp ⏳'}\nTarget ID: \`${TARGET_CHAT_ID}\``);
    }

    if (i.commandName === 'ultimo') {
        if (lastMessages.length > 0) {
            await i.reply("⏳ Cargando últimos mensajes...");
            for (const m of lastMessages) await sendToDiscord(m, true);
        } else {
            await i.reply("❌ No hay mensajes recientes guardados en memoria.");
        }
    }
});

// --- REGISTRO DE COMANDOS ---
const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado del bot'),
    new SlashCommandBuilder().setName('ultimo').setDescription('Ver últimos 5 mensajes'),
    new SlashCommandBuilder().setName('configurar').setDescription('Vincular canal').addChannelOption(o => o.setName('canal').setDescription('Canal de destino').addChannelTypes(ChannelType.GuildText).setRequired(true))
].map(c => c.toJSON());

whatsappClient.initialize().catch(console.error);
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => { try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {} })();

module.exports.setQRHandler = h => { updateQR = h; };
