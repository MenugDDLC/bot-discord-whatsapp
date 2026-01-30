require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const DEFAULT_COMMUNITY_NAME = "✨📖𝑬𝒍 𝑪𝒍𝒖𝒃 𝑫𝒆 𝑴𝒐𝒏𝒊𝒌𝒂 ✒✨";

// MEMORIA TEMPORAL: Guardará los últimos 5 mensajes recibidos
let lastMessages = [];
let bridgeConfig = { whatsappGroupName: DEFAULT_COMMUNITY_NAME, discordChannelId: null };
let isWaReady = false;

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado del puente'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Configura el canal de Discord')
        .addChannelOption(option => option.setName('canal').setDescription('Canal destino').addChannelTypes(ChannelType.GuildText).setRequired(true)),
    new SlashCommandBuilder().setName('ultimo').setDescription('Muestra los últimos mensajes guardados')
].map(command => command.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--single-process']
    }
});

async function safeReply(interaction, content) {
    try {
        if (interaction.deferred || interaction.replied) await interaction.editReply({ content }).catch(() => null);
        else await interaction.reply({ content }).catch(() => null);
    } catch (e) { console.log("Error reply:", e.message); }
}

async function sendToDiscord(msg, chatName, isHistory = false) {
    try {
        if (!bridgeConfig.discordChannelId) return;
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;

        const contact = await msg.getContact().catch(() => ({ pushname: 'Usuario' }));
        
        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#7289da' : '#fb92b3') 
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "") + (contact.pushname || "Usuario WhatsApp") })
            .setDescription(msg.body || (msg.hasMedia ? "🖼️ [Multimedia]" : "Mensaje sin texto"))
            .setFooter({ text: `Origen: ${chatName}` })
            .setTimestamp(new Date(msg.timestamp * 1000));

        await channel.send({ embeds: [embed] }).catch(() => null);
    } catch (e) { console.log("Error reenvío:", e.message); }
}

whatsappClient.on('ready', async () => {
    isWaReady = true;
    console.log('✅ WA Conectado.');
    const chats = await whatsappClient.getChats().catch(() => []);
    const target = chats.find(c => c.name.includes(DEFAULT_COMMUNITY_NAME));
    if (target) bridgeConfig.whatsappGroupName = target.name;
});

// EVENTO DE MENSAJE: Aquí guardamos en la "Memoria Flash"
whatsappClient.on('message', async (msg) => {
    if (!isWaReady) return;
    const chat = await msg.getChat().catch(() => null);
    
    if (chat && chat.name === bridgeConfig.whatsappGroupName) {
        // Guardamos en la lista (máximo 5)
        lastMessages.push(msg);
        if (lastMessages.length > 5) lastMessages.shift();
        
        // Reenvío normal en tiempo real
        await sendToDiscord(msg, chat.name);
    }
});

discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'configurar') {
        const canal = interaction.options.getChannel('canal');
        bridgeConfig.discordChannelId = canal.id;
        await safeReply(interaction, `✅ Canal configurado: <#${canal.id}>. Esperando mensajes de "${bridgeConfig.whatsappGroupName}"...`);
    }

    if (interaction.commandName === 'status') {
        await safeReply(interaction, `📊 **Estado**\nWA: ${isWaReady ? '✅' : '⏳'}\nGrupo: \`${bridgeConfig.whatsappGroupName}\`\nCanal: <#${bridgeConfig.discordChannelId || 'No definido'}>`);
    }

    if (interaction.commandName === 'ultimo') {
        if (lastMessages.length === 0) {
            return await safeReply(interaction, "📭 No hay mensajes guardados en esta sesión todavía.");
        }
        await interaction.deferReply();
        for (const m of lastMessages) {
            await sendToDiscord(m, bridgeConfig.whatsappGroupName, true);
        }
        await safeReply(interaction, "✅ Se han reenviado los últimos mensajes detectados.");
    }
});

whatsappClient.initialize().catch(() => {});
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {}
})();
