require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

const CONFIG_FILE = './config.json';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;

// Configuración inicial
let config = {
    targetChannelId: null,
    communityName: '✨📖 El Club De Monika 🗡️✨',
    channelName: 'Avisos'
};

if (fs.existsSync(CONFIG_FILE)) {
    try {
        const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        config = { ...config, ...savedConfig };
    } catch (e) { console.error('Error al cargar config.json'); }
}

const saveConfig = () => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

const discordClient = new DiscordClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Configuración de WhatsApp con ruta de Chromium corregida
const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--single-process'
        ]
    }
});

// --- SISTEMA DE EMPAREJAMIENTO (FIX PARA ERROR 't') ---
whatsappClient.on('qr', async () => {
    if (WHATSAPP_PHONE) {
        try {
            console.log('⏳ Esperando 10s para que la página de WhatsApp cargue funciones internas...');
            await new Promise(resolve => setTimeout(resolve, 10000)); 

            console.log(`📲 Solicitando código para: ${WHATSAPP_PHONE}`);
            const code = await whatsappClient.requestPairingCode(WHATSAPP_PHONE);
            
            console.log('\n' + '═'.repeat(40));
            console.log(`🔑 CÓDIGO DE VINCULACIÓN: ${code}`);
            console.log('═'.repeat(40) + '\n');
        } catch (err) {
            console.error('❌ Error al generar código:', err.message);
        }
    }
});

whatsappClient.on('ready', () => console.log('✅ WhatsApp Conectado!'));

// Reenvío de mensajes
whatsappClient.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        if (!chat.isGroup || !config.targetChannelId) return;

        if (chat.name.toLowerCase().includes(config.channelName.toLowerCase())) {
            const channel = await discordClient.channels.fetch(config.targetChannelId);
            if (channel) {
                const contact = await message.getContact();
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `📱 ${contact.pushname || contact.number}` })
                    .setDescription(message.body || '*Archivo multimedia*')
                    .setColor(0x25D366)
                    .setFooter({ text: `${config.communityName} → ${chat.name}` })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
            }
        }
    } catch (e) { console.error('Error en reenvío:', e.message); }
});

// Comandos de Discord
discordClient.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    if (msg.content.startsWith('!setcanal')) {
        config.targetChannelId = msg.channel.id;
        saveConfig();
        msg.reply('✅ Canal configurado.');
    }

    if (msg.content === '!status') {
        const waStatus = whatsappClient.info ? '✅ Conectado' : '❌ Desconectado';
        msg.reply(`📊 **Estado:**\n• WhatsApp: ${waStatus}\n• Discord: ✅ Online`);
    }
});

// Iniciar ambos servicios
whatsappClient.initialize();
discordClient.login(DISCORD_TOKEN);
