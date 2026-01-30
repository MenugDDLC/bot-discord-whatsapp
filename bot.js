require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

let bridgeConfig = { whatsappGroupName: null, discordChannelId: null };

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado'),
    new SlashCommandBuilder().setName('configurar').setDescription('Vincula el grupo de Monika automáticamente'),
    new SlashCommandBuilder().setName('ultimo').setDescription('Muestra los 2 mensajes anteriores (Solo una vez)')
].map(command => command.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

// Función para enviar mensajes con soporte de IMAGEN
async function sendToDiscord(msg, chatName, prefix = "") {
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
        .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Imagen adjunta]" : "Mensaje vacío"))
        .setFooter({ text: `WhatsApp: ${chatName}` })
        .setTimestamp(new Date(msg.timestamp * 1000));

    const files = [];

    // Lógica para DESCARGAR IMAGEN
    if (msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            if (media && media.mimetype.startsWith('image/')) {
                const buffer = Buffer.from(media.data, 'base64');
                const attachment = new AttachmentBuilder(buffer, { name: 'imagen_wa.png' });
                embed.setImage('attachment://imagen_wa.png');
                files.push(attachment);
            }
        } catch (e) {
            console.error("Error descargando media:", e);
        }
    }

    await channel.send({ embeds: [embed], files: files });
}

// Reenvío en tiempo real
whatsappClient.on('message', async (msg) => {
    const chat = await msg.getChat();
    if (bridgeConfig.whatsappGroupName && chat.name === bridgeConfig.whatsappGroupName) {
        await sendToDiscord(msg, chat.name);
    }
});

discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'configurar') {
        await interaction.reply(`🎀 Buscando el club...`);
        const chats = await whatsappClient.getChats();
        const targetChat = chats.find(c => c.isGroup && c.name.includes('Monika'));

        if (targetChat) {
            bridgeConfig.whatsappGroupName = targetChat.name;
            bridgeConfig.discordChannelId = interaction.channelId;
            await interaction.editReply(`✅ **Conectado a:** \`${targetChat.name}\`.\nAhora usa \`/ultimo\` para traer los mensajes previos.`);
        } else {
            await interaction.editReply(`❌ No se encontró el grupo con "Monika" en el nombre.`);
        }
    }

    if (interaction.commandName === 'ultimo') {
        if (!bridgeConfig.whatsappGroupName) return await interaction.reply("❌ Usa `/configurar` primero.");

        await interaction.reply("📨 Recuperando los 2 mensajes anteriores con imágenes...");
        const chats = await whatsappClient.getChats();
        const targetChat = chats.find(c => c.name === bridgeConfig.whatsappGroupName);

        if (targetChat) {
            const messages = await targetChat.fetchMessages({ limit: 2 });
            for (let i = 0; i < messages.length; i++) {
                // Enviamos los mensajes. El prefijo ayuda a saber cuál es el más viejo.
                await sendToDiscord(messages[i], targetChat.name, i === 0 ? "Anterior: " : "Último: ");
            }
            await interaction.followUp("✨ Historial recuperado. El bot seguirá reenviando lo nuevo automáticamente.");
        }
    }
});

whatsappClient.initialize();
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) { console.error(e); }
})();

let updateQR = null;
whatsappClient.on('qr', (qr) => { if (updateQR) updateQR(qr); });
module.exports.setQRHandler = (handler) => { updateQR = handler; };
