require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Memoria persistente básica (mientras la instancia esté viva)
let bridgeConfig = { 
    whatsappGroupName: process.env.DEFAULT_GROUP || null, 
    discordChannelId: process.env.DEFAULT_CHANNEL || null 
};
let isWaReady = false;

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Vincula el grupo por nombre')
        .addStringOption(option => option.setName('nombre').setDescription('Nombre del grupo').setRequired(true)),
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

// --- Lógica de Reenvío ---
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
            if (media && media.mimetype?.startsWith('image/')) {
                const buffer = Buffer.from(media.data, 'base64');
                files.push(new AttachmentBuilder(buffer, { name: 'imagen.png' }));
                embed.setImage('attachment://imagen.png');
            }
        }
        await channel.send({ embeds: [embed], files: files });
    } catch (e) { console.log("Error en reenvío:", e.message); }
}

// --- Eventos WhatsApp ---
whatsappClient.on('ready', () => {
    isWaReady = true;
    console.log('✅ WhatsApp Conectado.');
});

whatsappClient.on('message', async (msg) => {
    if (!isWaReady) return;
    const chat = await msg.getChat();
    if (bridgeConfig.whatsappGroupName && chat.name === bridgeConfig.whatsappGroupName) {
        await sendToDiscord(msg, chat.name);
    }
});

// --- Interacciones Discord ---
discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (!isWaReady) {
        // Corregido: Uso de flags en lugar de ephemeral: true
        return await interaction.reply({ 
            content: "⏳ WhatsApp aún no está listo.", 
            flags: [MessageFlags.Ephemeral] 
        }).catch(() => {});
    }

    try {
        if (interaction.commandName === 'configurar') {
            await interaction.deferReply();
            const nombre = interaction.options.getString('nombre');
            const chats = await whatsappClient.getChats();
            const target = chats.find(c => c.isGroup && c.name.toLowerCase().includes(nombre.toLowerCase()));

            if (target) {
                bridgeConfig.whatsappGroupName = target.name;
                bridgeConfig.discordChannelId = interaction.channelId;
                await interaction.editReply(`✅ Vinculado a: \`${target.name}\`.`);
            } else {
                await interaction.editReply(`❌ No encontré "${nombre}".`);
            }
        }

        if (interaction.commandName === 'ultimo') {
            if (!bridgeConfig.whatsappGroupName) return await interaction.editReply("❌ Configura el grupo primero.");
            await interaction.deferReply();
            const chats = await whatsappClient.getChats();
            const target = chats.find(c => c.name === bridgeConfig.whatsappGroupName);
            if (target) {
                const messages = await target.fetchMessages({ limit: 2 });
                for (const m of messages) await sendToDiscord(m, target.name);
                await interaction.editReply("✅ Historial enviado.");
            }
        }

        if (interaction.commandName === 'status') {
            await interaction.reply(`📊 WA: ${isWaReady ? '✅' : '⏳'} | Grupo: \`${bridgeConfig.whatsappGroupName || 'N/A'}\``);
        }
    } catch (e) { console.log("Error en interacción:", e.message); }
});

whatsappClient.initialize().catch(() => {});
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();

let updateQR = null;
whatsappClient.on('qr', (qr) => { isWaReady = false; if (updateQR) updateQR(qr); });
module.exports.setQRHandler = (handler) => { updateQR = handler; };
