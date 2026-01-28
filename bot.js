// Discord + WhatsApp Bridge Bot
require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Configuración
const CONFIG_FILE = './config.json';

// Cargar o crear configuración
let config = {
    targetChannelId: null,
    whatsappGroup: null,
    communityName: '✨📖 El Club De Monika 🗡️✨', // Nombre de la comunidad por defecto
    channelName: 'Avisos' // Canal de avisos por defecto
};

if (fs.existsSync(CONFIG_FILE)) {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = { ...config, ...savedConfig }; // Mantener defaults si no existen
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

// Cliente de WhatsApp
const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Eventos de WhatsApp
whatsappClient.on('qr', (qr) => {
    console.log('📱 Escanea este código QR con WhatsApp:');
    qrcode.generate(qr, { small: true });
});

whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp conectado correctamente');
});

whatsappClient.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        
        // Verificar si es un grupo/canal (las comunidades tienen grupos internos)
        if (!chat.isGroup) return;
        
        // Log para debug
        console.log(`📩 Mensaje recibido de: ${chat.name}`);
        
        // Verificar si coincide con el grupo configurado O con el canal de avisos de la comunidad
        const isTargetGroup = config.whatsappGroup && chat.name === config.whatsappGroup;
        const isAnnouncementChannel = chat.name === config.channelName || 
                                     chat.name.toLowerCase().includes(config.channelName.toLowerCase());
        
        if (!isTargetGroup && !isAnnouncementChannel) {
            return; // No es el grupo/canal que estamos escuchando
        }
        
        if (!config.targetChannelId) {
            console.log('⚠️ No hay canal de Discord configurado');
            return;
        }

        const contact = await message.getContact();
        const authorName = contact.pushname || contact.number;

        // Enviar mensaje a Discord
        const channel = await discordClient.channels.fetch(config.targetChannelId);
        
        if (channel) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `📱 ${authorName}` })
                .setDescription(message.body || '*[Archivo multimedia]*')
                .setColor(0x25D366)
                .setFooter({ 
                    text: `${config.communityName} → ${chat.name}`,
                    iconURL: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg'
                })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            console.log(`✅ Mensaje reenviado de ${authorName} desde ${chat.name}`);
        }
    } catch (error) {
        console.error('❌ Error procesando mensaje de WhatsApp:', error);
    }
});

// Eventos de Discord
discordClient.on('ready', () => {
    console.log(`✅ Discord bot conectado como ${discordClient.user.tag}`);
    console.log(`📢 Canal de Discord: ${config.targetChannelId || 'Ninguno'}`);
    console.log(`🏘️ Comunidad de WhatsApp: ${config.communityName}`);
    console.log(`📱 Canal de WhatsApp: ${config.channelName}`);
    console.log(`📝 Grupo adicional: ${config.whatsappGroup || 'Ninguno'}`);
});

discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Comando para configurar canal
    if (message.content.startsWith('!setcanal')) {
        config.targetChannelId = message.channel.id;
        saveConfig();
        
        await message.reply(`✅ Canal configurado correctamente. Los mensajes de WhatsApp llegarán aquí.`);
        console.log(`📢 Canal actualizado: ${message.channel.name} (${message.channel.id})`);
    }

    // Comando para configurar grupo de WhatsApp
    if (message.content.startsWith('!setgrupo ')) {
        const groupName = message.content.replace('!setgrupo ', '').trim();
        config.whatsappGroup = groupName;
        saveConfig();
        
        await message.reply(`✅ Grupo de WhatsApp configurado: "${groupName}"`);
        console.log(`📱 Grupo actualizado: ${groupName}`);
    }

    // Comando para configurar comunidad
    if (message.content.startsWith('!setcomunidad ')) {
        const communityName = message.content.replace('!setcomunidad ', '').trim();
        config.communityName = communityName;
        saveConfig();
        
        await message.reply(`✅ Comunidad de WhatsApp configurada: "${communityName}"`);
        console.log(`🏘️ Comunidad actualizada: ${communityName}`);
    }

    // Comando para configurar canal de avisos
    if (message.content.startsWith('!setcanal-wa ')) {
        const channelName = message.content.replace('!setcanal-wa ', '').trim();
        config.channelName = channelName;
        saveConfig();
        
        await message.reply(`✅ Canal de WhatsApp configurado: "${channelName}"`);
        console.log(`📢 Canal de WhatsApp actualizado: ${channelName}`);
    }

    // Comando de ayuda
    if (message.content === '!ayuda' || message.content === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Comandos del Bot WhatsApp-Discord')
            .setDescription('Comandos disponibles:')
            .addFields(
                { name: '!setcanal', value: 'Configura este canal de Discord para recibir mensajes' },
                { name: '!setgrupo <nombre>', value: 'Configura un grupo de WhatsApp a escuchar' },
                { name: '!setcomunidad <nombre>', value: 'Configura la comunidad de WhatsApp' },
                { name: '!setcanal-wa <nombre>', value: 'Configura el canal de avisos de WhatsApp (por defecto: "Avisos")' },
                { name: '!status', value: 'Muestra la configuración actual' },
                { name: '!ayuda', value: 'Muestra este mensaje' }
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'Configuración pre-cargada: El Club De Monika → Avisos' });

        await message.reply({ embeds: [helpEmbed] });
    }

    // Comando de status
    if (message.content === '!status') {
        const statusEmbed = new EmbedBuilder()
            .setTitle('📊 Estado del Bot')
            .addFields(
                { 
                    name: 'Discord', 
                    value: `✅ Conectado como ${discordClient.user.tag}` 
                },
                { 
                    name: 'WhatsApp', 
                    value: whatsappClient.info ? '✅ Conectado' : '⏳ Esperando conexión' 
                },
                { 
                    name: 'Canal de Discord', 
                    value: config.targetChannelId ? `<#${config.targetChannelId}>` : '❌ No configurado' 
                },
                {
                    name: 'Comunidad de WhatsApp',
                    value: config.communityName || '❌ No configurada'
                },
                {
                    name: 'Canal de WhatsApp',
                    value: config.channelName || '❌ No configurado'
                },
                { 
                    name: 'Grupo de WhatsApp (opcional)', 
                    value: config.whatsappGroup || '⚪ No configurado (usando canal de comunidad)' 
                }
            )
            .setColor(0x00FF00)
            .setFooter({ text: 'El bot escucha el canal "Avisos" de la comunidad por defecto' });

        await message.reply({ embeds: [statusEmbed] });
    }
});

// Manejo de errores
whatsappClient.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación en WhatsApp:', msg);
});

discordClient.on('error', (error) => {
    console.error('❌ Error en Discord:', error);
});

// Iniciar clientes
async function start() {
    try {
        console.log('🚀 Iniciando bot...');
        
        await whatsappClient.initialize();
        await discordClient.login(process.env.DISCORD_TOKEN);
        
        console.log('✅ Bot iniciado correctamente');
    } catch (error) {
        console.error('❌ Error al iniciar el bot:', error);
        process.exit(1);
    }
}

// Manejo de cierre
process.on('SIGINT', async () => {
    console.log('\n👋 Cerrando bot...');
    await whatsappClient.destroy();
    await discordClient.destroy();
    process.exit(0);
});

start();
