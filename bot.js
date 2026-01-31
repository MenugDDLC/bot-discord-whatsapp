require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ChannelType } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

let bridgeConfig = { 
    whatsappChatId: "120363311667281009@g.us", // ID actual (posiblemente la raíz)
    discordChannelId: null 
};
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

async function sendToDiscord(msg) {
    if (!bridgeConfig.discordChannelId) return;
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;
        
        const text = msg.body || (msg.hasMedia ? "🖼️ [Multimedia]" : "📢 Nuevo Aviso");
        const embed = new EmbedBuilder()
            .setColor('#fb92b3')
            .setAuthor({ name: "📢 Nuevo Aviso detectado" })
            .setDescription(text)
            .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => null);
    } catch (e) { console.log("Error reenvío:", e.message); }
}

whatsappClient.on('qr', qr => { if (updateQR) updateQR(qr); });
whatsappClient.on('ready', () => { isWaReady = true; console.log('✅ Bot Online'); });

// --- DETECTOR DINÁMICO ---
whatsappClient.on('message_create', async (msg) => {
    const chatId = msg.fromMe ? msg.to : msg.from;
    const chat = await msg.getChat().catch(() => ({ name: "Desconocido" }));

    // Si el nombre del chat tiene "Monika" o "Club" y el ID es nuevo, lo actualizamos automáticamente
    if (chat.name.includes("Monika") || chat.name.includes("Club")) {
        if (bridgeConfig.whatsappChatId !== chatId) {
            console.log(`🎯 ¡ID CORRECTO ENCONTRADO!: ${chatId} (${chat.name})`);
            bridgeConfig.whatsappChatId = chatId;
        }
        await sendToDiscord(msg);
    }
});

discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    if (i.commandName === 'configurar') {
        bridgeConfig.discordChannelId = i.options.getChannel('canal').id;
        await i.reply(`✅ Canal de Discord listo. Ahora escribe algo en WhatsApp para activar el puente.`);
    }
    if (i.commandName === 'status') {
        await i.reply(`📊 WA: ${isWaReady ? '✅' : '⏳'}\nID actual: \`${bridgeConfig.whatsappChatId}\``);
    }
});

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Estado'),
    new SlashCommandBuilder().setName('configurar').setDescription('Configurar canal').addChannelOption(o => o.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText).setRequired(true))
].map(c => c.toJSON());

whatsappClient.initialize().catch(() => {});
discordClient.login(DISCORD_TOKEN);
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => { try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); } catch (e) {} })();

module.exports.setQRHandler = h => { updateQR = h; };
