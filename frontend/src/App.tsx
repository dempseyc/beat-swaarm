import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import './App.css';
import { PianoRoll } from './components/PianoRoll';
import { TransportControls } from './components/TransportControls';
import { BpmControl } from './components/BpmControl';
import { Mixer } from './components/Mixer';
import { AudioEngine } from './audio/audioEngine';
import { createInitialSequencerState } from './state/sequencer';
import { Note, TrackId } from './types';
import axios from 'axios';

const KIT_SAMPLES = {
  haand: ['HAAND-hard.wav', 'HAAND-left.wav', 'HAAND-right.wav', 'HAAND-tap.wav'],
  piaano: ['PIAANO-high.wav', 'PIAANO-highright.wav', 'PIAANO-low.wav', 'PIAANO-lowleft.wav'],
  pandaa: ['SYNCOR_PANDAA.wav'],
  skelaa: ['SYNCOR_SKELAA.wav'],
  thumpp: ['THUMPP.wav'],
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
  const [bpm, setBpm] = useState(initialState.bpm);
  const [isPlaying, setIsPlaying] = useState(initialState.isPlaying);
  const [playheadTime, setPlayheadTime] = useState(initialState.playheadTime);
  const loopLength = initialState.loopLength;
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const [selectedKit, setSelectedKit] = useState<KitName>('haand');
  const [kitLoading, setKitLoading] = useState(false);
  const kitOptions = Object.keys(KIT_SAMPLES) as KitName[];
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    const engine = new AudioEngine();
    engine.init({ onPlayheadUpdate: time => setPlayheadTime(time) });
    engine.setNotes(initialState.notes);
    engine.setTempo(initialState.bpm);
    engine.setLoopLength(initialState.loopLength);
    audioEngineRef.current = engine;

    return () => {
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

  useEffect(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setTempo(bpm);
    }
  }, [bpm]);

  const handleTogglePlay = () => {
    const engine = audioEngineRef.current;
    if (!engine || kitLoading) {
      return;
    }
    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
      setPlayheadTime(0);
      return;
    }
    engine.start();
    setIsPlaying(true);
  };

  const handleChangeBpm = (value: number) => {
    setBpm(value);
  };

  const handleNotesChange = (updatedNotes: Note[]) => {
    setNotes(updatedNotes);
  };

  const handleRenderAndUpload = async () => {
    if (!audioEngineRef.current) return;
    setIsRendering(true);
    try {
      const wavBlob = await audioEngineRef.current.renderLoop();

      const formData = new FormData();
      formData.append('loop', wavBlob, 'loop.wav');

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
          <BpmControl bpm={bpm} onChangeBpm={handleChangeBpm} />
          <TransportControls isPlaying={isPlaying} onTogglePlay={handleTogglePlay} />
          <button
            className="render-button"
            onClick={handleRenderAndUpload}
            disabled={isRendering}
            style={{ marginLeft: '10px', padding: '0 15px', background: '#e04f5f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {isRendering ? 'Rendering...' : 'Render & Upload'}
          </button>
        </section>

        <section className="sequencer-panel">
          <PianoRoll
            notes={notes}
            playheadTime={playheadTime}
            loopLength={loopLength}
            onNotesChange={handleNotesChange}
            bpm={bpm}
          />
        </section>

        <Mixer onSequencerVolumeChange={(vol) => audioEngineRef.current?.setSequencerVolume(vol)} />

        <footer className="app-footer">
          <p>Piano roll sequencer with sample kit loading and time-based note scheduling ready for swarm sync.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
