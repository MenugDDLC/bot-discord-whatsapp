// index.js - Punto de entrada para Render.com
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Servidor web para mantener el servicio activo en Render
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp-Discord Bot</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .container {
                    text-align: center;
                    padding: 40px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                }
                h1 { font-size: 3em; margin: 0; }
                p { font-size: 1.2em; margin-top: 20px; }
                .status { 
                    display: inline-block;
                    padding: 10px 20px;
                    background: #4caf50;
                    border-radius: 20px;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖</h1>
                <h2>WhatsApp-Discord Bot</h2>
                <p>Bot funcionando correctamente</p>
                <div class="status">✅ En línea</div>
                <p style="font-size: 0.9em; opacity: 0.8; margin-top: 30px;">
                    El Club De Monika<br>
                    Conectando WhatsApp con Discord
                </p>
            </div>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.listen(port, () => {
    console.log(`📡 Servidor web activo en puerto ${port}`);
    console.log(`🌐 Health check disponible en /health`);
});

// Cargar el bot
console.log('📦 Iniciando bot WhatsApp-Discord...');
console.log('');

try {
    require('./bot.js');
} catch (error) {
    console.error('❌ Error crítico al cargar bot.js:', error);
    process.exit(1);
}

