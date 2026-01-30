require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Configuración en memoria
let bridgeConfig = {
    whatsappGroupName: null, // Ahora guardamos el NOMBRE
    discordChannelId: null
};

// 1. Definición de comandos Slash
const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Revisa el estado de la conexión'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Vincula el grupo de WA por su nombre y este canal de Discord')
        .addStringOption(option => 
            option.setName('nombre_grupo')
            .setDescription('Nombre exacto del grupo de WhatsApp (ej: El Club De Monika)')
            .setRequired(true)),
    new SlashCommandBuilder().setName('ultimo').setDescription('Muestra el último mensaje detectado'),
].map(command => command.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

let lastWAMessage = { body: "Esperando mensajes...", author: "Sistema", group: "Ninguno", pfp: null };

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Lógica de WhatsApp con filtro por NOMBRE
whatsappClient.on('message', async (msg) => {
    const chat = await msg.getChat();
    
    // Si hay un nombre configurado, ignoramos mensajes de otros grupos
    if (bridgeConfig.whatsappGroupName) {
        if (!chat.isGroup || chat.name !== bridgeConfig.whatsappGroupName) return;
    } else {
        // Si no hay configuración, no reenviamos nada automáticamente
        return;
    }

    const contact = await msg.getContact();
    let profilePic = await contact.getProfilePicUrl().catch(() => null);

    lastWAMessage = {
        body: msg.body || (msg.hasMedia ? "📷 [Multimedia]" : "Texto vacío"),
        author: contact.pushname || contact.number,
        group: chat.name,
        pfp: profilePic
    };

    // Reenvío automático al canal de Discord
    if (bridgeConfig.discordChannelId) {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setAuthor({ name: lastWAMessage.author, iconURL: lastWAMessage.pfp || 'https://i.imgur.com/83p7ihD.png' })
                .setDescription(lastWAMessage.body)
                .setFooter({ text: `WhatsApp: ${lastWAMessage.group}` })
                .setTimestamp();
            channel.send({ embeds: [embed] });
        }
    }
});

// Manejo de Interacciones Slash
discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'configurar') {
        const nombreWA = interaction.options.getString('nombre_grupo');
        
        // Guardamos el nombre y el canal actual
        bridgeConfig.whatsappGroupName = nombreWA;
        bridgeConfig.discordChannelId = interaction.channelId;

        await interaction.reply({
            content: `✅ **Configuración por nombre completada**\n📍 **Canal de Discord:** <#${interaction.channelId}>\n📱 **Grupo de WhatsApp:** \`${nombreWA}\`\n\n*Nota: El nombre debe ser idéntico (mayúsculas, minúsculas y emojis).*`,
        });
    }

    if (interaction.commandName === 'status') {
        const filtro = bridgeConfig.whatsappGroupName ? `Filtrando por: ${bridgeConfig.whatsappGroupName}` : 'Esperando configuración';
        await interaction.reply(`📊 **WA:** ✅ | **Discord:** ✅\n🔍 **Estado:** ${filtro}`);
    }

    if (interaction.commandName === 'ultimo') {
        const embed = new EmbedBuilder()
            .setColor('#e94560')
            .setAuthor({ name: lastWAMessage.author, iconURL: lastWAMessage.pfp || 'https://i.imgur.com/83p7ihD.png' })
            .setTitle('✨ Último mensaje capturado')
            .setDescription(`> ${lastWAMessage.body}`)
            .setFooter({ text: `Grupo: ${lastWAMessage.group}` });
        await interaction.reply({ embeds: [embed] });
    }
});

whatsappClient.initialize();
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos Slash configurados para búsqueda por nombre');
    } catch (e) { console.error(e); }
})();

// Manejo de QR para index.js
let updateQR = null;
whatsappClient.on('qr', (qr) => { if (updateQR) updateQR(qr); });
module.exports.setQRHandler = (handler) => { updateQR = handler; };
