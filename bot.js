require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

// Validar variables de entorno
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.error('❌ ERROR: Faltan variables de entorno DISCORD_TOKEN o CLIENT_ID');
    process.exit(1);
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TARGET_CHAT_ID = "120363311667281009@g.us";

let lastMessages = [];
let bridgeConfig = { discordChannelId: null };
let isWaReady = false;
let updateQR = null;

console.log('🚀 Iniciando bot...');

const discordClient = new DiscordClient({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--disable-gpu', 
            '--no-zygote', 
            '--single-process',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-extensions'
        ]
    }
});

async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    
    const startTime = Date.now();
    
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId);
        if (!channel) return;
        
        const [contact, media] = await Promise.all([
            msg.getContact().catch(() => null),
            msg.hasMedia ? msg.downloadMedia().catch(() => null) : Promise.resolve(null)
        ]);

        const pushname = msg.fromMe ? "Tú (Admin)" : (contact?.pushname || "Admin");
        let pfp = 'https://i.imgur.com/83p7ihD.png';

        const text = msg.body?.trim() || (msg.hasMedia ? "🖼️ [Imagen/Multimedia]" : "📢 Nuevo Aviso");

        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + pushname, iconURL: pfp })
            .setDescription(text.substring(0, 4096))
            .setFooter({ text: '✨ Aviso Oficial' })
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (media?.data) {
            const buffer = Buffer.from(media.data, 'base64');
            const ext = media.mimetype.split('/')[1] || 'png';
            files.push(new AttachmentBuilder(buffer, { name: `archivo.${ext}` }));
            if (media.mimetype.startsWith('image/')) {
                embed.setImage(`attachment://archivo.${ext}`);
            }
        }

        await channel.send({ embeds: [embed], files });
        
        const elapsed = Date.now() - startTime;
        console.log(`✅ Enviado a Discord en ${elapsed}ms`);
    } catch (e) { 
        console.log("❌ Error enviando a Discord:", e.message); 
    }
}

whatsappClient.on('qr', qr => { 
    console.log("🔲 QR generado");
    if (updateQR) updateQR(qr); 
});

whatsappClient.on('ready', async () => { 
    isWaReady = true; 
    console.log('✅ WhatsApp LISTO');
    
    try {
        const chat = await whatsappClient.getChatById(TARGET_CHAT_ID);
        console.log(`✅ Grupo: ${chat.name}`);
        console.log(`✅ ID: ${TARGET_CHAT_ID}`);
    } catch (e) {
        console.log(`❌ Grupo no encontrado: ${TARGET_CHAT_ID}`);
        console.log('ℹ️ El bot seguirá funcionando. Usa /listar_chats para verificar.');
    }
});

whatsappClient.on('authenticated', () => console.log('🔐 WhatsApp autenticado'));
whatsappClient.on('auth_failure', (msg) => console.log('❌ Fallo autenticación:', msg));
whatsappClient.on('disconnected', (reason) => {
    isWaReady = false;
    console.log('⚠️ WhatsApp desconectado:', reason);
});

whatsappClient.on('loading_screen', (percent) => {
    console.log(`⏳ Cargando WhatsApp: ${percent}%`);
});

whatsappClient.on('message', procesarMensaje);
whatsappClient.on('message_create', procesarMensaje);

async function procesarMensaje(msg) {
    const chatId = msg.fromMe ? msg.to : msg.from;
    if (chatId !== TARGET_CHAT_ID) return;
    
    const receivedTime = Date.now();
    console.log(`\n⚡ MENSAJE RECIBIDO [${new Date().toLocaleTimeString()}]`);
    
    try {
        const chat = await msg.getChat();
        const contact = await msg.getContact();
        
        const participant = chat.participants.find(p => p.id._serialized === contact.id._serialized);
        const esAdmin = participant?.isAdmin || participant?.isSuperAdmin || msg.fromMe;
        
        console.log(`👤 ${contact.pushname || 'Desconocido'} | Admin: ${esAdmin ? '✅' : '❌'}`);
        console.log(`💬 ${msg.body || '[Media]'}`);
        
        if (esAdmin) {
            console.log(`🚀 REENVIANDO...`);
            
            lastMessages.push(msg);
            if (lastMessages.length > 10) lastMessages.shift();
            
            sendToDiscord(msg);
            
            const processTime = Date.now() - receivedTime;
            console.log(`⏱️ Procesado en ${processTime}ms\n`);
        } else {
            console.log(`⏭️ Ignorado (no admin)\n`);
        }
    } catch (e) { 
        console.log("❌ Error procesando:", e.message); 
    }
}

discordClient.on('ready', () => {
    console.log(`✅ Discord conectado: ${discordClient.user.tag}`);
});

discordClient.on('error', (error) => {
    console.error('❌ Error de Discord:', error);
});

discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    try {
        if (i.commandName === 'configurar') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await i.reply({ content: '❌ Solo admins', ephemeral: true });
            }
            const canal = i.options.getChannel('canal');
            bridgeConfig.discordChannelId = canal.id;
            await i.reply({
                content: `✅ Canal: <#${canal.id}>\n⚡ Modo rápido activado`,
                ephemeral: true
            });
            console.log(`⚙️ Canal configurado: ${canal.name}`);
        }
        
        if (i.commandName === 'status') {
            const statusEmbed = new EmbedBuilder()
                .setColor(isWaReady ? '#00ff00' : '#ff0000')
                .setTitle('📊 Estado del Bot')
                .addFields(
                    { name: 'WhatsApp', value: isWaReady ? '✅ Online' : '❌ Offline', inline: true },
                    { name: 'Canal', value: bridgeConfig.discordChannelId ? `<#${bridgeConfig.discordChannelId}>` : '❌ Sin configurar', inline: true },
                    { name: 'Memoria', value: `${lastMessages.length}/10`, inline: true },
                    { name: 'Grupo', value: `\`${TARGET_CHAT_ID}\``, inline: false }
                )
                .setTimestamp();
            await i.reply({ embeds: [statusEmbed], ephemeral: true });
        }

        if (i.commandName === 'ultimo') {
            if (lastMessages.length > 0) {
                await i.deferReply({ ephemeral: true });
                const toSend = lastMessages.slice(-2);
                for (const m of toSend) await sendToDiscord(m, true);
                await i.editReply("✅ Reenviados");
            } else {
                await i.reply({ content: "❌ Sin mensajes", ephemeral: true });
            }
        }

        if (i.commandName === 'test') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await i.reply({ content: '❌ Solo admins', ephemeral: true });
            }
            if (!isWaReady) {
                return await i.reply({ content: '❌ WhatsApp offline', ephemeral: true });
            }

            try {
                await i.deferReply({ ephemeral: true });
                const chat = await whatsappClient.getChatById(TARGET_CHAT_ID);
                await chat.sendMessage('🧪 Test');
                await i.editReply(`✅ Enviado`);
            } catch (e) {
                await i.editReply(`❌ ${e.message}`);
            }
        }

    } catch (e) { 
        console.log("❌ Error comando:", e.message);
        await i.reply({ content: '❌ Error', ephemeral: true }).catch(() => {});
    }
});

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Estado'),
    new SlashCommandBuilder().setName('ultimo').setDescription('Últimos 2'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Configurar')
        .addChannelOption(o => o.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('test').setDescription('Test').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c => c.toJSON());

// Inicializar WhatsApp
console.log('🔄 Inicializando WhatsApp...');
whatsappClient.initialize().catch(e => {
    console.error('❌ ERROR CRÍTICO inicializando WhatsApp:', e);
    console.error('Stack:', e.stack);
});

// Inicializar Discord
console.log('🔄 Inicializando Discord...');
discordClient.login(DISCORD_TOKEN).catch(e => {
    console.error('❌ ERROR CRÍTICO con Discord:', e);
    console.error('Verifica que DISCORD_TOKEN sea correcto');
    process.exit(1);
});

// Registrar comandos
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => { 
    try { 
        console.log('📝 Registrando comandos...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos registrados');
    } catch (e) {
        console.error('❌ Error registrando comandos:', e.message);
    } 
})();

module.exports.setQRHandler = h => { updateQR = h; };

process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando...');
    whatsappClient.destroy();
    discordClient.destroy();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Excepción no capturada:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada:', reason);
});
