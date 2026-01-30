require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

let bridgeConfig = { whatsappGroupName: null, discordChannelId: null };
let isWaReady = false; // Flag de control

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

// Eventos de estado de WhatsApp
whatsappClient.on('ready', () => {
    isWaReady = true;
    console.log('✅ WhatsApp está listo y conectado.');
});

whatsappClient.on('disconnected', () => {
    isWaReady = false;
    console.log('❌ WhatsApp se ha desconectado.');
});

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
    } catch (e) { console.log("Error en envío:", e.message); }
}

whatsappClient.on('message', async (msg) => {
    if (!isWaReady) return;
    try {
        const chat = await msg.getChat();
        if (bridgeConfig.whatsappGroupName && chat.name === bridgeConfig.whatsappGroupName) {
            await sendToDiscord(msg, chat.name);
        }
    } catch (e) {}
});

discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Validación de seguridad: ¿WhatsApp está listo?
    if (!isWaReady) {
        return await interaction.reply({ 
            content: "⏳ WhatsApp aún se está conectando o el código QR no ha sido escaneado. Por favor, espera un momento.", 
            ephemeral: true 
        }).catch(() => {});
    }

    try {
        await interaction.deferReply().catch(() => {});

        if (interaction.commandName === 'configurar') {
            const nombreBuscado = interaction.options.getString('nombre');
            const chats = await whatsappClient.getChats();
            const targetChat = chats.find(c => c.isGroup && c.name.toLowerCase().includes(nombreBuscado.toLowerCase()));

            if (targetChat) {
                bridgeConfig.whatsappGroupName = targetChat.name;
                bridgeConfig.discordChannelId = interaction.channelId;
                await interaction.editReply(`✅ Vinculado a: \`${targetChat.name}\``).catch(() => {});
            } else {
                await interaction.editReply(`❌ No encontré el grupo "${nombreBuscado}".`).catch(() => {});
            }
        }

        if (interaction.commandName === 'ultimo') {
            if (!bridgeConfig.whatsappGroupName) {
                return await interaction.editReply("❌ Usa /configurar primero.").catch(() => {});
            }
            
            const chats = await whatsappClient.getChats();
            const targetChat = chats.find(c => c.name === bridgeConfig.whatsappGroupName);

            if (targetChat) {
                const messages = await targetChat.fetchMessages({ limit: 2 });
                for (let i = 0; i < messages.length; i++) {
                    await sendToDiscord(messages[i], targetChat.name, i === 0 ? "Anterior: " : "Último: ");
                }
                await interaction.editReply("✅ Historial enviado.").catch(() => {});
            }
        }

        if (interaction.commandName === 'status') {
            await interaction.editReply(`📊 WhatsApp: ${isWaReady ? '✅ Conectado' : '⏳ Iniciando'} | Discord: ✅`).catch(() => {});
        }
    } catch (error) {
        console.log("Error en interacción:", error.message);
    }
});

process.on('uncaughtException', (err) => console.log('Exception:', err.message));
process.on('unhandledRejection', (reason) => console.log('Rejection:', reason));

whatsappClient.initialize().catch(e => console.log("WA Init Error"));
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();

let updateQR = null;
whatsappClient.on('qr', (qr) => { 
    isWaReady = false; // Si pide QR, no está listo
    if (updateQR) updateQR(qr); 
});
module.exports.setQRHandler = (handler) => { updateQR = handler; };
