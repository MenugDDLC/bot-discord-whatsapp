// index.js - Punto de entrada optimizado para Render.com
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

/**
 * SERVIDOR WEB PARA MANTENER EL BOT VIVO
 * Render requiere que una aplicación web responda a peticiones HTTP.
 */

// Página principal (Interfaz visual simple)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bot Bridge - El Club De Monika</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: #1a1a2e;
                    color: white;
                }
                .card {
                    text-align: center;
                    padding: 2rem;
                    background: #16213e;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    border: 1px solid #0f3460;
                }
                .status-online {
                    color: #4ef037;
                    font-weight: bold;
                    padding: 5px 15px;
                    border: 1px solid #4ef037;
                    border-radius: 20px;
                    display: inline-block;
                    margin-top: 10px;
                }
                h1 { margin: 0; color: #e94560; }
                p { opacity: 0.8; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🤖 Bot Bridge Activo</h1>
                <p>WhatsApp &harr; Discord</p>
                <div class="status-online">● SISTEMA EN LÍNEA</div>
                <p style="font-size: 0.8em; margin-top: 20px;">
                    Usa <code>/health</code> para monitoreo externo.
                </p>
            </div>
        </body>
        </html>
    `);
});

// Ruta de Salud (Health Check)
// Configura UptimeRobot para que visite esta URL cada 5 minutos
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        uptime: Math.floor(process.uptime()) + "s",
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage().heapUsed / 1024 / 1024 + " MB"
    });
});

// Iniciar el servidor Express
app.listen(port, () => {
    console.log('-------------------------------------------');
    console.log(`📡 Servidor Web escuchando en puerto ${port}`);
    console.log(`🌐 URL de Salud: http://localhost:${port}/health`);
    console.log('-------------------------------------------');

    // Cargar la lógica del bot una vez que el servidor web está listo
    try {
        console.log('📦 Cargando bot.js...');
        require('./bot.js');
    } catch (error) {
        console.error('❌ Error crítico al cargar bot.js:', error.message);
    }
});
