// Discord + WhatsApp Bridge Bot - Versión Optimizada
require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

// Configuración
const CONFIG_FILE = './config.json';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE; 

// Cargar o crear configuración
let config = {
    targetChannelId: null,
    whatsappGroup: null,
    communityName: '✨📖 El Club De Monika 🗡️✨',
    channelName: 'Avisos'
};

if (fs.existsSync(CONFIG_FILE)) {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = { ...config, ...savedConfig };
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Cliente de Discord
const discordClient = new DiscordClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Cliente de WhatsApp con configuración para servidores
const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--single-process'
        ]
    }
});

// --- SISTEMA DE VINCULACIÓN POR NÚMERO (CORREGIDO) ---
whatsappClient.on('qr', async () => {
    if (WHATSAPP_PHONE) {
        try {
            // Delay de seguridad para evitar error "window.onCodeReceivedEvent"
            console.log('⏳ Esperando 5s a que WhatsApp Web cargue completamente...');
            await new Promise(resolve => setTimeout(resolve, 5000)); 

            console.log(`📲 Solicitando código de vinculación para: ${WHATSAPP_PHONE}...`);
            const pairingCode = await whatsappClient.requestPairingCode(WHATSAPP_PHONE);
            
            console.log('\n' + '='.repeat(40));
            console.log(`🔑 CÓDIGO DE VINCULACIÓN: ${pairingCode}`);
            console.log('='.repeat(40));
            console.log(`Ingresa este código en tu WhatsApp vinculado al: ${WHATSAPP_PHONE}\n`);
        } catch (err) {
            console.error('❌ Error al solicitar código:', err.message);
            console.log('💡 El bot reintentará automáticamente en el próximo ciclo.');
        }
    } else {
        console.log('⚠️ WHATSAPP_PHONE no configurado. El bot no puede generar el código.');
    }
});

whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp está listo y conectado!');
});

whatsappClient.on('authenticated', () => {
    console.log('✅ Sesión de WhatsApp autenticada correctamente');
});

whatsappClient.on('auth_failure', (msg) => {
    console.error('❌ Fallo en la autenticación de WhatsApp:', msg);
});

// Reenvío de mensajes WA -> Discord
whatsappClient.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        if (!chat.isGroup) return;

        // Verificar si el grupo coincide con la configuración
        const isTarget = (config.whatsappGroup && chat.name === config.whatsappGroup) || 
                         chat.name.toLowerCase().includes(config.channelName.toLowerCase());

        if (!isTarget || !config.targetChannelId) return;

        const contact = await message.getContact();
        const channel = await discordClient.channels.fetch(config.targetChannelId);
        
        if (channel) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `📱 ${contact.pushname || contact.number}` })
                .setDescription(message.body || '*[Multimedia]*')
                .setColor(0x25D366)
                .setFooter({ text: `${config.communityName} → ${chat.name}` })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        }
    } catch (e) {
        console.error('❌ Error al reenviar mensaje:', e.message);
    }
});

// Comandos de Discord
discordClient.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    if (msg.content.startsWith('!setcanal')) {
        config.targetChannelId = msg.channel.id;
        saveConfig();
        msg.reply('✅ Canal de destino guardado correctamente. Los mensajes de WhatsApp llegarán aquí.');
    }

    if (msg.content === '!status') {
        const waStatus = whatsappClient.info ? '✅ Conect
