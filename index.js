const express = require('express');
const app = express();
// Koyeb inyecta la variable PORT automáticamente
const port = process.env.PORT || 8080; 

app.get('/', (req, res) => {
    res.send('<h1>🤖 Bot Bridge Monika - Koyeb</h1><p>Estado: Activo</p>');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', platform: 'koyeb' });
});

app.listen(port, "0.0.0.0", () => {
    console.log(`📡 Servidor en línea en puerto ${port}`);
    require('./bot.js');
});
