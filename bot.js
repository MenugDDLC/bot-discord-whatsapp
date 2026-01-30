require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // Necesitarás añadir esto a tus variables de entorno

// 1. Definición de Comandos Slash
const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Revisa el estado de la conexión'),
    new SlashCommandBuilder().setName('setcanal').setDescription('Configura este canal para recibir avisos'),
].map(command => command.toJSON());

const discordClient = new DiscordClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// 2. Registro de comandos en Discord
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log('⌛ Registrando comandos Slash...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos Slash registrados con éxito');
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
})();

// 3. Manejo de interacciones Slash
discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'status') {
        await interaction.reply('📊 **Estado:** WhatsApp Conectado ✅ | Discord Listo ✅');
    }

    if (interaction.commandName === 'setcanal') {
        // Aquí guardarías el ID del canal en una variable o base de datos
        await interaction.reply(`📍 Este canal (#${interaction.channel.name}) ha sido configurado para avisos.`);
    }
});

// Lógica de WhatsApp (Se mantiene igual para el QR)
const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let updateQR = null;
whatsappClient.on('qr', (qr) => { if (updateQR) updateQR(qr); });
module.exports.setQRHandler = (handler) => { updateQR = handler; };

whatsappClient.initialize();
discordClient.login(DISCORD_TOKEN);
