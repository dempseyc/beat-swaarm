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

// Setup directories
const tmpDir = path.join(__dirname, 'tmp');
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

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

// Serve public directory (where main.wav will live)
app.use('/public', express.static(publicDir));
app.use(express.json());

// CORS configuration - allow frontend to access
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
app.post('/upload', upload.single('loop'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    console.log(`Received loop: ${req.file.filename}`);

    // Trigger ffmpeg mix
    mixMainLoop();

    res.json({ success: true, filename: req.file.filename });
});

function mixMainLoop() {
    fs.readdir(tmpDir, (err, files) => {
        if (err) {
            console.error('Error reading tmp dir', err);
            return;
        }

        const wavFiles = files.filter(f => f.endsWith('.wav'));
        if (wavFiles.length === 0) return;

        const mainWavPath = path.join(publicDir, 'main.wav');

        // If there's only one file, just copy it to avoid ffmpeg complex filter errors on 1 input
        if (wavFiles.length === 1) {
            fs.copyFile(path.join(tmpDir, wavFiles[0]), mainWavPath, (err) => {
                if (err) console.error('Error copying to main.wav', err);
                else broadcastNewMain();
            });
            return;
        }

        // Build ffmpeg command using amix
        // ffmpeg -i a.wav -i b.wav -filter_complex amix=inputs=2:duration=longest -y main.wav
        const inputs = wavFiles.map(f => `-i "${path.join(tmpDir, f)}"`).join(' ');
        const ffmpegCmd = `ffmpeg ${inputs} -filter_complex amix=inputs=${wavFiles.length}:duration=longest -y "${mainWavPath}"`;

        console.log(`Mixing ${wavFiles.length} loops...`);
        exec(ffmpegCmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`ffmpeg error: ${error.message}`);
                return;
            }
            console.log('Successfully mixed main.wav');
            broadcastNewMain();
        });
    });
}

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
    ws.send(JSON.stringify({ type: 'server-time', timestamp: Date.now(), epoch: START_TIME }));

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
