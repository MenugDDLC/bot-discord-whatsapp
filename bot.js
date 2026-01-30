require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

let bridgeConfig = { whatsappGroupName: null, discordChannelId: null };

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado'),
    new SlashCommandBuilder().setName('configurar').setDescription('Vincula automáticamente el grupo de Monika'),
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

async function sendToDiscord(msg, chatName) {
    if (!bridgeConfig.discordChannelId) return;
    const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
    if (!channel) return;

    const contact = await msg.getContact();
    const pfp = await contact.getProfilePicUrl().catch(() => null);

    const embed = new EmbedBuilder()
        .setColor('#fb92b3') 
        .setAuthor({ name: contact.pushname || contact.number, iconURL: pfp || 'https://i.imgur.com/83p7ihD.png' })
        .setDescription(msg.body || "📷 [Archivo/Multimedia]")
        .setFooter({ text: `WhatsApp: ${chatName}` })
        .setTimestamp(new Date(msg.timestamp * 1000));

    await channel.send({ embeds: [embed] });
}

whatsappClient.on('message', async (msg) => {
    const chat = await msg.getChat();
    // Verificamos si el nombre del chat coincide con el que guardamos
    if (bridgeConfig.whatsappGroupName && chat.name === bridgeConfig.whatsappGroupName) {
        await sendToDiscord(msg, chat.name);
    }
});

discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'configurar') {
        await interaction.reply(`🎀 Buscando el club de Monika en tus chats...`);

        const chats = await whatsappClient.getChats();
        
        // BUSCADOR INTELIGENTE: Busca cualquier grupo que tenga la palabra "Monika"
        const targetChat = chats.find(c => c.isGroup && c.name.includes('Monika'));

        if (targetChat) {
            bridgeConfig.whatsappGroupName = targetChat.name; // Guarda el nombre exacto con emojis
            bridgeConfig.discordChannelId = interaction.channelId;

            const messages = await targetChat.fetchMessages({ limit: 1 });
            if (messages.length > 0) {
                await sendToDiscord(messages[0], targetChat.name);
            }

            await interaction.editReply(`✅ **¡Puente Listo!**\nDetectado: \`${targetChat.name}\`\n📍 Canal: <#${interaction.channelId}>`);
        } else {
            await interaction.editReply(`❌ No encontré ningún grupo con el nombre "Monika". Verifica que el bot esté dentro del grupo.`);
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
