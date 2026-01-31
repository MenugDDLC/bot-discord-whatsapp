require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TARGET_CHAT_ID = "120363311667281009@g.us"; 

let lastMessages = [];
let bridgeConfig = { discordChannelId: null };
let isWaReady = false;
let updateQR = null;
let messageQueue = [];
let isProcessing = false;

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--disable-gpu', 
            '--no-zygote', 
            '--single-process'
        ]
    }
});

// --- COLA DE PROCESAMIENTO RÁPIDO ---
async function processMessageQueue() {
    if (isProcessing || messageQueue.length === 0) return;
    
    isProcessing = true;
    
    while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        await sendToDiscord(msg).catch(err => console.log("Error en cola:", err.message));
        
        // Pequeño delay para evitar rate limits de Discord (250ms es muy rápido)
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    
    isProcessing = false;
}

// --- FUNCIÓN DE REENVÍO OPTIMIZADA ---
async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) {
        console.log("⚠️ No hay canal configurado, mensaje no enviado");
        return;
    }
    
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) {
            console.log("⚠️ Canal no encontrado");
            return;
        }
        
        // Optimización: obtener contacto e imagen en paralelo
        const [contact, mediaData] = await Promise.all([
            msg.getContact().catch(() => null),
            msg.hasMedia ? msg.downloadMedia().catch(() => null) : Promise.resolve(null)
        ]);

        let pushname = msg.fromMe ? "Tú (Admin)" : (contact?.pushname || "Admin de la Comunidad");
        let pfp = 'https://i.imgur.com/83p7ihD.png';

        // Obtener foto de perfil (no bloqueante)
        if (contact && typeof contact.getProfilePicUrl === 'function') {
            pfp = await contact.getProfilePicUrl().catch(() => pfp);
        }

        const text = msg.body?.trim() || (msg.hasMedia ? "🖼️ [Imagen/Multimedia]" : "📢 Nuevo Aviso");

        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + pushname, iconURL: pfp })
            .setDescription(text.substring(0, 4096)) // Limitar a 4096 caracteres
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (mediaData && mediaData.data) {
            try {
                const buffer = Buffer.from(mediaData.data, 'base64');
                const extension = mediaData.mimetype.split('/')[1] || 'png';
                files.push(new AttachmentBuilder(buffer, { name: `archivo.${extension}` }));
                
                // Solo setear imagen si es una imagen
                if (mediaData.mimetype.startsWith('image/')) {
                    embed.setImage(`attachment://archivo.${extension}`);
                }
            } catch (e) {
                console.log("Error procesando multimedia:", e.message);
            }
        }

        await channel.send({ embeds: [embed], files });
        console.log(`✅ Mensaje enviado a Discord en ${Date.now() - (msg.timestamp * 1000)}ms`);
        
    } catch (e) { 
        console.log("❌ Error enviando a Discord:", e.message); 
    }
}

whatsappClient.on('qr', qr => { 
    console.log("🔲 QR Code generado");
    if (updateQR) updateQR(qr); 
});

whatsappClient.on('ready', () => { 
    isWaReady = true; 
    console.log('✅ WhatsApp está conectado y listo.'); 
});

whatsappClient.on('authenticated', () => {
    console.log('🔐 WhatsApp autenticado correctamente');
});

whatsappClient.on('auth_failure', () => {
    console.log('❌ Fallo de autenticación en WhatsApp');
});

whatsappClient.on('disconnected', (reason) => {
    isWaReady = false;
    console.log('⚠️ WhatsApp desconectado:', reason);
});

// --- PROCESADOR ULTRA-RÁPIDO CON DOBLE ESCUCHA ---
// Escuchar AMBOS eventos para máxima velocidad
whatsappClient.on('message', async (msg) => {
    try {
        const chatId = msg.from;
        
        if (chatId === TARGET_CHAT_ID) {
            const autor = msg.fromMe ? "YO (Admin)" : (await msg.getContact().catch(() => ({ pushname: "Otro Admin" }))).pushname;
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📩 MENSAJE RECIBIDO (event: message)`);
            console.log(`👤 Autor: ${autor}`);
            console.log(`💬 Contenido: ${msg.body || "[Sin texto / Multimedia]"}`);
            console.log(`⏱️ Timestamp: ${new Date().toLocaleTimeString()}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

            lastMessages.push(msg);
            if (lastMessages.length > 10) lastMessages.shift();

            // Agregar a cola y procesar inmediatamente
            messageQueue.push(msg);
            processMessageQueue();
        }
    } catch (e) { 
        console.log("Error procesando mensaje (message):", e.message); 
    }
});

whatsappClient.on('message_create', async (msg) => {
    try {
        const chatId = msg.fromMe ? msg.to : msg.from;
        
        if (chatId === TARGET_CHAT_ID) {
            const autor = msg.fromMe ? "YO (Admin)" : "Otro Admin";
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📩 MENSAJE DETECTADO (event: message_create)`);
            console.log(`👤 Autor: ${autor}`);
            console.log(`💬 Contenido: ${msg.body || "[Sin texto / Multimedia]"}`);
            console.log(`⏱️ Timestamp: ${new Date().toLocaleTimeString()}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

            // Evitar duplicados: solo agregar si no está en lastMessages
            const isDuplicate = lastMessages.some(m => m.id._serialized === msg.id._serialized);
            
            if (!isDuplicate) {
                lastMessages.push(msg);
                if (lastMessages.length > 10) lastMessages.shift();

                // Agregar a cola y procesar inmediatamente
                messageQueue.push(msg);
                processMessageQueue();
            } else {
                console.log("⏭️ Mensaje duplicado detectado, omitiendo...");
            }
        }
    } catch (e) { 
        console.log("Error procesando mensaje (message_create):", e.message); 
    }
});

// --- DISCORD READY ---
discordClient.on('ready', () => {
    console.log(`✅ Discord conectado como: ${discordClient.user.tag}`);
});

// --- COMANDOS DISCORD ---
discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    
    try {
        if (i.commandName === 'configurar') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await i.reply({ 
                    content: '❌ Solo administradores pueden configurar el bot', 
                    ephemeral: true 
                });
            }

            const canal = i.options.getChannel('canal');
            bridgeConfig.discordChannelId = canal.id;
            await i.reply({
                content: `✅ Canal vinculado correctamente a <#${canal.id}>\n🔥 Los mensajes se enviarán casi instantáneamente`,
                ephemeral: true
            });
            console.log(`⚙️ Canal configurado: ${canal.name} (${canal.id})`);
        }
        
        if (i.commandName === 'status') {
            const statusEmbed = new EmbedBuilder()
                .setColor(isWaReady ? '#00ff00' : '#ff0000')
                .setTitle('📊 Estado del Bot Bridge')
                .addFields(
                    { name: '🟢 WhatsApp', value: isWaReady ? '✅ Conectado' : '❌ Desconectado', inline: true },
                    { name: '💬 Canal Discord', value: bridgeConfig.discordChannelId ? `<#${bridgeConfig.discordChannelId}>` : '❌ No configurado', inline: true },
                    { name: '📨 Mensajes en memoria', value: `${lastMessages.length}/10`, inline: true },
                    { name: '⚡ Cola de procesamiento', value: `${messageQueue.length} pendientes`, inline: true },
                    { name: '🎯 Chat objetivo', value: `\`${TARGET_CHAT_ID}\``, inline: false }
                )
                .setTimestamp();

            await i.reply({ embeds: [statusEmbed], ephemeral: true });
        }

        if (i.commandName === 'ultimo') {
            if (lastMessages.length > 0) {
                await i.deferReply({ ephemeral: true });
                const toSend = lastMessages.slice(-2);
                for (const m of toSend) {
                    await sendToDiscord(m, true);
                }
                await i.editReply("✅ Últimos 2 mensajes reenviados con marca de historial.");
            } else {
                await i.reply({ content: "❌ No hay mensajes en memoria.", ephemeral: true });
            }
        }

        if (i.commandName === 'limpiar_cola') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await i.reply({ 
                    content: '❌ Solo administradores', 
                    ephemeral: true 
                });
            }

            const count = messageQueue.length;
            messageQueue = [];
            await i.reply({ 
                content: `🗑️ Cola limpiada. ${count} mensajes eliminados.`, 
                ephemeral: true 
            });
        }

    } catch (e) { 
        console.log("Error en comando:", e.message);
        await i.reply({ content: '❌ Error ejecutando comando', ephemeral: true }).catch(() => {});
    }
});

const commands = [
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Ver estado del bot y estadísticas'),
    
    new SlashCommandBuilder()
        .setName('ultimo')
        .setDescription('Reenviar últimos 2 mensajes del historial'),
    
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Configurar canal de Discord')
        .addChannelOption(o => 
            o.setName('canal')
                .setDescription('Canal donde se enviarán los mensajes')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('limpiar_cola')
        .setDescription('Limpiar la cola de mensajes pendientes')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c => c.toJSON());

// --- INICIALIZACIÓN ---
whatsappClient.initialize().catch(e => console.log("Init Error:", e.message));
discordClient.login(DISCORD_TOKEN).catch(e => console.log("Discord Login Error:", e.message));

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => { 
    try { 
        console.log('📝 Registrando comandos slash...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos registrados correctamente');
    } catch (e) {
        console.log('❌ Error registrando comandos:', e.message);
    } 
})();

module.exports.setQRHandler = h => { updateQR = h; };

// Manejo de cierre graceful
process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando bot...');
    whatsappClient.destroy();
    discordClient.destroy();
    process.exit(0);
});
