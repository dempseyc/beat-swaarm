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
import { snapToGrid, generateNoteId } from './utils';
import { Note, TrackId } from './types';
import axios from 'axios';
import Metror1Control from './components/Metror1Control';
import MainControl from './components/MainControl';
import Metror2Control from './components/Metror2Control';
import InfoCard from './components/InfoCard';

const KIT_SAMPLES = {

  haand: ['HAAND-hard.wav', 'HAAND-right.wav', 'HAAND-left.wav', 'HAAND-tap.wav'],
  tiiine: ['TIIINE-low.wav', 'TIIINE-midlow.wav', 'TIIINE-midhigh.wav', 'TIIINE-high.wav'],
  drumm: ['DRUMM-accent.wav', 'DRUMM-left.wav', 'DRUMM-right.wav', 'DRUMM-tap.wav'],
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
  tiiine: 'TIIINE',
  drumm: 'DRUMM',
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
  const notesRef = useRef<Note[]>(initialState.notes);
  const [notes, setNotes] = useState(initialState.notes);
  notesRef.current = notes;
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
  const [infoVisible, setInfoVisible] = useState<boolean>(true);
  const deletedNoteIdsRef = useRef<Set<string>>(new Set());

  function snapToGridPR(time: number, denom: number, applyJitter = true) {
    // denom is denominator of whole note (e.g., 16 -> 1/16)
    // whole note duration = 240 / bpm seconds
    const whole = 240 / (bpm || 120);
    const unit = whole / denom;
    let snapped = Math.max(0, Math.min(loopLength, Math.round(time / unit) * unit));
    if (applyJitter) {
      // add a tiny random delay between 0.000 and 0.002999 seconds (0 - 2.999 ms)
      const jitter = Math.random() * 0.002999;
      snapped = Math.min(loopLength, snapped + jitter);
    }
    return snapped;
  }

  const applyQuantizeAll = () => {
    if (!quantizeEnabled) return;

    const quantizedNotes = notes.map((note) => ({
      ...note,
      startTime: snapToGridPR(note.startTime, quantizeDenom, true),
    }));

    const dedupedNotes: Note[] = [];
    const seenPairs = new Set<string>();

    for (const note of quantizedNotes) {
      const key = `${note.trackId}:${note.startTime.toFixed(3)}`;
      const duplicate = dedupedNotes.find(existing =>
        existing.trackId === note.trackId &&
        Math.abs(existing.startTime - note.startTime) < 0.01
      );

      if (duplicate) {
        continue;
      }

      dedupedNotes.push(note);
      seenPairs.add(key);
    }

    setNotes(dedupedNotes);
  };

  useEffect(() => {
    const engine = new AudioEngine();
    engine.init({ onPlayheadUpdate: time => setPlayheadTime(time) });
    engine.setNotes(initialState.notes);
    engine.setTempo(initialState.bpm);
    engine.setLoopLength(initialState.loopLength);

    const ws = new WebSocket(
      process.env.NODE_ENV === "production"
        ? `${window.location.protocol === "https:" ? "wss" : "ws"}://beatswaarm.craig-dempsey.com`
        : "ws://localhost:4000"
    );
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setNumClients(data.num_clients);
        if (data.type === 'server-time') {
          engine.setServerSync(data.epoch, data.timestamp);
          // setEpoch(data.epochCount);
          // Store client ID for uploads
          (window as any).clientId = data.clientId;
        } else if (data.type === 'main-loop-updated') {
          engine.loadNextMainLoop(`${data.url}?t=${data.timestamp}`);
          // console.log('Received main loop update from server:', performance.now());
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
      if (!n.valid && (playheadTime - 0.03 <= n.startTime) && (n.startTime <= playheadTime + 0.01) && !deletedNoteIdsRef.current.has(n.id)) {
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
      const url = `${process.env.PUBLIC_URL}/audio/native-kits/${selectedKit}/${filename}`;
      return engine.loadSample(trackId, url).catch(err => {
        console.warn(`Failed to load kit sample ${url}:`, err);
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
    if (!keepGoing) return;
    handleRenderAndUpload();
  }, [epoch, keepGoing]);

  const handleRenderAndUpload = async () => {
    if (!audioEngineRef.current || isRendering) return;
    setIsRendering(true);
    try {
      const wavBlob = await audioEngineRef.current.renderLoop();

      const formData = new FormData();
      formData.append('loop', wavBlob, 'loop.wav');
      formData.append('clientId', (window as any).clientId || 'unknown');

      await axios.post(process.env.NODE_ENV === "production" ? process.env.PUBLIC_URL + '/upload' : 'http://localhost:4000/upload', formData, {
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

  const activePadNotesRef = useRef<Map<TrackId, { startTime: number; id: string }>>(new Map());

  const handlePadTrigger = (trackId: TrackId, recording: boolean, duration: number = 0, startTime: number = playheadTime) => {
    console.log("pad trigger", Date.now());
    if (!audioEngineRef.current) return;

    if (audioEngineRef.current.isTransportRunning) {
      audioEngineRef.current.start();
    }

    if (!recording || isMuted) return;

    if (duration <= 0) {
      audioEngineRef.current.playNoteImmediate(trackId, 0.25);
      console.log("PRESS PATH", { trackId, duration, playheadTime: startTime });
      if (activePadNotesRef.current.has(trackId)) {
        console.log("Press ignored: note already active", { trackId });
        return;
      }

      let noteStartTime = startTime;
      if (quantizeEnabled) {
        noteStartTime = snapToGrid(noteStartTime, quantizeDenom, bpm, loopLength, true);
      }

      const newNotes = addNote(notesRef.current, trackId, noteStartTime, 0.05);
      const addedNote = newNotes[newNotes.length - 1];
      console.log("Press: storing in ref", { trackId, addedNote });
      activePadNotesRef.current.set(trackId, { startTime: noteStartTime, id: addedNote.id });
      notesRef.current = newNotes;
      setNotes(newNotes);
      return;
    }

    console.log("RELEASE PATH", { trackId, duration });
    const noteDuration = Math.max(0.05, duration);
    const activeNote = activePadNotesRef.current.get(trackId);
    console.log("Release: found activeNote", { trackId, activeNote, noteDuration });

    if (!activeNote) {
      console.warn("Release: no active note found!");
      return;
    }

    const updatedNotes = notesRef.current.map(note =>
      note.id === activeNote.id ? { ...note, duration: noteDuration } : note
    );
    activePadNotesRef.current.delete(trackId);
    notesRef.current = updatedNotes;
    setNotes(updatedNotes);
  };

  return (
    <div className="App">
      <div className="app-shell">
        <header className="app-header">
          <div className='tag-container' onClick={() => setInfoVisible(!infoVisible)}>
            <div className="app-tag">BEATSWAARM</div>
            <div className='app-tag-tagline'>{`Click ${infoVisible ? 'to HIDE' : 'for INFO'}`}</div>
            <InfoCard setInfoVisible={setInfoVisible} infoVisible={infoVisible} />
          </div>
          {/* <div className="status-display" >
            <div className='time-signature'><span className='data-text'>4/4</span></div>
            <div className='bpm'>BPM: <span className='data-text'>{bpm}</span></div>
            <div className='swing'>GRV: <span className='data-text'>50</span></div>
            <div className='client-count'># <span className='data-text'>{numClients}</span></div>
          </div> */}

        </header>
        <div className='controls transport-controls'>
          <h1>{Math.ceil(playheadTime)}</h1>
          <MasterMute isMuted={isMuted} onToggleMute={handleToggleMute} />
          <button
            className={`control-button render-button ${isRendering ? 'active' : ''}`}
            onClick={handleRenderAndUpload}
            disabled={isRendering}
          >
            TRNS
          </button>
          <button
            onClick={() => setKeepGoing(!keepGoing)}
            className={'control-button keep-going-button' + (keepGoing ? ' active' : '')}>
            REPT
          </button>
        </div>
        <section className="controls-toolbar">
          <Metror1Control onM1VolumeChange={(vol) => {
            if (audioEngineRef.current) {
              audioEngineRef.current.setMetror1Volume(vol);
            }
          }} />
          <MainControl onMainVolumeChange={(vol) => {
            if (audioEngineRef.current) {
              audioEngineRef.current.setMainVolume(vol);
            }
          }} />
          <Metror2Control onM2VolumeChange={(vol) => {
            if (audioEngineRef.current) {
              audioEngineRef.current.setMetror2Volume(vol);
            }
          }} />
        </section>


        <section className="controls-toolbar sequencer-controls-toolbar">

          <QuantizeControl
            onToggle={(enabled) => setQuantizeEnabled(enabled)}
            onChangeDenom={(denom) => setQuantizeDenom(denom)}
            onApply={() => { applyQuantizeAll() }}
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
          <DrumPad
            onPadTrigger={handlePadTrigger}
            isMuted={isMuted}
            overwrite={overwrite}
            handleOverwriteToggle={handleOverwriteToggle}
            getCurrentPlayheadTime={() => audioEngineRef.current?.getCurrentPlayheadTime() ?? playheadTime}
          />
        </section>

        <footer className="app-footer">
          <p>Audio Loop Generator and Universal Time Swarm Sync</p>
        </footer>
      </div>
    </div>);
}

export default App;
