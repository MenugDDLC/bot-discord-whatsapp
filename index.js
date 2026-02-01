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
                    <div style="background:white; padding:20px; display:inline-block; border-radius:10px;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(latestQR)}&size=300x300" />
                    </div>
                    <p>Abre WhatsApp y vincula el dispositivo</p>
                    <script>setTimeout(() => location.reload(), 10000);</script>
                </body>
            </html>
        `);
    } else {
        res.send(`
            <html>
                <body style="background:#1a1a2e; color:white; text-align:center; font-family:sans-serif; padding-top:50px;">
                    <h1>🤖 Bot Bridge Activo</h1>
                    <p>Esperando QR o ya conectado...</p>
                    <script>setTimeout(() => location.reload(), 5000);</script>
                </body>
            </html>
        `);
    }
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.listen(port, "0.0.0.0", () => {
    console.log(`📡 Servidor Express en puerto ${port}`);
    
    // Importamos el bot después de que el servidor inicie
    const bot = require('./bot.js');
    
    // Le pasamos la función al bot para que actualice 'latestQR' aquí
    bot.setQRHandler((qr) => { 
        latestQR = qr; 
    });
});
