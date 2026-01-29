// Discord + WhatsApp Bridge Bot
require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

// Configuración
const CONFIG_FILE = './config.json';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE; // Formato: 521234567890 (sin +, espacios ni guiones)

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
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// Eventos de WhatsApp - Código de Emparejamiento
whatsappClient.on('qr', async (qr) => {
    console.log('⚠️  QR Code generado...');
    
    if (WHATSAPP_PHONE) {
        try {
            const code = await whatsappClient.requestPairingCode(WHATSAPP_PHONE);
            console.log('\n' + '═'.repeat(50));
            console.log('📱 CÓDIGO DE EMPAREJAMIENTO DE WHATSAPP');
            console.log('═'.repeat(50));
            console.log('');
            console.log(`   Código: ${code}`);
            console.log('');
            console.log('📋 Pasos para vincular:');
            console.log('   1. Abre WhatsApp en tu teléfono');
            console.log('   2. Ve a Configuración > Dispositivos vinculados');
            console.log('   3. Toca "Vincular un dispositivo"');
            console.log('   4. Toca "Vincular con número de teléfono"');
            console.log(`   5. Ingresa este código: ${code}`);
            console.log('');
            console.log(`📞 Número configurado: ${WHATSAPP_PHONE}`);
            console.log('═'.repeat(50));
            console.log('');
        } catch (error) {
            console.error('❌ Error al solicitar código de emparejamiento:', error.message);
            console.log('');
            console.log('💡 Verifica que WHATSAPP_PHONE esté configurado correctamente');
            console.log('   Formato correcto: 521234567890 (código país + número)');
            console.log('   SIN: +, espacios, guiones ni paréntesis');
            console.log('');
        }
    } else {
        console.log('');
        console.log('⚠️  WHATSAPP_PHONE no está configurado en las variables de entorno');
        console.log('');
        console.log('💡 Para usar código de emparejamiento, agrega:');
        console.log('   WHATSAPP_PHONE=521234567890');
        console.log('   (reemplaza con tu número en formato internacional)');
        console.log('');
    }
});

whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp conectado correctamente');
    console.log(`🏘️  Comunidad: ${config.communityName}`);
    console.log(`📱 Canal: ${config.channelName}`);
});

whatsappClient.on('authenticated', () => {
    console.log('🔐 WhatsApp autenticado');
});

whatsappClient.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación de WhatsApp:', msg);
});

whatsappClient.on('disconnected', (reason) => {
    console.log('⚠️  WhatsApp desconectado:', reason);
});

// Reenvío de mensajes WhatsApp -> Discord
whatsappClient.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        
        if (!chat.isGroup) return;
        
        console.log(`📩 Mensaje recibido de: ${chat.name}`);
        
        const isTargetGroup = config.whatsappGroup && chat.name === config.whatsappGroup;
        const isAnnouncementChannel = chat.name === config.channelName || 
                                     chat.name.toLowerCase().includes(config.channelName.toLowerCase());
        
        if (!isTargetGroup && !isAnnouncementChannel) {
            return;
        }
        
        if (!config.targetChannelId) {
            console.log('⚠️  No hay canal de Discord configurado');
            return;
        }

        const contact = await message.getContact();
        const authorName = contact.pushname || contact.number;

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
        console.error('❌ Error procesando mensaje de WhatsApp:', error.message);
    }
});

// Eventos de Discord
discordClient.on('ready', () => {
    console.log(`✅ Discord bot conectado como ${discordClient.user.tag}`);
    console.log(`📢 Canal de Discord: ${config.targetChannelId || 'No configurado'}`);
    console.log(`🏘️  Comunidad de WhatsApp: ${config.communityName}`);
    console.log(`📱 Canal de WhatsApp: ${config.channelName}`);
});

discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!setcanal')) {
        config.targetChannelId = message.channel.id;
        saveConfig();
        await message.reply('✅ Canal configurado correctamente para recibir mensajes de WhatsApp.');
        console.log(`📢 Canal actualizado: ${message.channel.name} (${message.channel.id})`);
    }

    if (message.content.startsWith('!setgrupo ')) {
        const groupName = message.content.replace('!setgrupo ', '').trim();
        config.whatsappGroup = groupName;
        saveConfig();
        await message.reply(`✅ Grupo de WhatsApp configurado: "${groupName}"`);
        console.log(`📱 Grupo actualizado: ${groupName}`);
    }

    if (message.content.startsWith('!setcomunidad ')) {
        const communityName = message.content.replace('!setcomunidad ', '').trim();
        config.communityName = communityName;
        saveConfig();
        await message.reply(`✅ Comunidad de WhatsApp configurada: "${communityName}"`);
        console.log(`🏘️  Comunidad actualizada: ${communityName}`);
    }

    if (message.content.startsWith('!setcanal-wa ')) {
        const channelName = message.content.replace('!setcanal-wa ', '').trim();
        config.channelName = channelName;
        saveConfig();
        await message.reply(`✅ Canal de WhatsApp configurado: "${channelName}"`);
        console.log(`📢 Canal de WhatsApp actualizado: ${channelName}`);
    }

    if (message.content === '!ayuda' || message.content === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Comandos del Bot WhatsApp-Discord')
            .setDescription('Comandos disponibles:')
            .addFields(
                { name: '!setcanal', value: 'Configura este canal de Discord para recibir mensajes' },
                { name: '!setgrupo <nombre>', value: 'Configura un grupo de WhatsApp a escuchar' },
                { name: '!setcomunidad <nombre>', value: 'Configura la comunidad de WhatsApp' },
                { name: '!setcanal-wa <nombre>', value: 'Configura el canal de avisos de WhatsApp' },
                { name: '!status', value: 'Muestra la configuración actual' },
                { name: '!ayuda', value: 'Muestra este mensaje' }
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'Bot configurado para: El Club De Monika → Avisos' });

        await message.reply({ embeds: [helpEmbed] });
    }

    if (message.content === '!status') {
        const whatsappStatus = whatsappClient.info ? '✅ Conectado' : '⏳ Conectando...';
        
        const statusEmbed = new EmbedBuilder()
            .setTitle('📊 Estado del Bot')
            .addFields(
                { 
                    name: 'Discord', 
                    value: `✅ Conectado como ${discordClient.user.tag}`,
                    inline: false
                },
                { 
                    name: 'WhatsApp', 
                    value: whatsappStatus,
                    inline: false
                },
                { 
                    name: 'Canal de Discord', 
                    value: config.targetChannelId ? `<#${config.targetChannelId}>` : '❌ No configurado',
                    inline: false
                },
                {
                    name: 'Comunidad de WhatsApp',
                    value: config.communityName,
                    inline: true
                },
                {
                    name: 'Canal de WhatsApp',
                    value: config.channelName,
                    inline: true
                },
                { 
                    name: 'Grupo adicional', 
                    value: config.whatsappGroup || '⚪ No configurado',
                    inline: false
                }
            )
            .setColor(0x00FF00)
            .setFooter({ text: 'El bot escucha el canal de avisos por defecto' });

        await message.reply({ embeds: [statusEmbed] });
    }
});

// Manejo de errores
discordClient.on('error', (error) => {
    console.error('❌ Error en Discord:', error.message);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Error no manejado:', error);
});

// Iniciar clientes
async function start() {
    try {
        if (!DISCORD_TOKEN) {
            throw new Error('DISCORD_TOKEN no está configurado en las variables de entorno');
        }

        console.log('🚀 Iniciando WhatsApp-Discord Bridge Bot...');
        console.log('📁 Cargando configuración...');
        console.log('');
        
        if (!WHATSAPP_PHONE) {
            console.log('⚠️  WHATSAPP_PHONE no configurado - se usará QR code');
            console.log('');
        }
        
        await whatsappClient.initialize();
        await discordClient.login(DISCORD_TOKEN);
        
        console.log('');
        console.log('✅ Bot iniciado correctamente');
        console.log('💡 Usa !setcanal en Discord para configurar el canal de destino');
        console.log('');
    } catch (error) {
        console.error('❌ Error al iniciar el bot:', error.message);
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

process.on('SIGTERM', async () => {
    console.log('\n👋 Cerrando bot...');
    await whatsappClient.destroy();
    await discordClient.destroy();
    process.exit(0);
});

start();
