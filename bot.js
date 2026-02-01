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

// --- VALIDACIÓN DE ENTORNO ---
const REQUIRED_ENV = ['DISCORD_TOKEN', 'CLIENT_ID', 'TARGET_CHAT_ID'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
    console.error(`❌ ERROR: Faltan variables de entorno: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TARGET_CHAT_ID = process.env.TARGET_CHAT_ID; // "120363302612091643@g.us"

let lastMessages = [];
let bridgeConfig = { discordChannelId: null };
let isWaReady = false;
let updateQR = null;

console.log('🚀 Iniciando bot...');

// --- CLIENTE DISCORD ---
const discordClient = new DiscordClient({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// --- CONFIGURACIÓN PUPPETEER ---
const puppeteerConfig = {
    headless: true,
    args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage', 
        '--disable-gpu', 
        '--no-zygote', 
        '--single-process',
        '--disable-extensions'
    ],
    timeout: 0
};

// Solo agregar executablePath si está definido en el .env (para evitar errores en Windows/Mac)
if (process.env.CHROMIUM_PATH) {
    puppeteerConfig.executablePath = process.env.CHROMIUM_PATH;
}

// --- CLIENTE WHATSAPP ---
const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    authTimeoutMs: 60000,
    puppeteer: puppeteerConfig,
    qrMaxRetries: 5
});

/**
 * Función auxiliar para descargar media con timeout
 * Evita que el bot se congele si WA tarda en responder
 */
async function downloadMediaWithTimeout(msg, timeoutMs = 10000) {
    if (!msg.hasMedia) return null;
    
    const downloadPromise = msg.downloadMedia();
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout descargando media')), timeoutMs)
    );

    try {
        return await Promise.race([downloadPromise, timeoutPromise]);
    } catch (e) {
        console.warn(`⚠️ No se pudo descargar media: ${e.message}`);
        return null;
    }
}

async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) return;
    const startTime = Date.now();
    
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) {
            console.log('⚠️ Canal de Discord no encontrado o sin permisos.');
            return;
        }

        const [contact, media] = await Promise.all([
            msg.getContact().catch(() => ({ pushname: 'Desconocido' })),
            downloadMediaWithTimeout(msg)
        ]);

        const pushname = msg.fromMe ? "Tú (Bot/Admin)" : (contact.pushname || contact.number || "Admin");
        const pfp = 'https://i.imgur.com/83p7ihD.png'; // Puedes mejorar esto buscando la foto real
        
        let text = msg.body?.trim();
        if (!text && msg.hasMedia) text = "🖼️ [Imagen/Multimedia adjunta]";
        if (!text) text = "📢 Nuevo Aviso";

        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + pushname, iconURL: pfp })
            .setDescription(text.substring(0, 4096))
            .setFooter({ text: '✨ Aviso Oficial' })
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (media && media.data) {
            const buffer = Buffer.from(media.data, 'base64');
            const ext = media.mimetype.split('/')[1]?.split(';')[0] || 'dat';
            const fileName = `archivo.${ext}`;
            
            files.push(new AttachmentBuilder(buffer, { name: fileName }));
            
            if (media.mimetype.startsWith('image/')) {
                embed.setImage(`attachment://${fileName}`);
            }
        }

        await channel.send({ embeds: [embed], files });
        
        const elapsed = Date.now() - startTime;
        console.log(`✅ Enviado a Discord en ${elapsed}ms`);
    } catch (e) { 
        console.log("❌ Error enviando a Discord:", e.message); 
    }
}

// --- EVENTOS WHATSAPP ---

whatsappClient.on('qr', qr => { 
    console.log("\n" + "=".repeat(50));
    console.log("🔲 ESCANEA ESTE QR CON WHATSAPP:");
    console.log("=".repeat(50) + "\n");
    // require('qrcode-terminal').generate(qr, { small: true }); // Opcional: Descomenta si instalas qrcode-terminal
    console.log("QR String:", qr);
    if (updateQR) updateQR(qr); 
});

whatsappClient.on('ready', async () => { 
    isWaReady = true; 
    console.log('✅ WhatsApp CONECTADO Y LISTO');
    try {
        const chat = await whatsappClient.getChatById(TARGET_CHAT_ID);
        console.log(`✅ Grupo objetivo vinculado: "${chat.name}"`);
    } catch (e) {
        console.log(`⚠️ Grupo no encontrado: ${TARGET_CHAT_ID}`);
        console.log('ℹ️ Asegúrate de que el ID en .env sea correcto. Usa /listar_chats');
    }
});

whatsappClient.on('authenticated', () => console.log('🔐 WhatsApp autenticado'));
whatsappClient.on('auth_failure', err => console.error('❌ Fallo de autenticación:', err));

whatsappClient.on('disconnected', (reason) => {
    isWaReady = false;
    console.log('⚠️ WhatsApp desconectado:', reason);
    console.log('🔄 Reconectando en 5s...');
    setTimeout(() => whatsappClient.initialize().catch(console.error), 5000);
});

whatsappClient.on('message_create', procesarMensaje); // message_create escucha mis propios mensajes también

async function procesarMensaje(msg) {
    // Verificar si el mensaje viene del grupo objetivo
    if (msg.to !== TARGET_CHAT_ID && msg.from !== TARGET_CHAT_ID) return;

    // Ignorar mensajes de estado (ej: "Juan salió del grupo")
    if (msg.isStatus) return;

    try {
        const chat = await msg.getChat();
        const contact = await msg.getContact();
        
        // Obtener participante para ver si es admin
        let participant = null;
        if (chat.participants) {
            participant = chat.participants.find(p => p.id._serialized === contact.id._serialized);
        }

        const esAdmin = participant?.isAdmin || participant?.isSuperAdmin || msg.fromMe;
        
        if (esAdmin) {
            console.log(`⚡ Procesando mensaje de Admin: ${contact.pushname || '...'}`);
            
            // Guardar en memoria
            lastMessages.push(msg);
            if (lastMessages.length > 10) lastMessages.shift();
            
            // Enviar
            await sendToDiscord(msg);
        }
    } catch (e) { 
        console.log("❌ Error procesando mensaje WA:", e.message); 
    }
}

// --- EVENTOS DISCORD ---

discordClient.on('ready', () => {
    console.log(`✅ Discord conectado como: ${discordClient.user.tag}`);
});

discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;

    try {
        // Commando: CONFIGURAR
        if (i.commandName === 'configurar') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await i.reply({ content: '❌ Solo administradores.', ephemeral: true });
            }
            const canal = i.options.getChannel('canal');
            bridgeConfig.discordChannelId = canal.id;
            await i.reply({ content: `✅ Canal configurado: <#${canal.id}>`, ephemeral: true });
            console.log(`⚙️ Nuevo canal configurado: ${canal.name}`);
        }

        // Commando: STATUS
        else if (i.commandName === 'status') {
            const statusEmbed = new EmbedBuilder()
                .setColor(isWaReady ? '#00ff00' : '#ff0000')
                .setTitle('📊 Estado del Puente')
                .addFields(
                    { name: 'WhatsApp', value: isWaReady ? '✅ Online' : '❌ Offline', inline: true },
                    { name: 'Canal Discord', value: bridgeConfig.discordChannelId ? `<#${bridgeConfig.discordChannelId}>` : '❌ Sin configurar', inline: true },
                    { name: 'Cache', value: `${lastMessages.length} msgs`, inline: true },
                    { name: 'Grupo ID', value: `\`${TARGET_CHAT_ID}\``, inline: false }
                )
                .setTimestamp();
            await i.reply({ embeds: [statusEmbed], ephemeral: true });
        }

        // Commando: ULTIMO
        else if (i.commandName === 'ultimo') {
            if (lastMessages.length > 0) {
                await i.deferReply({ ephemeral: true });
                const toSend = lastMessages.slice(-2);
                for (const m of toSend) await sendToDiscord(m, true);
                await i.editReply("✅ Historial reciente reenviado.");
            } else {
                await i.reply({ content: "❌ No hay mensajes recientes en memoria.", ephemeral: true });
            }
        }

        // Commando: LISTAR CHATS (Útil para obtener el ID)
        else if (i.commandName === 'listar_chats') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return i.reply('❌ Sin permisos');
            if (!isWaReady) return i.reply({ content: '❌ WhatsApp no está listo.', ephemeral: true });
            
            await i.deferReply({ ephemeral: true });
            const chats = await whatsappClient.getChats();
            const grupos = chats.filter(c => c.isGroup);
            
            const descripcion = grupos.slice(0, 15).map(g => 
                `${g.id._serialized === TARGET_CHAT_ID ? '🎯 ' : ''}**${g.name}**\nID: \`${g.id._serialized}\``
            ).join('\n\n');

            const embed = new EmbedBuilder()
                .setTitle(`📱 Grupos Encontrados (${grupos.length})`)
                .setDescription(descripcion || "No se encontraron grupos.")
                .setColor('#25D366');
            
            await i.editReply({ embeds: [embed] });
        }
    } catch (e) {
        console.error("❌ Error en interacción:", e);
        if (!i.replied && !i.deferred) {
            await i.reply({ content: '❌ Ocurrió un error interno.', ephemeral: true }).catch(() => {});
        }
    }
});

// --- DEFINICIÓN DE COMANDOS ---
const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Ver estado del bot'),
    new SlashCommandBuilder().setName('ultimo').setDescription('Reenviar últimos mensajes'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Configura el canal de destino')
        .addChannelOption(o => o.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('listar_chats').setDescription('Lista los IDs de los grupos de WhatsApp').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map(c => c.toJSON());

// --- INICIALIZACIÓN ---
(async () => {
    try {
        console.log('🔄 Conectando Discord...');
        await discordClient.login(DISCORD_TOKEN);
        
        console.log('📝 Actualizando comandos (/) ...');
        const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        
        console.log('🔄 Inicializando WhatsApp Web...');
        whatsappClient.initialize().catch(e => console.error("❌ Fallo inicialización WA:", e));
    } catch (e) {
        console.error('❌ Error fatal en arranque:', e);
        process.exit(1);
    }
})();

// Manejo de cierres y errores globales
module.exports.setQRHandler = h => { updateQR = h; };

process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando servicios...');
    whatsappClient.destroy();
    discordClient.destroy();
    process.exit(0);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
});
