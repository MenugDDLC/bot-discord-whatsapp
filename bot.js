require('dotenv').config();
const http = require('http'); // Para mantener viva la instancia
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 8080;

// --- SERVIDOR WEB PARA KOYEB ---
// Esto evita el error "Application exited with code 1"
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running');
}).listen(PORT);

let bridgeConfig = { whatsappGroupName: null, discordChannelId: null };

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
        executablePath: '/usr/bin/chromium', // Ruta estándar en entornos Linux/Koyeb
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process'
        ]
    }
});

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
            if (media && media.mimetype.startsWith('image/')) {
                const buffer = Buffer.from(media.data, 'base64');
                const attachment = new AttachmentBuilder(buffer, { name: 'imagen_wa.png' });
                embed.setImage('attachment://imagen_wa.png');
                files.push(attachment);
            }
        }
        await channel.send({ embeds: [embed], files: files });
    } catch (error) {
        console.error("Error en el puente:", error);
    }
}

whatsappClient.on('message', async (msg) => {
    const chat = await msg.getChat();
    if (bridgeConfig.whatsappGroupName && chat.name === bridgeConfig.whatsappGroupName) {
        await sendToDiscord(msg, chat.name);
    }
});

discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'configurar') {
        const nombreBuscado = interaction.options.getString('nombre');
        await interaction.reply(`🔍 Buscando "${nombreBuscado}"...`);

        const chats = await whatsappClient.getChats();
        const targetChat = chats.find(c => c.isGroup && c.name.toLowerCase().includes(nombreBuscado.toLowerCase()));

        if (targetChat) {
            bridgeConfig.whatsappGroupName = targetChat.name;
            bridgeConfig.discordChannelId = interaction.channelId;
            await interaction.editReply(`✅ Vinculado a: \`${targetChat.name}\``);
        } else {
            await interaction.editReply(`❌ No se encontró el grupo.`);
        }
    }

    if (interaction.commandName === 'ultimo') {
        if (!bridgeConfig.whatsappGroupName) return await interaction.reply("❌ Usa /configurar.");
        await interaction.reply("📨 Recuperando 2 mensajes...");
        const chats = await whatsappClient.getChats();
        const targetChat = chats.find(c => c.name === bridgeConfig.whatsappGroupName);
        if (targetChat) {
            const messages = await targetChat.fetchMessages({ limit: 2 });
            for (const m of messages) await sendToDiscord(m, targetChat.name);
        }
    }
});

whatsappClient.initialize();
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();

let updateQR = null;
whatsappClient.on('qr', (qr) => { if (updateQR) updateQR(qr); });
module.exports.setQRHandler = (handler) => { updateQR = handler; };
