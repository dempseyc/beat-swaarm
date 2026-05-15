# BEATSWAARM Frontend

Piano roll sequencer with sample-based drum machine sequencing using the Web Audio API.

## Piano Roll Sequencer

The sequencer provides a time-based note editor with 4 drum tracks:

- **Add notes**: Double-click on a track row to add a note at that position
- **Move notes**: Click and drag a note to move it along the timeline
- **Resize notes**: Drag the left (start) or right (end) edge to adjust duration
- **Delete notes**: Double-click a note to delete it
- **Playhead**: Red line shows real-time playback position

## Architecture

### Audio Engine (`src/audio/audioEngine.ts`)
- Web Audio API context management
- Sample buffer loading from URLs
- Time-based note scheduling with lookahead
- Accurate playhead tracking

### Components
- `PianoRoll.tsx` — Main piano roll UI with note editing
- `BpmControl.tsx` — BPM slider
- `TransportControls.tsx` — Play/Pause button

### State Management (`src/state/sequencer.ts`)
- Note data structure (id, trackId, startTime, duration)
- Note CRUD operations
- Loop state

## Getting Started

```bash
npm install
npm start
```

Opens [http://localhost:3000](http://localhost:3000) in development mode.

## Sample Loading

To load custom drum samples, update App.tsx to call:

```typescript
await audioEngine.loadSample(0, '/path/to/kick.wav');
await audioEngine.loadSample(1, '/path/to/snare.wav');
// etc.
```

## Development

```bash
npm start      # Development server with hot reload
npm run build  # Production build
npm test       # Run tests
```

## Notes

- Tone.js is installed but not currently used; the sequencer uses the Web Audio API directly
- Loop length is calculated from BPM (16 beats @ 120 BPM = 8 seconds)
- Notes are stored as absolute time values within the loop
- Audio timing is stable and does not rely on setInterval
