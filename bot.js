require('dotenv').config();
const { 
    Client: DiscordClient, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    AttachmentBuilder, 
    ChannelType, 
    PermissionFlagsBits 
} = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

// --- 1. VALIDACIÓN DE ENTORNO ---
const REQUIRED_ENV = ['DISCORD_TOKEN', 'CLIENT_ID', 'TARGET_CHAT_ID'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
    console.error(`❌ ERROR: Faltan variables en .env: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TARGET_CHAT_ID = process.env.TARGET_CHAT_ID;

// Variables de estado
let lastMessages = [];
let bridgeConfig = { discordChannelId: null };
let isWaReady = false;

console.log('🚀 Iniciando sistemas de alta velocidad...');

// --- 2. CONFIGURACIÓN DISCORD ---
const discordClient = new DiscordClient({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// --- 3. CONFIGURACIÓN WHATSAPP (OPTIMIZADA PARA VELOCIDAD) ---
const puppeteerConfig = {
    headless: true, // Sin ventana (más rápido)
    args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', 
        '--disable-gpu',
        '--disable-extensions'
    ],
    timeout: 0 // Sin timeout de navegador
};

if (process.env.CHROMIUM_PATH) puppeteerConfig.executablePath = process.env.CHROMIUM_PATH;

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    authTimeoutMs: 0, // ⚡ FIX: 0 = Infinito (evita el crash "auth timeout")
    puppeteer: puppeteerConfig,
    qrMaxRetries: 5
});

/**
 * ⚡ Descarga media con límite de tiempo.
 * Si la imagen tarda más de 5 segundos, la ignora para no frenar el bot.
 */
async function downloadMediaFast(msg) {
    if (!msg.hasMedia) return null;
    
    const downloadPromise = msg.downloadMedia();
    // 5 segundos máximo para descargar, si no, aborta media
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT_MEDIA')), 5000)
    );

    try {
        return await Promise.race([downloadPromise, timeoutPromise]);
    } catch (e) {
        return null; // Retorna null silenciosamente para seguir rápido
    }
}

async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    
    // Ejecutamos en paralelo para ganar velocidad
    const [contact, media] = await Promise.all([
        msg.getContact().catch(() => ({ pushname: 'Desconocido' })),
        downloadMediaFast(msg)
    ]);

    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) return;

        const pushname = msg.fromMe ? "Tú (Admin)" : (contact.pushname || contact.number || "Admin");
        
        let text = msg.body?.trim();
        if (!text && msg.hasMedia) text = "🖼️ [Archivo Adjunto]";
        if (!text) text = "📢 Nuevo Mensaje";

        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + pushname, iconURL: 'https://i.imgur.com/83p7ihD.png' })
            .setDescription(text.substring(0, 4096))
            .setFooter({ text: '⚡ Enviado al instante' })
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (media && media.data) {
            const buffer = Buffer.from(media.data, 'base64');
            const ext = media.mimetype.split('/')[1]?.split(';')[0] || 'dat';
            const fileName = `archivo.${ext}`;
            files.push(new AttachmentBuilder(buffer, { name: fileName }));
            if (media.mimetype.startsWith('image/')) embed.setImage(`attachment://${fileName}`);
        }

        // Enviamos sin esperar confirmación (Fire & Forget parcial para velocidad)
        channel.send({ embeds: [embed], files }).catch(e => console.log("⚠️ Error envío Discord:", e.message));

    } catch (e) { 
        console.log("❌ Error general bridge:", e.message); 
    }
}

// --- 4. EVENTOS WHATSAPP ---

whatsappClient.on('qr', qr => { 
    console.log("\n" + "=".repeat(40));
    console.log("⚡ ESCANEA EL QR AHORA (Sin límite de tiempo)");
    console.log("=".repeat(40));
    console.log(qr);
    console.log("=".repeat(40) + "\n");
});

whatsappClient.on('ready', async () => { 
    isWaReady = true; 
    console.log('✅ WhatsApp CONECTADO - Modo Rápido Activado');
    try {
        const chat = await whatsappClient.getChatById(TARGET_CHAT_ID);
        console.log(`🎯 Objetivo fijado: ${chat.name}`);
    } catch (e) {
        console.log(`⚠️ Verifica el ID del grupo en .env: ${TARGET_CHAT_ID}`);
    }
});

whatsappClient.on('disconnected', (reason) => {
    isWaReady = false;
    console.log('⚠️ WhatsApp desconectado:', reason);
    // Reinicio agresivo
    whatsappClient.destroy().then(() => whatsappClient.initialize());
});

whatsappClient.on('message_create', async (msg) => {
    // ⚡ Filtro de alta velocidad: Primero ID, luego contenido
    if (msg.to !== TARGET_CHAT_ID && msg.from !== TARGET_CHAT_ID) return;
    if (msg.isStatus) return;

    // Solo procesamos si hay config
    if (!bridgeConfig.discordChannelId) return;

    // Chequeo de admin rápido (asumimos true si es fromMe para no esperar API)
    if (msg.fromMe) {
        sendToDiscord(msg);
        lastMessages.push(msg);
        if (lastMessages.length > 10) lastMessages.shift();
        return;
    }

    // Para otros, chequeamos author
    try {
        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const participant = chat.participants.find(p => p.id._serialized === contact.id._serialized);
        
        if (participant?.isAdmin || participant?.isSuperAdmin) {
            sendToDiscord(msg);
            lastMessages.push(msg);
            if (lastMessages.length > 10) lastMessages.shift();
        }
    } catch (e) { /* Ignorar errores leves para no parar */ }
});

// --- 5. EVENTOS DISCORD Y COMANDOS ---

discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;

    try {
        if (i.commandName === 'configurar') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) 
                return i.reply({ content: '❌ Solo admins', ephemeral: true });
            
            const canal = i.options.getChannel('canal');
            bridgeConfig.discordChannelId = canal.id;
            await i.reply({ content: `✅ **Configurado**\nCanal: <#${canal.id}>\n⚡ Modo: Ultra Rápido`, ephemeral: true });
            console.log(`⚙️ Canal configurado: ${canal.name}`);
        }
        
        else if (i.commandName === 'status') {
            const statusEmbed = new EmbedBuilder()
                .setColor(isWaReady ? '#00ff00' : '#ff0000')
                .setTitle('📊 Estado del Sistema')
                .addFields(
                    { name: 'WhatsApp', value: isWaReady ? '✅ Online' : '❌ Offline', inline: true },
                    { name: 'Canal', value: bridgeConfig.discordChannelId ? `<#${bridgeConfig.discordChannelId}>` : '❌ N/A', inline: true },
                    { name: 'Latencia Media', value: '⚡ < 1s', inline: true }
                );
            await i.reply({ embeds: [statusEmbed], ephemeral: true });
        }

        else if (i.commandName === 'ultimo') {
            if (lastMessages.length === 0) return i.reply({ content: "❌ Vacío", ephemeral: true });
            await i.deferReply({ ephemeral: true });
            const toSend = lastMessages.slice(-2);
            for (const m of toSend) await sendToDiscord(m, true);
            await i.editReply("✅ Enviado");
        }

        else if (i.commandName === 'listar_chats') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return i.reply('❌ Admins only');
            if (!isWaReady) return i.reply('❌ WhatsApp no listo');
            
            await i.deferReply({ ephemeral: true });
            const chats = await whatsappClient.getChats();
            const grupos = chats.filter(c => c.isGroup).slice(0, 15);
            
            let desc = grupos.map(g => `${g.id._serialized === TARGET_CHAT_ID ? '🎯' : '🔹'} **${g.name}**\n\`${g.id._serialized}\``).join('\n');
            const embed = new EmbedBuilder().setTitle('📱 Grupos (Top 15)').setDescription(desc || "Sin grupos").setColor('#25D366');
            await i.editReply({ embeds: [embed] });
        }
    } catch (e) {
        if (!i.replied) i.reply({ content: '❌ Error', ephemeral: true }).catch(() => {});
    }
});

const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado'),
    new SlashCommandBuilder().setName('ultimo').setDescription('Reenviar ultimos mensajes'),
    new SlashCommandBuilder().setName('listar_chats').setDescription('Ver IDs de grupos').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('configurar').setDescription('Configurar canal').addChannelOption(o => o.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText).setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map(c => c.toJSON());

// --- 6. INICIO ROBUSTO (ANTI-CRASH) ---

async function iniciarTodo() {
    try {
        console.log('🔄 Conectando Discord...');
        await discordClient.login(DISCORD_TOKEN);
        
        const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos registrados');

        console.log('🔄 Iniciando WhatsApp...');
        await whatsappClient.initialize();
        
    } catch (error) {
        console.error('❌ ERROR FATAL:', error.message);
        // Si falla por timeout al inicio, reintenta
        if (error.message.includes('auth timeout') || error.message.includes('protocol')) {
            console.log('♻️ Reintentando en 5s...');
            setTimeout(iniciarTodo, 5000);
        }
    }
}

// Manejo de errores globales para que no se apague nunca
process.on('unhandledRejection', (r) => {
    console.log('⚠️ Error no manejado (Bot sigue vivo):', r?.message || r);
});

iniciarTodo();
    
