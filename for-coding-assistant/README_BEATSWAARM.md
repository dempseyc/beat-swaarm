Project: BEATSWAARM

Client:
- Browser sequencer
- Creates loops
- Renders WAV
- Uploads WAV

Conductor:
- Receives WAVs
- Mixes WAVs
- Broadcasts master WAV

Design goals:
- Simplicity
- Demonstration project
- Artistic collaboration

Non-goals:
- WebRTC
- DAW features
- Distributed synchronization
- CRDTs

## Architecture

### Frontend
- React
- Web Audio API
- Tone.js initially

Responsibilities:
- local sequencer
- playback
- recording/rendering loop snapshots
- websocket communication
- global phase calculation

### Backend
- Node.js
- Express
- websocket server
- ffmpeg for normalization

Responsibilities:
- maintain global transport state
- accept uploaded loops
- normalize audio
- maintain active swarm mix
- schedule loop fade-ins and fade-outs

## Global Timing

Example:
- BPM = 120
- Loop Length = 8 seconds
- Global Start = UNIX timestamp

Clients compute:

phase = (currentTime - globalStart) % loopLength

This allows all devices to independently determine:
- current beat
- current bar
- next downbeat
- quantization points

## Loop Contribution Flow

1. User edits local sequencer
2. User presses "Commit to Swarm"
3. Client renders one exact loop cycle
4. Loop exported as WAV/OGG
5. Upload to backend
6. Backend schedules loop into next global cycle
7. Loop fades into swarm mix

## Persistence / Ghost Loops

If a user disconnects:
- old loops remain temporarily
- server rotates historical variations
- loops slowly fade over time

The swarm retains memory.

## Initial Milestones

### Phase 1
Single-user browser sequencer:
- 16-step grid
- 4 drum sounds
- local playback
- BPM control

### Phase 2
Offline loop rendering:
- render exact loop
- export audio blob

### Phase 3
Backend upload:
- websocket/API communication
- loop storage
- normalization

### Phase 4
Global synchronization:
- shared transport clock
- aligned fade-ins

### Phase 5
Continuous swarm mix:
- multiple simultaneous contributors
- fading and rotation logic

## Design Philosophy

Simple local actions.
Large emergent collective behavior.

The user should feel:
"I added four notes and became part of a living planetary rhythm."
