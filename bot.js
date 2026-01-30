require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Configuración global
let bridgeConfig = { whatsappGroupName: null, discordChannelId: null };

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado del puente'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Vincula el grupo por nombre')
        .addStringOption(option => option.setName('nombre').setDescription('Nombre del grupo').setRequired(true)),
    new SlashCommandBuilder().setName('ultimo').setDescription('Muestra los 2 mensajes anteriores con imágenes')
].map(command => command.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// Función para enviar a Discord
async function sendToDiscord(msg, chatName, prefix = "") {
    try {
        if (!bridgeConfig.discordChannelId) return;
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;

        const contact = await msg.getContact();
        const pfp = await contact.getProfilePicUrl().catch(() => null);
        
        let embed = new EmbedBuilder()
            .setColor('#fb92b3') 
            .setAuthor({ 
                name: `${prefix}${contact.pushname || contact.number}`, 
                iconURL: pfp || 'https://i.imgur.com/83p7ihD.png' 
            })
            .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Imagen]" : "Mensaje vacío"))
            .setFooter({ text: `WhatsApp: ${chatName}` })
            .setTimestamp(new Date(msg.timestamp * 1000));

        const files = [];
        if (msg.hasMedia) {
            const media = await msg.downloadMedia().catch(() => null);
            if (media && media.mimetype && media.mimetype.startsWith('image/')) {
                const buffer = Buffer.from(media.data, 'base64');
                const attachment = new AttachmentBuilder(buffer, { name: 'imagen_wa.png' });
                embed.setImage('attachment://imagen_wa.png');
                files.push(attachment);
            }
        }
        await channel.send({ embeds: [embed], files: files });
    } catch (e) { console.error("Error enviando a Discord:", e); }
}

// Eventos de WhatsApp
whatsappClient.on('message', async (msg) => {
    const chat = await msg.getChat();
    if (bridgeConfig.whatsappGroupName && chat.name === bridgeConfig.whatsappGroupName) {
        await sendToDiscord(msg, chat.name);
    }
});

// Eventos de Discord
discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'configurar') {
        const nombreBuscado = interaction.options.getString('nombre');
        await interaction.reply(`🔍 Buscando grupo con "${nombreBuscado}"...`);

        const chats = await whatsappClient.getChats();
        const targetChat = chats.find(c => c.isGroup && c.name.toLowerCase().includes(nombreBuscado.toLowerCase()));

        if (targetChat) {
            bridgeConfig.whatsappGroupName = targetChat.name;
            bridgeConfig.discordChannelId = interaction.channelId;
            await interaction.editReply(`✅ Vinculado a: \`${targetChat.name}\`\nUsa \`/ultimo\` para traer el historial.`);
        } else {
            await interaction.editReply(`❌ No encontré el grupo. Asegúrate de que el bot esté adentro.`);
        }
    }

    if (interaction.commandName === 'ultimo') {
        if (!bridgeConfig.whatsappGroupName) return await interaction.reply("❌ Usa /configurar primero.");
        await interaction.reply("📨 Recuperando historial reciente...");
        const chats = await whatsappClient.getChats();
        const targetChat = chats.find(c => c.name === bridgeConfig.whatsappGroupName);
        if (targetChat) {
            const messages = await targetChat.fetchMessages({ limit: 2 });
            for (const m of messages) await sendToDiscord(m, targetChat.name);
        }
    }

    if (interaction.commandName === 'status') {
        await interaction.reply(`📊 **WA:** ✅ | **Discord:** ✅ | **Grupo:** \`${bridgeConfig.whatsappGroupName || 'Sin configurar'}\``);
    }
});

// Inicialización
whatsappClient.initialize().catch(err => console.error("Error WA Init:", err));
discordClient.login(DISCORD_TOKEN);

// Registro de comandos
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();

// Manejo de QR para index.js
let updateQR = null;
whatsappClient.on('qr', (qr) => { if (updateQR) updateQR(qr); });
module.exports.setQRHandler = (handler) => { updateQR = handler; };
