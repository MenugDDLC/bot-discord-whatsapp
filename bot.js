require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

let bridgeConfig = { whatsappGroupName: null, discordChannelId: null };
let isWaReady = false;

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Vincula el grupo y el canal de reenvío')
        .addStringOption(option => option.setName('nombre').setDescription('Nombre del grupo (ej: Monika)').setRequired(true))
        .addChannelOption(option => option.setName('canal').setDescription('Canal de Discord').addChannelTypes(ChannelType.GuildText).setRequired(false)),
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

// FUNCIÓN AUXILIAR: Responde a Discord sin riesgo de error 40060
async function safeReply(interaction, content, isEphemeral = false) {
    try {
        const options = { content: content };
        if (isEphemeral) options.flags = [MessageFlags.Ephemeral];

        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(options);
        } else {
            return await interaction.reply(options);
        }
    } catch (e) {
        console.error("Error al intentar responder a la interacción:", e.message);
    }
}

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
    } catch (e) { console.log("Error reenvío:", e.message); }
}

whatsappClient.on('ready', () => { isWaReady = true; console.log('✅ WA Ready'); });

whatsappClient.on('message', async (msg) => {
    if (!isWaReady) return;
    const chat = await msg.getChat();
    if (bridgeConfig.whatsappGroupName && chat.name === bridgeConfig.whatsappGroupName) {
        await sendToDiscord(msg, chat.name);
    }
});

discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        if (!isWaReady) {
            return await safeReply(interaction, "⏳ WA no está listo aún. Espera el mensaje 'WA Ready' en la consola.", true);
        }

        if (interaction.commandName === 'configurar') {
            await interaction.deferReply(); // Gana tiempo
            const nombre = interaction.options.getString('nombre');
            const canal = interaction.options.getChannel('canal') || interaction.channel;

            const chats = await whatsappClient.getChats();
            const target = chats.find(c => c.isGroup && c.name.toLowerCase().includes(nombre.toLowerCase()));

            if (target) {
                bridgeConfig.whatsappGroupName = target.name;
                bridgeConfig.discordChannelId = canal.id;
                await safeReply(interaction, `✅ **Puente configurado**\n📱 Grupo: \`${target.name}\`\n📍 Canal: <#${canal.id}>`);
            } else {
                await safeReply(interaction, `❌ No encontré el grupo "${nombre}".`);
            }
        }

        if (interaction.commandName === 'ultimo') {
            if (!bridgeConfig.whatsappGroupName) return await safeReply(interaction, "❌ Configura primero el grupo.", true);
            
            await interaction.deferReply();
            const chats = await whatsappClient.getChats();
            const target = chats.find(c => c.name === bridgeConfig.whatsappGroupName);
            if (target) {
                const messages = await target.fetchMessages({ limit: 2 });
                for (let i = 0; i < messages.length; i++) {
                    await sendToDiscord(messages[i], target.name, i === 0 ? "Anterior: " : "Último: ");
                }
                await safeReply(interaction, "✅ Historial enviado.");
            }
        }

        if (interaction.commandName === 'status') {
            await safeReply(interaction, `📊 WA: ${isWaReady ? '✅' : '⏳'} | Canal: <#${bridgeConfig.discordChannelId || 'No definido'}>`);
        }
    } catch (e) { 
        console.log("Error manejado en interacción:", e.message); 
    }
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

// Evitar que el bot se caiga por errores no capturados
process.on('uncaughtException', (err) => console.log('Excepción capturada:', err.message));
process.on('unhandledRejection', (reason) => console.log('Rechazo capturado:', reason));
