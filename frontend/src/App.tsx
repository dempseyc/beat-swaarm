import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import './App.css';
import { PianoRoll } from './components/PianoRoll';
import { TransportControls } from './components/TransportControls';
import { BpmControl } from './components/BpmControl';
import { Mixer } from './components/Mixer';
import { AudioEngine } from './audio/audioEngine';
import { DrumPad } from './components/DrumPad';
import { addNote, createInitialSequencerState } from './state/sequencer';
import { snapToGrid } from './utils';
import { Note, TrackId } from './types';
import axios from 'axios';

const KIT_SAMPLES = {
  haand: ['HAAND-hard.wav', 'HAAND-left.wav', 'HAAND-right.wav', 'HAAND-tap.wav'],
  piaano: ['PIAANO-high.wav', 'PIAANO-highright.wav', 'PIAANO-low.wav', 'PIAANO-lowleft.wav'],
  pandaa: ['SYNCOR_PANDAA.wav'],
  skelaa: ['SYNCOR_SKELAA.wav'],
  thumpp: ['THUMPP-hard.wav', 'THUMPP-left.wav', 'THUMPP-right.wav', 'THUMPP-tap.wav'],
} as const;

type KitName = keyof typeof KIT_SAMPLES;

const KIT_LABELS: Record<KitName, string> = {
  haand: 'HAAND',
  piaano: 'PIAANO',
  pandaa: 'PANDAA',
  skelaa: 'SKELAA',
  thumpp: 'THUMPP',
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
  const [isMuted, setIsMuted] = useState(false);
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

  const [quantizeDenom, setQuantizeDenom] = useState<number>(4); // default 1/4
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
        if (data.type === 'server-time') {
          engine.setServerSync(data.epoch, data.timestamp);
          // Store client ID for uploads
          (window as any).clientId = data.clientId;
        } else if (data.type === 'main-loop-updated') {
          engine.loadNextMainLoop(`${data.url}?t=${data.timestamp}`);
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
    } else {
      engine.setMuted(true);
      setIsMuted(true);
    }
  };

  const handleNotesChange = (updatedNotes: Note[]) => {
    setNotes(updatedNotes);
  };

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
        startTime = snapToGrid(startTime, quantizeDenom, bpm, loopLength, false);
      }
      return addNote(prevNotes, trackId, startTime, 0.25);
    });
  };

  const timeDisplay = playheadTime.toFixed(2);

  return (
    <div className="App">
      <div className="app-shell">
        <header className="app-header">
          <div>
            <p className="app-tag">BEATSWAARM</p>
            <h1>Piano Roll Sequencer</h1>
            <p className="app-copy">Double-click to add notes, drag to resize, double-click again to delete. Load a kit of samples to sequence.</p>
          </div>
          <div className="status-panel">
            <div className="status-badge">BPM {bpm}</div>
            <div className="status-badge">Time {timeDisplay}s / {loopLength.toFixed(2)}s</div>
          </div>
        </header>

        <section className="controls-row">
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
          <BpmControl bpm={bpm} />
          <TransportControls isMuted={isMuted} onToggleMute={handleToggleMute} />
          <button
            className="render-button"
            onClick={handleRenderAndUpload}
            disabled={isRendering}
            style={{ marginLeft: '10px', padding: '0 15px', background: '#e04f5f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {isRendering ? 'Rendering...' : 'Render & Upload'}
          </button>
          <div className="keep-going-control" style={{ marginLeft: '15px', display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              id="keep-going-check"
              checked={keepGoing}
              onChange={e => setKeepGoing(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="keep-going-check" style={{ marginLeft: '5px', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>Keep Going</label>
          </div>
        </section>

        <section className="sequencer-panel">
          <div className="piano-roll-toolbar" style={{ marginBottom: '10px' }}>
            <label htmlFor="quantize-enable" style={{ color: '#fff', fontSize: '0.8rem', marginRight: '5px' }}>
              <input
                type="checkbox"
                id="quantize-enable"
                checked={quantizeEnabled}
                onChange={e => setQuantizeEnabled(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Quantize
            </label>
            <select
              id="quantize-select"
              value={quantizeDenom}
              onChange={e => setQuantizeDenom(Number(e.target.value))}
              disabled={!quantizeEnabled}
            >
              <option value={48}>1/48</option>
              <option value={32}>1/32</option>
              <option value={24}>1/24 (triplet)</option>
              <option value={16}>1/16</option>
              <option value={12}>1/12 (triplet)</option>
              <option value={8}>1/8</option>
              <option value={6}>1/6 (triplet)</option>
              <option value={4}>1/4</option>
              <option value={3}>1/3 (triplet)</option>
              <option value={2}>1/2</option>
              <option value={1}>Whole</option>
            </select>
          </div>
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

        <Mixer
          onSequencerVolumeChange={(vol) => audioEngineRef.current?.setSequencerVolume(vol)}
          onMainVolumeChange={(vol) => audioEngineRef.current?.setMainVolume(vol)}
          onM1VolumeChange={(vol) => audioEngineRef.current?.setMetror1Volume(vol)}
          onM2VolumeChange={(vol) => audioEngineRef.current?.setMetror2Volume(vol)}
        />

        <footer className="app-footer">
          <p>Piano roll sequencer with sample kit loading and time-based note scheduling ready for swarm sync.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
