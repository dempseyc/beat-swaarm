# BEATSWAARM

BEATSWAARM is a browser-based distributed rhythm ecosystem focused on local drum sequencing and future swarm synchronization.

## Frontend

The frontend is a React + TypeScript app with a piano roll sequencer that provides:
- Piano roll interface for sample-based sequencing
- 4 drum tracks (loads custom samples from a kit folder)
- Time-based note editing with precise scheduling
- BPM control
- Play/pause transport
- Moving playhead with audio synchronization

### Piano Roll Interface

- **Add notes**: Double-click on a track to add a note at that time
- **Resize notes**: Drag the left or right edge of a note to adjust start/end time
- **Delete notes**: Double-click a note to delete it
- **Drag notes**: Click and drag a note to move it along the timeline

### Run frontend

```bash
cd frontend
npm install
npm start
```

## Backend

The backend is a lightweight Node.js Express server with a WebSocket endpoint for future loop upload orchestration.

### Run backend

```bash
cd backend
npm install
npm start
```

## Sample Kit Loading

To load a custom sample kit:

1. Create a folder with 4 audio files (WAV, MP3, or other supported formats)
2. Update the frontend code to load samples from the folder via URLs
3. The sequencer will then play those samples when notes are triggered

Example sample loading (in future development):
```typescript
await audioEngine.loadSample(0, '/samples/kick.wav');
await audioEngine.loadSample(1, '/samples/snare.wav');
await audioEngine.loadSample(2, '/samples/hihat.wav');
await audioEngine.loadSample(3, '/samples/clap.wav');
```

## Architecture

- `frontend/src/components/PianoRoll.tsx` — Main sequencer UI with note editing
- `frontend/src/audio/audioEngine.ts` — Web Audio API engine with time-based scheduling
- `frontend/src/state/sequencer.ts` — State management for notes and loop control
- `backend/server.js` — Express server with WebSocket support

## Project structure

- `frontend/` — React application with piano roll sequencer
- `backend/` — Express + WebSocket server
- `.github/copilot-instructions.md` — workspace task guidance
