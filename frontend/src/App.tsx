import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import './App.css';
// @ts-ignore -- allow side-effect import of CSS without type declarations
import './rangeInput.css';
import { PianoRoll } from './components/PianoRoll';
import { MasterMute } from './components/MasterMute';
import { QuantizeControl } from './components/QuantizeControl';
import { SequencerControl } from './components/SequencerControl';
import { AudioEngine } from './audio/audioEngine';
import { DrumPad } from './components/DrumPad';
import { addNote, createInitialSequencerState, deleteNote } from './state/sequencer';
import { snapToGrid } from './utils';
import { Note, TrackId } from './types';
import axios from 'axios';
import Metror1Control from './components/Metror1Control';
import MainControl from './components/MainControl';
import Metror2Control from './components/Metror2Control';

const KIT_SAMPLES = {

  haand: ['HAAND-hard.wav', 'HAAND-right.wav', 'HAAND-left.wav', 'HAAND-tap.wav'],
  bipp: ['BIPP-accent.wav', 'BIPP-right.wav', 'BIPP-left.wav', 'BIPP-tap.wav'],
  blokk: ['BLOKK-low.wav', 'BLOKK-midlow.wav', 'BLOKK-midhigh.wav', 'BLOKK-high.wav'],
  boingg: ['BOINGG-accent.wav', 'BOINGG-right.wav', 'BOINGG-left.wav', 'BOINGG-tap.wav'],
  piaano: ['PIAANO-low.wav', 'PIAANO-lowleft.wav', 'PIAANO-highright.wav', 'PIAANO-high.wav'],
  thumpp: ['THUMPP-hard.wav', 'THUMPP-left.wav', 'THUMPP-right.wav', 'THUMPP-tap.wav'],
  pllluk: ['PLLLUK-low.wav', 'PLLLUK-midlow.wav', 'PLLLUK-midhigh.wav', 'PLLLUK-high.wav'],
  craigg: ['80CRAIGG-kick.wav', '80CRAIGG-snare.wav', '80CRAIGG-hhc.wav', '80CRAIGG-hho.wav'],
} as const;

type KitName = keyof typeof KIT_SAMPLES;

const KIT_LABELS: Record<KitName, string> = {
  haand: 'HAAND',
  piaano: 'PIAANO',
  thumpp: 'THUMPP',
  pllluk: 'PLLLUK',
  bipp: 'BIPP',
  blokk: 'BLOKK',
  boingg: 'BOINGG',
  craigg: '80CRAIGG',
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
  const [epoch, setEpoch] = useState(initialState.epoch);
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
  const [overwrite, setOverwrite] = useState(false);
  const [punchtime, setPunchtime] = useState(0);

  const [quantizeDenom, setQuantizeDenom] = useState<number>(4); // default 1/4 note
  const [quantizeEnabled, setQuantizeEnabled] = useState<boolean>(true);
  const deletedNoteIdsRef = useRef<Set<string>>(new Set());

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
          setEpoch(data.epochCount);
          // Store client ID for uploads
          (window as any).clientId = data.clientId;
        } else if (data.type === 'main-loop-updated') {
          setEpoch(data.epochCount);

          engine.loadNextMainLoop(`${data.url}?t=${data.timestamp}`);
          console.log('Received main loop update from server:', data);// hack unknown why backend count is doubled, maybe creates additional connection after handshake?
        } else if (data.type === 'epoch-sync') {
          setEpoch(data.epochCount);
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

  // Toggle overwrite and set punch-in point at current playhead position
  const handleOverwriteToggle = () => {
    setPunchtime(playheadTime);
    setOverwrite(!overwrite);
  };

  // Mark notes as invalid when overwrite is toggled on, re-validate when toggled off
  // at time 0, reset punchtime
  useEffect(() => {
    setPunchtime(0);
    setNotes(prevNotes =>
      prevNotes.map(n => ({
        ...n,
        valid: overwrite && n.startTime >= punchtime ? false : true
      }))
    );
    if (!overwrite) {
      deletedNoteIdsRef.current.clear();
    }
  }, [epoch])

  useEffect(() => {
    console.log('punchtime', punchtime)
    setNotes(prevNotes =>
      prevNotes.map(n => ({
        ...n,
        valid: overwrite && n.startTime >= punchtime ? false : true
      }))
    );
    if (!overwrite) {
      deletedNoteIdsRef.current.clear();
    }
  }, [overwrite, punchtime]);


  // Delete invalid notes as playhead passes them
  useEffect(() => {
    notes.forEach(n => {
      if (!n.valid && n.startTime <= playheadTime && !deletedNoteIdsRef.current.has(n.id)) {
        deletedNoteIdsRef.current.add(n.id);
        setNotes(prevNotes => prevNotes.filter(note => note.id !== n.id));
      }
    });
  }, [playheadTime, notes]);

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
    if (!engine) {
      console.warn('Audio engine not initialized yet');
      return;
    }

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

  const handlePadTrigger = (trackId: TrackId, recording: boolean) => {
    console.log("pad trigger", Date.now())
    if (!audioEngineRef.current) return;

    // Play immediately
    if (audioEngineRef.current.isTransportRunning) {
      audioEngineRef.current.start();
    }
    audioEngineRef.current.playNoteImmediate(trackId, 0.25);

    // Add to sequencer if recording
    recording && !isMuted && setNotes(prevNotes => {
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
        </header>

        <section className="controls-toolbar">
          <Metror1Control onM1VolumeChange={(vol) => {
            if (audioEngineRef.current) {
              audioEngineRef.current.setMetror1Volume(vol);
            }
          }} />
          <div className="controls play-controls">
            <div className='control transport-controls'>
              <MasterMute isMuted={isMuted} onToggleMute={handleToggleMute} />
              <button
                className="render-button"
                onClick={handleRenderAndUpload}
                disabled={isRendering}

              >
                {isRendering ? '.....' : 'Transmit'}
              </button>
              <div className="keep-going-button">
                <button onClick={() => setKeepGoing(!keepGoing)} className={keepGoing ? 'active' : ''}>
                  REPT
                </button>
              </div>
            </div>
            <MainControl onMainVolumeChange={(vol) => {
              if (audioEngineRef.current) {
                audioEngineRef.current.setMainVolume(vol);
              }
            }} playheadTime={playheadTime} />
          </div>
          <Metror2Control onM2VolumeChange={(vol) => {
            if (audioEngineRef.current) {
              audioEngineRef.current.setMetror2Volume(vol);
            }
          }} />
        </section>


        <section className="controls-toolbar">

          <QuantizeControl
            onToggle={(enabled) => setQuantizeEnabled(enabled)}
            onChangeDenom={(denom) => setQuantizeDenom(denom)}
          />
          <SequencerControl
            onSequencerVolumeChange={(vol) => {
              if (audioEngineRef.current) {
                audioEngineRef.current.setSequencerVolume(vol);
              }
            }}
            selectedKit={selectedKit}
            onKitChange={setSelectedKit}
          />
          <div className="control status-display" >
            <div className='time-signature'>{'4/4'}</div>
            <div className='bpm'>BPM: {bpm}</div>
            <div className='swing'>Swing: 0.50</div>

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
            overwrite={overwrite}
          />
          <DrumPad onPadTrigger={handlePadTrigger} isMuted={isMuted} overwrite={overwrite} handleOverwriteToggle={handleOverwriteToggle} />
        </section>

        <footer className="app-footer">
          <p>Audio Loop Generator and Universal Time Swarm Sync</p>
        </footer>
      </div>
    </div>);
}

export default App;
