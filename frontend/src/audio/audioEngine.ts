import { TrackId, Note } from '../types';
import { bufferToWav } from './wavEncoder';

interface AudioEngineOptions {
    onPlayheadUpdate?: (time: number) => void;
}

export class AudioEngine {
    private audioContext: AudioContext | null = null;
    private sampleBuffers: Record<TrackId, AudioBuffer | null> = {
        0: null,
        1: null,
        2: null,
        3: null,
    };
    // Store a random detune value for the kit, applied to all tracks to add variation for each load of the kit.
    private kitDetune: number = 0;
    private sampleLoadPromises: Partial<Record<TrackId, Promise<void>>> = {};
    private isPlaying = false;
    private playheadTime = 0;
    private startTime = 0;
    private scheduleAheadTime = 0.2;
    private tempo = 120;
    private loopLength = 8; // seconds
    private notes: Note[] = [];
    private activeNotes = new Map<string, AudioBufferSourceNode>();
    private scheduledNotes = new Map<string, number>();
    private requestId: number | null = null;
    private onPlayheadUpdate: ((time: number) => void) | undefined;
    private masterGain: GainNode | null = null;

    init(options: AudioEngineOptions = {}) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.onPlayheadUpdate = options.onPlayheadUpdate;
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
        }
    }

    async loadSample(trackId: TrackId, url: string): Promise<void> {
        if (!this.audioContext) {
            this.init();
        }
        if (!this.audioContext) {
            throw new Error('AudioContext not initialized');
        }
        if (this.sampleBuffers[trackId]) {
            return;
        }
        if (this.sampleLoadPromises[trackId]) {
            return this.sampleLoadPromises[trackId]!;
        }

        const promise = (async () => {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
            this.sampleBuffers[trackId] = audioBuffer;
        })();

        this.sampleLoadPromises[trackId] = promise;
        try {
            await promise;
        } finally {
            delete this.sampleLoadPromises[trackId];
        }
    }

    setNotes(notes: Note[]) {
        this.notes = notes;
    }

    clearSamples() {
        this.sampleBuffers = {
            0: null,
            1: null,
            2: null,
            3: null,
        };
        this.sampleLoadPromises = {};
        // Generate a new random detune for the next kit (0 to 20 cents)
        this.kitDetune = Math.random() * 20;
        console.log(`New kit detune set to ${this.kitDetune.toFixed(2)} cents`);
    }

    setSequencerVolume(volume: number) {
        if (this.masterGain) {
            this.masterGain.gain.value = volume;
        }
    }

    async renderLoop(): Promise<Blob> {
        // We will render exactly 1 loop length (8 seconds) at 44.1kHz
        const sampleRate = 44100;
        const offlineCtx = new OfflineAudioContext(2, sampleRate * this.loopLength, sampleRate);

        this.notes.forEach(note => {
            const buffer = this.sampleBuffers[note.trackId];
            if (!buffer) return;

            const source = offlineCtx.createBufferSource();
            source.buffer = buffer;
            source.detune.value = this.kitDetune;

            const gain = offlineCtx.createGain();
            gain.gain.value = 1; // You could apply volume here if needed

            source.connect(gain).connect(offlineCtx.destination);
            // Render from start of loop (0) up to duration
            source.start(note.startTime, 0, note.duration);
        });

        const renderedBuffer = await offlineCtx.startRendering();
        return bufferToWav(renderedBuffer);
    }

    setLoopLength(seconds: number) {
        this.loopLength = seconds;
    }

    start() {
        if (!this.audioContext) {
            this.init();
        }
        if (!this.audioContext) {
            return;
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        this.isPlaying = true;
        this.playheadTime = 0;
        this.startTime = this.audioContext.currentTime;
        this.schedule();
    }

    stop() {
        this.isPlaying = false;
        this.activeNotes.forEach(source => {
            source.stop();
        });
        this.activeNotes.clear();
        this.scheduledNotes.clear();
        if (this.requestId !== null) {
            cancelAnimationFrame(this.requestId);
            this.requestId = null;
        }
    }

    private schedule() {
        if (!this.audioContext || !this.isPlaying) {
            return;
        }

        const now = this.audioContext.currentTime;
        const elapsed = now - this.startTime;
        const loopIndex = Math.floor(elapsed / this.loopLength);
        const currentPlayheadTime = elapsed - loopIndex * this.loopLength;
        this.playheadTime = currentPlayheadTime;

        if (this.onPlayheadUpdate) {
            this.onPlayheadUpdate(currentPlayheadTime);
        }

        // Clean up scheduled notes that have passed
        this.scheduledNotes.forEach((scheduledTime, noteId) => {
            if (scheduledTime < now) {
                this.scheduledNotes.delete(noteId);
            }
        });

        // Stop notes that have ended, and clean scheduled tracking for completed notes.
        this.activeNotes.forEach((source, noteId) => {
            const note = this.notes.find(n => n.id === noteId);
            if (!note || currentPlayheadTime > note.startTime + note.duration) {
                source.stop();
                this.activeNotes.delete(noteId);
            }
        });

        const lookaheadTime = now + this.scheduleAheadTime;

        this.notes.forEach(note => {
            if (this.activeNotes.has(note.id)) {
                return;
            }

            // Calculate the next absolute time this note should play
            const nextLoopStart = this.startTime + (loopIndex + 1) * this.loopLength;
            const noteInCurrentLoop = this.startTime + loopIndex * this.loopLength + note.startTime;

            let absoluteStart = noteInCurrentLoop;

            // If the note's scheduled time has passed beyond the lookahead, schedule it for the next loop
            if (absoluteStart < now - this.scheduleAheadTime) {
                absoluteStart = nextLoopStart + note.startTime;
            }

            // Skip if we've already scheduled this exact time
            const scheduledStart = this.scheduledNotes.get(note.id);
            if (scheduledStart === absoluteStart) {
                return;
            }

            if (absoluteStart <= lookaheadTime) {
                this.scheduledNotes.set(note.id, absoluteStart);
                this.playNote(note, absoluteStart);
            }
        });

        this.requestId = requestAnimationFrame(() => this.schedule());
    }

    private playNote(note: Note, scheduleTime: number) {
        console.log(`Scheduling note ${note.id} at ${scheduleTime.toFixed(3)}s (playhead: ${this.playheadTime.toFixed(3)}s)`);
        const ctx = this.audioContext;
        if (!ctx) {
            return;
        }

        const buffer = this.sampleBuffers[note.trackId];
        if (!buffer) {
            return;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // Apply kit detune to all tracks
        source.detune.value = this.kitDetune;

        const gain = ctx.createGain();
        gain.gain.value = 1;

        const startAt = scheduleTime;
        if (this.masterGain) {
            source.connect(gain).connect(this.masterGain);
        } else {
            source.connect(gain).connect(ctx.destination);
        }
        source.start(startAt, 0, note.duration);

        source.onended = () => {
            this.activeNotes.delete(note.id);
        };

        this.activeNotes.set(note.id, source);
    }
}
