import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import './App.css';
import { PianoRoll } from './components/PianoRoll';
import { MasterMute } from './components/MasterMute';
import { QuantizeControl } from './components/QuantizeControl';
import { Mixer } from './components/Mixer';
import { AudioEngine } from './audio/audioEngine';
import { DrumPad } from './components/DrumPad';
import { addNote, createInitialSequencerState } from './state/sequencer';
import { snapToGrid } from './utils';
import { Note, TrackId } from './types';
import axios from 'axios';

const KIT_SAMPLES = {

  haand: ['HAAND-hard.wav', 'HAAND-right.wav', 'HAAND-left.wav', 'HAAND-tap.wav'],
  bipp: ['BIPP-accent.wav', 'BIPP-right.wav', 'BIPP-left.wav', 'BIPP-tap.wav'],
  blokk: ['BLOKK-high.wav', 'BLOKK-midhigh.wav', 'BLOKK-midlow.wav', 'BLOKK-low.wav'],
  boingg: ['BOINGG-accent.wav', 'BOINGG-right.wav', 'BOINGG-left.wav', 'BOINGG-low.wav'],
  piaano: ['PIAANO-high.wav', 'PIAANO-highright.wav', 'PIAANO-lowleft.wav', 'PIAANO-low.wav'],
  pandaa: ['SYNCOR_PANDAA.wav'],
  skelaa: ['SYNCOR_SKELAA.wav'],
  thumpp: ['THUMPP-hard.wav', 'THUMPP-left.wav', 'THUMPP-right.wav', 'THUMPP-tap.wav'],
  pllluk: ['PLLLUK-high.wav', 'PLLLUK-midhigh.wav', 'PLLLUK-midlow.wav', 'PLLLUK-low.wav'],
} as const;

type KitName = keyof typeof KIT_SAMPLES;

const KIT_LABELS: Record<KitName, string> = {
  haand: 'HAAND',
  piaano: 'PIAANO',
  pandaa: 'PANDAA',
  skelaa: 'SKELAA',
  thumpp: 'THUMPP',
  pllluk: 'PLLLUK',
  bipp: 'BIPP',
  blokk: 'BLOKK',
  boingg: 'BOINGG',
};

const KIT_TRACKS = [0, 1, 2, 3] as TrackId[];

function getKitTrackFiles(kit: KitName) {
  const files = KIT_SAMPLES[kit];
  return KIT_TRACKS.map((trackId, index) => ({
    trackId,
    filename: files[index] ?? files[0],
  }));
}

function App() {
  const initialStateRef = useRef(createInitialSequencerState());
  const initialState = initialStateRef.current;
  const [notes, setNotes] = useState(initialState.notes);
  const bpm = initialState.bpm;
  const [numClients, setNumClients] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [playheadTime, setPlayheadTime] = useState(initialState.playheadTime);
  const loopLength = initialState.loopLength;
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const [selectedKit, setSelectedKit] = useState<KitName>('haand');
  const [kitLoading, setKitLoading] = useState(false);
  const kitOptions = Object.keys(KIT_SAMPLES) as KitName[];
  const [isRendering, setIsRendering] = useState(false);
  const [keepGoing, setKeepGoing] = useState(false);
  const lastPlayheadTimeRef = useRef(0);
  const loopCounterRef = useRef(0);

  const [quantizeDenom, setQuantizeDenom] = useState<number>(4); // default 1/4 note
  const [quantizeEnabled, setQuantizeEnabled] = useState<boolean>(true);

  useEffect(() => {
    const engine = new AudioEngine();
    engine.init({ onPlayheadUpdate: time => setPlayheadTime(time) });
    engine.setNotes(initialState.notes);
    engine.setTempo(initialState.bpm);
    engine.setLoopLength(initialState.loopLength);

    const ws = new WebSocket('ws://localhost:4000');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setNumClients(data.num_clients / 2); // hack unknown why backend count is doubled, maybe creates additional connection after handshake?
        if (data.type === 'server-time') {
          engine.setServerSync(data.epoch, data.timestamp);
          // Store client ID for uploads
          (window as any).clientId = data.clientId;
        } else if (data.type === 'main-loop-updated') {
          engine.loadNextMainLoop(`${data.url}?t=${data.timestamp}`);
          console.log('Received main loop update from server:', data);// hack unknown why backend count is doubled, maybe creates additional connection after handshake?
        }
      } catch (e) {
        console.error('WebSocket Error', e);
      }
    };
    engine.start(); // Start immediately and run continuously
    audioEngineRef.current = engine;

    return () => {
      ws.close();
      engine.stop();
    };
  }, [initialState]);

  useEffect(() => {
    console.log('Selected kit changed:', selectedKit);
    const engine = audioEngineRef.current;
    if (!engine) {
      return;
    }

    engine.clearSamples();
    setKitLoading(true);

    const loadPromises = getKitTrackFiles(selectedKit).map(({ trackId, filename }) => {
      const url = `/audio/native-kits/${selectedKit}/${filename}`;
      return engine.loadSample(trackId, url).catch(err => {
        console.warn(`Failed to load kit sample ${filename}:`, err);
      });
    });

    Promise.all(loadPromises)
      .then(() => {
        console.log(`${selectedKit} kit preloaded`);
      })
      .finally(() => setKitLoading(false));
  }, [selectedKit]);

  useEffect(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setNotes(notes);
    }
  }, [notes]);

  const handleToggleMute = () => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    if (isMuted) {
      engine.setMuted(false);
      setIsMuted(false);
      engine.start();
    } else {
      engine.setMuted(true);
      setIsMuted(true);
    }
  };

  const handleNotesChange = (updatedNotes: Note[]) => {
    setNotes(updatedNotes);
  }; // []

  useEffect(() => {
    if (!keepGoing || isRendering) return;

    // Check for playhead crossover (new loop)
    if (playheadTime < lastPlayheadTimeRef.current) {
      loopCounterRef.current += 1;

      // Every 2 loops, re-upload to keep alive
      if (loopCounterRef.current >= 2) {
        loopCounterRef.current = 0;
        handleRenderAndUpload();
      }
    }
    lastPlayheadTimeRef.current = playheadTime;
  }, [playheadTime, keepGoing, isRendering]);

  const handleRenderAndUpload = async () => {
    if (!audioEngineRef.current || isRendering) return;
    setIsRendering(true);
    try {
      const wavBlob = await audioEngineRef.current.renderLoop();

      const formData = new FormData();
      formData.append('loop', wavBlob, 'loop.wav');
      formData.append('clientId', (window as any).clientId || 'unknown');

      await axios.post('http://localhost:4000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      console.log('Successfully uploaded loop to backend.');
    } catch (err) {
      console.error('Failed to render/upload loop:', err);
    } finally {
      setIsRendering(false);
    }
  };

  const handlePadTrigger = (trackId: TrackId) => {
    if (!audioEngineRef.current) return;

    // Play immediately
    audioEngineRef.current.playNoteImmediate(trackId, 0.25);

    // Add to sequencer
    setNotes(prevNotes => {
      let startTime = playheadTime;
      if (quantizeEnabled) {
        startTime = snapToGrid(startTime, quantizeDenom, bpm, loopLength, true);
      }
      // if note already exists at this time for the track, replace with new note instead allowing a tolerance of 15ms after quantization
      const existing = prevNotes.find(n => n.trackId === trackId && Math.abs(n.startTime - startTime) < 0.015);
      if (existing) {
        return prevNotes.map(n => n.id === existing.id ? { ...n, startTime } : n);
      }

      return addNote(prevNotes, trackId, startTime, 2 / quantizeDenom || 0.5);
    });
  };

  const timeDisplay = playheadTime.toFixed(2);

  return (
    <div className="App">
      <div className="app-shell">
        <header className="app-header">
          <div>
            <p className="app-tag">BEATSWAARM</p>
            <p className="app-copy">Double-click to add notes, drag to resize, double-click again to delete. Load a kit of samples to sequence.</p>
          </div>
          <div className="status-panel">
            <div className="status-badge">BPM {bpm}</div>
            <div className="status-badge">{timeDisplay}</div>
            <div className="status-badge">Clients: {numClients}</div>
          </div>
          <MasterMute isMuted={isMuted} onToggleMute={handleToggleMute} />
          <button
            className="render-button"
            onClick={handleRenderAndUpload}
            disabled={isRendering}
            style={{ marginLeft: '10px', padding: '0 15px', background: '#e04f5f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {isRendering ? '.....' : 'Transmit'}
          </button>
          <div className="keep-going-control" style={{ marginLeft: '15px', display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              id="keep-going-check"
              checked={keepGoing}
              onChange={e => setKeepGoing(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="keep-going-check" style={{ marginLeft: '5px', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>RE-TRANSMIT</label>
          </div>
        </header>

        <section className="controls-row">
          <div className="piano-roll-toolbar" style={{ marginBottom: '10px' }}>
            <div className="kit-selector">
              <label htmlFor="kit-select">Kit</label>
              <select
                id="kit-select"
                value={selectedKit}
                onChange={e => setSelectedKit(e.target.value as KitName)}
              >
                {kitOptions.map(kit => (
                  <option key={kit} value={kit}>
                    {KIT_LABELS[kit]}
                  </option>
                ))}
              </select>
              <span className="kit-loading">{kitLoading ? 'Loading…' : ''}</span>
            </div>
            <QuantizeControl
              onToggle={(enabled) => setQuantizeEnabled(enabled)}
              onChangeDenom={(denom) => setQuantizeDenom(denom)}
            />
            <Mixer
              onSequencerVolumeChange={(vol) => audioEngineRef.current?.setSequencerVolume(vol)}
              onMainVolumeChange={(vol) => audioEngineRef.current?.setMainVolume(vol)}
              onM1VolumeChange={(vol) => audioEngineRef.current?.setMetror1Volume(vol)}
              onM2VolumeChange={(vol) => audioEngineRef.current?.setMetror2Volume(vol)}
            />
          </div>
        </section>

        <section className="sequencer-panel">
          <PianoRoll
            notes={notes}
            playheadTime={playheadTime}
            loopLength={loopLength}
            onNotesChange={handleNotesChange}
            bpm={bpm}
            quantizeDenom={quantizeEnabled ? quantizeDenom : 0}
          />
          <DrumPad onPadTrigger={handlePadTrigger} />
        </section>

        <footer className="app-footer">
          <p>Audio Loop Generator and Universal Time Swarm Sync</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
