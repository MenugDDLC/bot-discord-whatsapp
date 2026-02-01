const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

let latestQR = null;

app.get('/', (req, res) => {
    if (latestQR) {
        res.send(`
            <html>
                <body style="background:#1a1a2e; color:white; text-align:center; font-family:sans-serif; padding-top:50px;">
                    <h1>📱 Escanea el QR</h1>
                    <div style="background:white; padding:20px; display:inline-block; border-radius:10px; margin:20px;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(latestQR)}&size=300x300" />
                    </div>
                    <p>Abre WhatsApp > Dispositivos vinculados</p>
                    <script>setTimeout(() => location.reload(), 15000);</script>
                </body>
            </html>
        `);
    } else {
        res.send(`
            <html>
                <body style="background:#1a1a2e; color:white; text-align:center; font-family:sans-serif; padding-top:50px;">
                    <h1>🤖 Bot Bridge Activo</h1>
                    <p>WhatsApp está conectado o el QR se está generando...</p>
                    <script>setTimeout(() => location.reload(), 5000);</script>
                </body>
            </html>
        `);
    }
});

app.listen(port, "0.0.0.0", () => {
    console.log(`📡 Servidor Express en puerto ${port}`);
    const bot = require('./bot.js');
    // Vinculamos el bot con el servidor web
    bot.setQRHandler((qr) => { 
        latestQR = qr; 
    });
});
