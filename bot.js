require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Configuración en memoria
let bridgeConfig = {
    whatsappGroupId: null,
    discordChannelId: null
};

// 1. Definición de todos los comandos Slash
const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Revisa el estado de la conexión'),
    new SlashCommandBuilder().setName('id_grupo').setDescription('Muestra el ID del último grupo de WA que envió mensaje'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Vincula el grupo de WA y el canal de Discord')
        .addStringOption(option => option.setName('whatsapp_id').setDescription('ID técnico del grupo de WhatsApp').setRequired(true)),
    new SlashCommandBuilder().setName('ultimo').setDescription('Muestra el último mensaje con foto de perfil'),
].map(command => command.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Variable para rastrear el último grupo detectado
let lastDetectedGroupId = "Aún no se detectan mensajes";
let lastWAMessage = { body: "Esperando mensajes...", author: "Sistema", group: "Ninguno", pfp: null };

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Lógica de WhatsApp
whatsappClient.on('message', async (msg) => {
    const chat = await msg.getChat();
    if (chat.isGroup) {
        // Guardamos el ID del grupo para el comando /id_grupo
        lastDetectedGroupId = chat.id._serialized;

        // Si ya hay configuración, filtramos
        if (bridgeConfig.whatsappGroupId && chat.id._serialized !== bridgeConfig.whatsappGroupId) return;

        const contact = await msg.getContact();
        let profilePic = await contact.getProfilePicUrl().catch(() => null);

        lastWAMessage = {
            body: msg.body || (msg.hasMedia ? "📷 [Multimedia]" : "Texto vacío"),
            author: contact.pushname || contact.number,
            group: chat.name,
            pfp: profilePic
        };

        // Reenvío automático al canal configurado
        if (bridgeConfig.discordChannelId) {
            const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor('#00ffcc')
                    .setAuthor({ name: lastWAMessage.author, iconURL: lastWAMessage.pfp || 'https://i.imgur.com/83p7ihD.png' })
                    .setDescription(lastWAMessage.body)
                    .setFooter({ text: `Grupo: ${lastWAMessage.group}` })
                    .setTimestamp();
                channel.send({ embeds: [embed] });
            }
        }
    }
});

// Manejo de Interacciones Slash
discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // COMANDO: /id_grupo
    if (interaction.commandName === 'id_grupo') {
        await interaction.reply({
            content: `🆔 **Último ID detectado:** \`${lastDetectedGroupId}\`\n\n*Escribe en el grupo de WhatsApp que quieres vincular y luego usa este comando de nuevo.*`,
            ephemeral: true
        });
    }

    // COMANDO: /configurar
    if (interaction.commandName === 'configurar') {
        const waId = interaction.options.getString('whatsapp_id');
        bridgeConfig.whatsappGroupId = waId;
        bridgeConfig.discordChannelId = interaction.channelId;

        await interaction.reply(`✅ **Puente establecido**\n📍 Discord: <#${interaction.channelId}>\n📱 WA ID: \`${waId}\``);
    }

    // COMANDO: /ultimo
    if (interaction.commandName === 'ultimo') {
        const embed = new EmbedBuilder()
            .setColor('#e94560')
            .setTitle('✨ Previsualización')
            .setAuthor({ name: lastWAMessage.author, iconURL: lastWAMessage.pfp || 'https://i.imgur.com/83p7ihD.png' })
            .setThumbnail(lastWAMessage.pfp)
            .setDescription(`💬 **Dijo:**\n> ${lastWAMessage.body}`)
            .setFooter({ text: `Origen: ${lastWAMessage.group}` });

        await interaction.reply({ embeds: [embed] });
    }

    // COMANDO: /status
    if (interaction.commandName === 'status') {
        await interaction.reply(`📊 **Estado:** Conexión OK ✅ | Filtro: ${bridgeConfig.whatsappGroupId ? 'Activo' : 'Inactivo'}`);
    }
});

whatsappClient.initialize();
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    } catch (e) { console.error(e); }
})();

let updateQR = null;
whatsappClient.on('qr', (qr) => { if (updateQR) updateQR(qr); });
module.exports.setQRHandler = (handler) => { updateQR = handler; };
