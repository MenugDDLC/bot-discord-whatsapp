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

// --- FUNCIÓN DE REENVÍO ---
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
            const media = await msg.downloadMedia().catch(() => null);
            if (media && media.data) {
                files.push(new AttachmentBuilder(Buffer.from(media.data, 'base64'), { name: 'archivo.png' }));
                embed.setImage('attachment://archivo.png');
            }
        }

        await channel.send({ embeds: [embed], files }).catch(() => null);
    } catch (e) { console.log("Error enviando a Discord:", e.message); }
}

whatsappClient.on('qr', qr => { if (updateQR) updateQR(qr); });
whatsappClient.on('ready', () => { 
    isWaReady = true; 
    console.log('✅ WhatsApp está conectado y listo.'); 
});

// --- PROCESADOR CON LOGS EN CONSOLA ---
whatsappClient.on('message_create', async (msg) => {
    try {
        const chatId = msg.fromMe ? msg.to : msg.from;
        
        // Verificamos si es el chat objetivo
        if (chatId === TARGET_CHAT_ID) {
            // LOG EN CONSOLA (Lo verás en Koyeb)
            const autor = msg.fromMe ? "YO (Admin)" : "Otro Admin";
            console.log(`\n--------------------------------------`);
            console.log(`📩 MENSAJE RECIBIDO EN WHATSAPP`);
            console.log(`👤 Autor: ${autor}`);
            console.log(`💬 Contenido: ${msg.body || "[Sin texto / Multimedia]"}`);
            console.log(`--------------------------------------\n`);

            // Guardamos en memoria para /ultimo
            lastMessages.push(msg);
            if (lastMessages.length > 10) lastMessages.shift();

            // Enviamos a Discord
            await sendToDiscord(msg);
        }
    } catch (e) { console.log("Error procesando mensaje:", e.message); }
});

// --- COMANDOS DISCORD ---
discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply().catch(() => null);

    try {
        if (i.commandName === 'configurar') {
            bridgeConfig.discordChannelId = i.options.getChannel('canal').id;
            await i.editReply(`✅ Canal vinculado.`);
        }
        
        if (i.commandName === 'status') {
            await i.editReply(`📊 WA: ${isWaReady ? '✅' : '⏳'}`);
        }

        if (i.commandName === 'ultimo') {
            if (lastMessages.length > 0) {
                const toSend = lastMessages.slice(-2);
                for (const m of toSend) await sendToDiscord(m, true);
                await i.editReply("✅ Últimos 2 reenviados.");
            } else {
                await i.editReply("❌ Memoria vacía.");
            }
        }
    } catch (e) { console.log("Error interacción:", e.message); }
});

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Estado'),
    new SlashCommandBuilder().setName('ultimo').setDescription('Ultimos 2'),
    new SlashCommandBuilder().setName('configurar').setDescription('Configurar').addChannelOption(o => o.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText).setRequired(true))
].map(c => c.toJSON());

whatsappClient.initialize().catch(e => console.log("Init Error:", e.message));
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => { try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {} })();

module.exports.setQRHandler = h => { updateQR = h; };
