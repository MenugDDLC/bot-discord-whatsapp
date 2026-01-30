const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// Variable global para guardar el QR actual
let latestQR = null;

app.get('/', (req, res) => {
    if (latestQR) {
        res.send(`
            <html>
                <body style="background:#1a1a2e; color:white; text-align:center; font-family:sans-serif;">
                    <h1>📱 Escanea el QR</h1>
                    <p>Abre WhatsApp > Dispositivos vinculados > Vincular dispositivo</p>
                    <div style="background:white; padding:20px; display:inline-block; border-radius:10px;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(latestQR)}&size=300x300" />
                    </div>
                    <p style="margin-top:20px; color:#e94560;">El QR se actualiza automáticamente</p>
                </body>
            </html>
        `);
    } else {
        res.send(`
            <html>
                <body style="background:#1a1a2e; color:white; text-align:center; font-family:sans-serif; padding-top:50px;">
                    <h1>🤖 Bot Bridge Activo</h1>
                    <p>Esperando a que WhatsApp genere el código QR...</p>
                    <script>setTimeout(() => location.reload(), 5000);</script>
                </body>
            </html>
        `);
    }
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.listen(port, "0.0.0.0", () => {
    console.log(`📡 Servidor en puerto ${port}`);
    // Pasar la función para actualizar el QR al bot
    const bot = require('./bot.js');
    bot.setQRHandler((qr) => { latestQR = qr; });
});
