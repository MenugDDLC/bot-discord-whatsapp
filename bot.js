require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Revisa el estado de la conexión'),
    new SlashCommandBuilder().setName('setcanal').setDescription('Configura este canal para avisos'),
    new SlashCommandBuilder().setName('ultimo').setDescription('Muestra el último mensaje con foto de perfil'),
].map(command => command.toJSON());

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Objeto para almacenar el último mensaje con más detalles
let lastWAMessage = { 
    body: "No hay mensajes recientes", 
    author: "Sistema", 
    group: "Ninguno",
    pfp: null 
};

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Captura de mensajes mejorada
whatsappClient.on('message', async (msg) => {
    const chat = await msg.getChat();
    if (chat.isGroup) {
        const contact = await msg.getContact();
        let profilePic = null;
        
        try {
            // Intentamos obtener la URL de la foto de perfil
            profilePic = await contact.getProfilePicUrl();
        } catch (e) {
            console.log("No se pudo obtener la foto de perfil.");
        }

        lastWAMessage = {
            body: msg.body || (msg.hasMedia ? "📷 [Archivo Multimedia]" : "Mensaje sin texto"),
            author: contact.pushname || contact.number,
            group: chat.name,
            pfp: profilePic
        };
    }
});

// Manejo de Slash Commands
discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ultimo') {
        const embed = new EmbedBuilder()
            .setColor('#e94560')
            .setTitle('✨ Previsualización de WhatsApp')
            .setAuthor({ 
                name: lastWAMessage.author, 
                iconURL: lastWAMessage.pfp || 'https://i.imgur.com/83p7ihD.png' // Imagen por defecto si no hay pfp
            })
            .setDescription(`💬 **Dijo:**\n> ${lastWAMessage.body}`)
            .addFields(
                { name: '👥 Grupo', value: `📍 ${lastWAMessage.group}`, inline: true }
            )
            .setThumbnail(lastWAMessage.pfp) // Muestra la foto de perfil en grande a un lado
            .setTimestamp()
            .setFooter({ text: 'El Club De Monika • Bridge' });

        await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'status') {
        await interaction.reply('📊 **Sistemas:** WA ✅ | Discord ✅');
    }
});

// Lógica de inicio y QR
let updateQR = null;
whatsappClient.on('qr', (qr) => { if (updateQR) updateQR(qr); });
module.exports.setQRHandler = (handler) => { updateQR = handler; };

whatsappClient.initialize();
discordClient.login(DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos Slash actualizados con fotos de perfil');
    } catch (e) { console.error(e); }
})();
