const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 4000;

app.use(express.json());
app.get('/', (req, res) => {
    res.send('BEATSWAARM backend is running.');
});

wss.on('connection', ws => {
    ws.send(JSON.stringify({ type: 'server-time', timestamp: Date.now() }));

    ws.on('message', message => {
        let payload;
        try {
            payload = JSON.parse(message.toString());
        } catch (error) {
            console.warn('Invalid websocket message received');
            return;
        }

        if (payload.type === 'upload-loop') {
            const broadcast = JSON.stringify({
                type: 'loop-uploaded',
                loopId: payload.loopId,
                timestamp: Date.now(),
                meta: payload.meta || {},
            });

            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(broadcast);
                }
            });
        }
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`BEATSWAARM backend listening on http://localhost:${PORT}`);
});
