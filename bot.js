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

async function sendToDiscord(msg, isHistory = false) {
    if (!bridgeConfig.discordChannelId) {
        console.log("⚠️ No hay canal configurado");
        return;
    }
    try {
        const channel = await discordClient.channels.fetch(bridgeConfig.discordChannelId).catch(() => null);
        if (!channel) {
            console.log("⚠️ Canal no encontrado");
            return;
        }
        
        const contact = await msg.getContact().catch(() => null);
        let pushname = msg.fromMe ? "Tú (Admin)" : (contact?.pushname || "Admin de la Comunidad");
        let pfp = 'https://i.imgur.com/83p7ihD.png';

        if (contact && typeof contact.getProfilePicUrl === 'function') {
            pfp = await contact.getProfilePicUrl().catch(() => pfp);
        }

        const text = msg.body?.trim() || (msg.hasMedia ? "🖼️ [Imagen/Multimedia]" : "📢 Nuevo Aviso");

        const embed = new EmbedBuilder()
            .setColor(isHistory ? '#5865F2' : '#fb92b3')
            .setAuthor({ name: (isHistory ? "[HISTORIAL] " : "📢 ") + pushname, iconURL: pfp })
            .setDescription(text.substring(0, 4096))
            .setTimestamp(new Date(msg.timestamp * 1000));

        let files = [];
        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media && media.data) {
                    const buffer = Buffer.from(media.data, 'base64');
                    const extension = media.mimetype.split('/')[1] || 'png';
                    files.push(new AttachmentBuilder(buffer, { name: `archivo.${extension}` }));
                    if (media.mimetype.startsWith('image/')) {
                        embed.setImage(`attachment://archivo.${extension}`);
                    }
                }
            } catch (e) {
                console.log("Error con multimedia:", e.message);
            }
        }

        await channel.send({ embeds: [embed], files });
        console.log(`✅ Mensaje enviado a Discord`);
    } catch (e) { 
        console.log("❌ Error enviando a Discord:", e.message); 
    }
}

whatsappClient.on('qr', qr => { 
    console.log("🔲 QR Code generado");
    if (updateQR) updateQR(qr); 
});

whatsappClient.on('ready', async () => { 
    isWaReady = true; 
    console.log('✅ WhatsApp conectado y listo');
    
    // Verificar que el chat existe
    try {
        const chat = await whatsappClient.getChatById(TARGET_CHAT_ID);
        console.log(`✅ Chat objetivo encontrado: ${chat.name}`);
    } catch (e) {
        console.log(`❌ ERROR: No se pudo encontrar el chat ${TARGET_CHAT_ID}`);
        console.log('Usa /listar_chats en Discord para ver los IDs disponibles');
    }
});

whatsappClient.on('authenticated', () => {
    console.log('🔐 WhatsApp autenticado');
});

whatsappClient.on('auth_failure', () => {
    console.log('❌ Fallo de autenticación en WhatsApp');
});

whatsappClient.on('disconnected', (reason) => {
    isWaReady = false;
    console.log('⚠️ WhatsApp desconectado:', reason);
});

// EVENTO PRINCIPAL - ESCUCHA TODOS LOS MENSAJES
whatsappClient.on('message_create', async (msg) => {
    console.log('\n🔍 MENSAJE DETECTADO');
    console.log('De:', msg.from);
    console.log('Para:', msg.to);
    console.log('Chat ID calculado:', msg.fromMe ? msg.to : msg.from);
    console.log('TARGET_CHAT_ID:', TARGET_CHAT_ID);
    console.log('¿Coincide?:', (msg.fromMe ? msg.to : msg.from) === TARGET_CHAT_ID);
    
    try {
        const chatId = msg.fromMe ? msg.to : msg.from;
        
        if (chatId === TARGET_CHAT_ID) {
            const autor = msg.fromMe ? "YO (Admin)" : "Otro Admin";
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`✅ MATCH ENCONTRADO!`);
            console.log(`👤 Autor: ${autor}`);
            console.log(`💬 Contenido: ${msg.body || "[Sin texto / Multimedia]"}`);
            console.log(`⏱️ Timestamp: ${new Date().toLocaleTimeString()}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

            lastMessages.push(msg);
            if (lastMessages.length > 10) lastMessages.shift();

            await sendToDiscord(msg);
        } else {
            console.log('❌ No coincide con el chat objetivo\n');
        }
    } catch (e) { 
        console.log("❌ Error procesando mensaje:", e.message); 
    }
});

discordClient.on('ready', () => {
    console.log(`✅ Discord conectado como: ${discordClient.user.tag}`);
});

discordClient.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    try {
        if (i.commandName === 'configurar') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await i.reply({ 
                    content: '❌ Solo administradores', 
                    ephemeral: true 
                });
            }
            const canal = i.options.getChannel('canal');
            bridgeConfig.discordChannelId = canal.id;
            await i.reply({
                content: `✅ Canal configurado: <#${canal.id}>`,
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
                await i.editReply("✅ Últimos 2 reenviados");
            } else {
                await i.reply({ content: "❌ No hay mensajes en memoria", ephemeral: true });
            }
        }

        if (i.commandName === 'listar_chats') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await i.reply({ 
                    content: '❌ Solo administradores', 
                    ephemeral: true 
                });
            }

            if (!isWaReady) {
                return await i.reply({ 
                    content: '❌ WhatsApp no está conectado', 
                    ephemeral: true 
                });
            }

            await i.deferReply({ ephemeral: true });

            try {
                const chats = await whatsappClient.getChats();
                const grupos = chats.filter(chat => chat.isGroup);
                
                if (grupos.length === 0) {
                    return await i.editReply('No hay grupos disponibles');
                }

                const embeds = [];
                let currentEmbed = new EmbedBuilder()
                    .setColor('#25D366')
                    .setTitle('📱 Grupos de WhatsApp')
                    .setDescription('Copia el ID del grupo correcto:')
                    .setFooter({ text: `Total: ${grupos.length} grupos` });
                
                for (let j = 0; j < grupos.length && j < 25; j++) {
                    const grupo = grupos[j];
                    const esObjetivo = grupo.id._serialized === TARGET_CHAT_ID ? '🎯 ' : '';
                    currentEmbed.addFields({
                        name: `${esObjetivo}📢 ${grupo.name}`,
                        value: `**ID:** \`${grupo.id._serialized}\`\n**Participantes:** ${grupo.participants?.length || 'N/A'}`,
                        inline: false
                    });
                }
                
                embeds.push(currentEmbed);

                if (grupos.length > 25) {
                    for (let i = 25; i < grupos.length; i += 25) {
                        const extraEmbed = new EmbedBuilder()
                            .setColor('#25D366')
                            .setTitle('📱 Grupos (continuación)');
                        
                        const endIndex = Math.min(i + 25, grupos.length);
                        for (let j = i; j < endIndex; j++) {
                            const grupo = grupos[j];
                            const esObjetivo = grupo.id._serialized === TARGET_CHAT_ID ? '🎯 ' : '';
                            extraEmbed.addFields({
                                name: `${esObjetivo}📢 ${grupo.name}`,
                                value: `**ID:** \`${grupo.id._serialized}\``,
                                inline: false
                            });
                        }
                        embeds.push(extraEmbed);
                    }
                }

                await i.editReply({ embeds });
                console.log(`Lista de ${grupos.length} chats solicitada`);
                
            } catch (e) {
                console.log(`Error listando chats: ${e.message}`);
                await i.editReply('❌ Error obteniendo chats');
            }
        }

        if (i.commandName === 'test_mensaje') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await i.reply({ 
                    content: '❌ Solo administradores', 
                    ephemeral: true 
                });
            }

            if (!isWaReady) {
                return await i.reply({ 
                    content: '❌ WhatsApp no conectado', 
                    ephemeral: true 
                });
            }

            try {
                await i.deferReply({ ephemeral: true });
                const chat = await whatsappClient.getChatById(TARGET_CHAT_ID);
                await chat.sendMessage('🧪 Test desde el bot - ignorar');
                await i.editReply('✅ Mensaje de prueba enviado al grupo de WhatsApp');
            } catch (e) {
                await i.editReply(`❌ Error: ${e.message}`);
            }
        }

    } catch (e) { 
        console.log("Error en comando:", e.message);
        await i.reply({ content: '❌ Error ejecutando comando', ephemeral: true }).catch(() => {});
    }
});

const commands = [
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Ver estado del bot'),
    new SlashCommandBuilder()
        .setName('ultimo')
        .setDescription('Reenviar últimos 2 mensajes'),
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Configurar canal de Discord')
        .addChannelOption(o => 
            o.setName('canal')
                .setDescription('Canal destino')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('listar_chats')
        .setDescription('Ver todos los grupos de WhatsApp con sus IDs')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('test_mensaje')
        .setDescription('Enviar mensaje de prueba al grupo de WhatsApp')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c => c.toJSON());

whatsappClient.initialize().catch(e => console.log("Init Error:", e.message));
discordClient.login(DISCORD_TOKEN).catch(e => console.log("Discord Login Error:", e.message));

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => { 
    try { 
        console.log('📝 Registrando comandos...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos registrados');
    } catch (e) {
        console.log('❌ Error registrando comandos:', e.message);
    } 
})();

module.exports.setQRHandler = h => { updateQR = h; };

process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando bot...');
    whatsappClient.destroy();
    discordClient.destroy();
    process.exit(0);
});
