const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('<h1>🤖 Bot Bridge Activo en Railway</h1><p>Conexión WhatsApp-Discord funcionando.</p>');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.listen(port, () => {
    console.log(`📡 Servidor escuchando en puerto ${port}`);
    require('./bot.js');
});
