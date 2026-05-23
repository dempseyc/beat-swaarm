const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 4000;
const START_TIME = Date.now(); // Global sync epoch
const LOOP_DURATION = 4000; // 4 seconds in ms

// State management for client loops
const clientLoops = new Map(); // clientId -> { filename, birthday, lastUpdate }

// Setup directories and clear temp files on startup
const tmpDir = path.join(__dirname, 'tmp');
const publicDir = path.join(__dirname, 'public');

if (fs.existsSync(tmpDir)) {
    // Clean temp directory on startup
    const files = fs.readdirSync(tmpDir);
    for (const file of files) {
        if (file.endsWith('.wav')) {
            fs.unlinkSync(path.join(tmpDir, file));
        }
    }
} else {
    fs.mkdirSync(tmpDir, { recursive: true });
}

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

// Reset main.wav on startup
const mainWavPath = path.join(publicDir, 'main.wav');
if (fs.existsSync(mainWavPath)) {
    fs.unlinkSync(mainWavPath);
}
fs.writeFileSync(mainWavPath, ''); // Empty file placeholder


// CORS configuration - allow frontend to access
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Serve public directory (where main.wav will live)
app.use('/public', express.static(publicDir));
app.use(express.json());

// Setup multer for loop uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tmpDir);
    },
    filename: (req, file, cb) => {
        const id = crypto.randomBytes(8).toString('hex');
        cb(null, `${id}.wav`);
    }
});
const upload = multer({ storage });

app.post('/upload', upload.single('loop'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const clientId = req.body.clientId || 'anonymous';
    console.log(`Received loop from ${clientId}: ${req.file.filename}`);

    // If client already has a loop, we might want to delete the old file
    if (clientLoops.has(clientId)) {
        const oldLoop = clientLoops.get(clientId);
        try {
            fs.unlinkSync(path.join(tmpDir, oldLoop.filename));
        } catch (e) {
            console.warn(`Could not delete old loop for ${clientId}`);
        }
    }

    // Register/Update client loop
    clientLoops.set(clientId, {
        filename: req.file.filename,
        birthday: Date.now(),
        lastUpdate: Date.now()
    });

    // Trigger ffmpeg mix
    mixMainLoop();

    res.json({ success: true, filename: req.file.filename });
});

function getClientVolume(clientId) {
    const loop = clientLoops.get(clientId);
    if (!loop) return 0;

    const now = Date.now();
    const age = now - loop.lastUpdate;
    const epochCount = age / LOOP_DURATION;

    if (epochCount <= 2) return 1.0;
    if (epochCount >= 6) return 0;

    // Linear fade from 1.0 to 0.0 between epoch 2 and 6
    // volume = 1.0 - (current_epoch - start_fade_epoch) / fade_duration_epochs
    const volume = 1.0 - (epochCount - 2) / (6 - 2);
    return Math.max(0, volume);
}

function mixMainLoop() {
    const now = Date.now();

    // Cleanup expired loops before mixing
    for (const [clientId, loop] of clientLoops.entries()) {
        const age = now - loop.lastUpdate;
        if (age >= 6 * LOOP_DURATION) {
            console.log(`Fading out and removing expired loop from ${clientId}`);
            try {
                fs.unlinkSync(path.join(tmpDir, loop.filename));
            } catch (e) { }
            clientLoops.delete(clientId);
        }
    }

    const wavFiles = Array.from(clientLoops.entries()).map(([clientId, loop]) => ({
        clientId,
        filename: loop.filename,
        volume: getClientVolume(clientId)
    })).filter(item => item.volume > 0);

    if (wavFiles.length === 0) {
        // Reset main.wav to empty if no active loops
        fs.writeFileSync(mainWavPath, '');
        broadcastNewMain();
        return;
    }

    // If only one active loop with full volume, just copy
    if (wavFiles.length === 1 && wavFiles[0].volume === 1) {
        fs.copyFile(path.join(tmpDir, wavFiles[0].filename), mainWavPath, (err) => {
            if (err) console.error('Error copying to main.wav', err);
            else broadcastNewMain();
        });
        return;
    }

    const inputs = wavFiles.map(item => `-i "${path.join(tmpDir, item.filename)}"`).join(' ');

    // Build filter string with individual volumes
    // [0:a]volume=1.0[a0]; [1:a]volume=0.5[a1]; [a0][a1]amix=inputs=2...
    let filterStr = '';
    wavFiles.forEach((item, i) => {
        filterStr += `[${i}:a]volume=${item.volume.toFixed(2)}[v${i}]; `;
    });
    const inputLabels = wavFiles.map((_, i) => `[v${i}]`).join('');

    const scaleFactor = Math.pow(wavFiles.length, 0.6);
    filterStr += `${inputLabels}amix=inputs=${wavFiles.length}:duration=longest[mixed];[mixed]volume=${scaleFactor}[louder];[louder]alimiter=limit=0.95[out]`;

    const ffmpegCmd = `ffmpeg ${inputs} -filter_complex "${filterStr}" -map "[out]" -y "${mainWavPath}"`;

    console.log(`Mixing ${wavFiles.length} loops with additive gain factor ${scaleFactor.toFixed(2)}...`);
    exec(ffmpegCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`ffmpeg error: ${error.message}`);
            return;
        }
        console.log('Successfully mixed main.wav');
        broadcastNewMain();
    });
};

function broadcastNewMain() {
    const broadcast = JSON.stringify({
        type: 'main-loop-updated',
        timestamp: Date.now(),
        url: `http://localhost:${PORT}/public/main.wav`
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(broadcast);
        }
    });
}

wss.on('connection', ws => {
    const clientId = crypto.randomBytes(8).toString('hex');
    ws.send(JSON.stringify({
        type: 'server-time',
        timestamp: Date.now(),
        epoch: START_TIME,
        clientId: clientId
    }));

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

// Periodic re-mix to handle fades
setInterval(() => {
    if (clientLoops.size > 0) {
        mixMainLoop();
    }
}, LOOP_DURATION);

server.listen(PORT, () => {
    console.log(`BEATSWAARM backend listening on http://localhost:${PORT}`);
});
