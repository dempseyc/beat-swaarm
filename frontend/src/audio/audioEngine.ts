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

    // Gains
    private masterGain: GainNode | null = null;
    private mainGain: GainNode | null = null;
    private nextMainGain: GainNode | null = null;
    private m1Gain: GainNode | null = null;
    private m2Gain: GainNode | null = null;

    // Buffers
    private metror1Buffer: AudioBuffer | null = null;
    private metror2Buffer: AudioBuffer | null = null;
    private currentMainBuffer: AudioBuffer | null = null;
    private nextMainBuffer: AudioBuffer | null = null;

    // Sources
    private metror1Source: AudioBufferSourceNode | null = null;
    private metror2Source: AudioBufferSourceNode | null = null;
    private currentMainSource: AudioBufferSourceNode | null = null;
    private nextMainSource: AudioBufferSourceNode | null = null;

    private scheduledLoops = new Set<number>();
    private activeBackgroundSources = new Map<string, AudioBufferSourceNode>();

    // State
    private serverEpoch: number = 0;
    private serverTimeOffset: number = 0;
    private vols = { main: 1, m1: 1, m2: 1 };

    init(options: AudioEngineOptions = {}) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.onPlayheadUpdate = options.onPlayheadUpdate;

            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);

            this.mainGain = this.audioContext.createGain();
            this.mainGain.connect(this.audioContext.destination);

            this.nextMainGain = this.audioContext.createGain();
            this.nextMainGain.connect(this.audioContext.destination);
            this.nextMainGain.gain.value = 0;

            this.m1Gain = this.audioContext.createGain();
            this.m1Gain.connect(this.audioContext.destination);

            this.m2Gain = this.audioContext.createGain();
            this.m2Gain.connect(this.audioContext.destination);

            this.loadBuffer('/audio/native-kits/metrors/120_SYNCOR_PANDAA.wav').then(b => this.metror1Buffer = b).catch(e => console.warn("Missing metror1", e));
            this.loadBuffer('/audio/native-kits/metrors/120_TACTOR_THUMPP_2.wav').then(b => this.metror2Buffer = b).catch(e => console.warn("Missing metror2", e));
        }
    }

    setServerSync(epoch: number, serverNow: number) {
        this.serverEpoch = epoch;
        this.serverTimeOffset = Date.now() - serverNow;
    }

    private async loadBuffer(url: string): Promise<AudioBuffer> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load buffer from ${url}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        if (!this.audioContext) throw new Error("No context");
        return await this.audioContext.decodeAudioData(arrayBuffer);
    }

    async loadNextMainLoop(url: string) {
        try {
            this.nextMainBuffer = await this.loadBuffer(url);
            console.log("Loaded new main loop buffer into 'next'");
        } catch (e) {
            console.error("Failed to load new main loop", e);
        }
    }

    async loadSample(trackId: TrackId, url: string): Promise<void> {
        if (!this.audioContext) this.init();
        if (!this.audioContext) throw new Error('AudioContext not initialized');
        if (this.sampleBuffers[trackId]) return;
        if (this.sampleLoadPromises[trackId]) return this.sampleLoadPromises[trackId]!;

        const promise = (async () => {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
            this.sampleBuffers[trackId] = audioBuffer;
        })();

        this.sampleLoadPromises[trackId] = promise;
        try { await promise; } finally { delete this.sampleLoadPromises[trackId]; }
    }

    setNotes(notes: Note[]) { console.log("AudioEngine setNotes:", notes); this.notes = notes; }

    clearSamples() {
        this.sampleBuffers = { 0: null, 1: null, 2: null, 3: null };
        this.sampleLoadPromises = {};
        this.kitDetune = Math.random() * 20;
    }

    setTempo(bpm: number) { this.tempo = bpm; }
    setLoopLength(seconds: number) { this.loopLength = seconds; }

    setSequencerVolume(volume: number) { if (this.masterGain) this.masterGain.gain.value = volume; }
    setMainVolume(volume: number) { this.vols.main = volume; if (this.mainGain) this.mainGain.gain.value = volume; }
    setMetror1Volume(volume: number) { this.vols.m1 = volume; if (this.m1Gain) this.m1Gain.gain.value = volume; }
    setMetror2Volume(volume: number) { this.vols.m2 = volume; if (this.m2Gain) this.m2Gain.gain.value = volume; }

    async renderLoop(): Promise<Blob> {
        const sampleRate = 44100;

        // Render enough space for 1 loop + any tails from notes
        // OfflineCtx length must encompass tails crossing loop boundaries.
        // We'll render exactly 2 loops of length, and then mathematically fold the tail of loop 1 into the start of loop 1
        const renderLength = this.loopLength * 2;
        const offlineCtx = new OfflineAudioContext(2, sampleRate * renderLength, sampleRate);
        console.log(`Rendering loop with ${this.notes.length} notes, total render length ${renderLength}s at ${sampleRate}Hz`);

        this.notes.forEach(note => {
            const buffer = this.sampleBuffers[note.trackId];
            if (!buffer) return;

            // Render the note in the first loop
            const source1 = offlineCtx.createBufferSource();
            source1.buffer = buffer;
            source1.detune.value = this.kitDetune;
            const gain1 = offlineCtx.createGain();
            source1.connect(gain1).connect(offlineCtx.destination);
            source1.start(note.startTime); // Start without duration restriction to allow full tail

            // Also render it exactly one loop later, so notes with long tails at the end of the loop 
            // cross over properly when we extract the exact loop block
            const source2 = offlineCtx.createBufferSource();
            source2.buffer = buffer;
            source2.detune.value = this.kitDetune;
            const gain2 = offlineCtx.createGain();
            source2.connect(gain2).connect(offlineCtx.destination);
            source2.start(note.startTime + this.loopLength);
        });

        const renderedBuffer = await offlineCtx.startRendering();

        // Now extract exactly 1 loop length, starting from the second loop to ensure tail overlap
        const finalCtx = new OfflineAudioContext(2, sampleRate * this.loopLength, sampleRate);
        const loopSource = finalCtx.createBufferSource();
        loopSource.buffer = renderedBuffer;
        loopSource.connect(finalCtx.destination);

        // Start playing the buffer backwards by exactly this.loopLength so we just capture the second block
        // where the tails have perfectly folded over
        loopSource.start(0, this.loopLength, this.loopLength);

        const finalBuffer = await finalCtx.startRendering();

        return bufferToWav(finalBuffer);
    }

    start() {
        if (!this.audioContext) this.init();
        if (!this.audioContext) return;
        console.log(this.audioContext.state);
        if (this.audioContext.state === 'suspended') this.audioContext.resume();
        this.isPlaying = true;
        console.log(this.isPlaying)

        const nowMs = Date.now();

        // Ensure effective epoch is valid even if websocket hasn't connected
        const effectiveEpoch = this.serverEpoch || nowMs;
        const serverNow = nowMs - this.serverTimeOffset;

        const elapsedSinceEpoch = (serverNow - effectiveEpoch) / 1000;

        // Prevent negative or NaN modulo calculations
        let loopPosition = elapsedSinceEpoch % this.loopLength;
        if (isNaN(loopPosition) || loopPosition < 0) {
            loopPosition = 0;
        }

        this.startTime = this.audioContext.currentTime - loopPosition;
        this.playheadTime = loopPosition;

        this.schedule();
    }

    private scheduleLoops(loopIndex: number, startAt: number, offset: number) {
        if (!this.audioContext) return;

        const scheduleMetror = (buffer: AudioBuffer | null, gain: GainNode | null, vol: number, metrorName: string) => {
            if (!buffer || !gain) return;
            const source = this.audioContext!.createBufferSource();
            source.buffer = buffer;
            source.loop = false; // Schedule every loop instead of source.loop = true
            source.connect(gain);
            gain.gain.value = vol;
            source.start(startAt, offset);

            const activeKey = `metror-${metrorName}:${loopIndex}`;
            this.activeBackgroundSources.set(activeKey, source);

            source.onended = () => {
                this.activeBackgroundSources.delete(activeKey);
            };
        };

        scheduleMetror(this.metror1Buffer, this.m1Gain, this.vols.m1, '1');
        scheduleMetror(this.metror2Buffer, this.m2Gain, this.vols.m2, '2');

        // Also schedule the main loop perfectly matched with metrors
        if (this.currentMainBuffer && this.mainGain) {
            scheduleMetror(this.currentMainBuffer, this.mainGain, this.vols.main, 'main');
        }
    }

    stop() {
        this.isPlaying = false;
        this.activeNotes.forEach(source => source.stop());
        this.activeNotes.clear();
        this.scheduledNotes.clear();

        this.activeBackgroundSources.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        this.activeBackgroundSources.clear();
        this.scheduledLoops.clear();

        [this.metror1Source, this.metror2Source, this.currentMainSource, this.nextMainSource].forEach(s => {
            if (s) try { s.stop(); } catch (e) { }
        });
        this.metror1Source = null;
        this.metror2Source = null;
        this.currentMainSource = null;
        this.nextMainSource = null;

        if (this.requestId !== null) {
            cancelAnimationFrame(this.requestId);
            this.requestId = null;
        }
    }

    private schedule() {
        if (!this.audioContext || !this.isPlaying) return;

        const now = this.audioContext.currentTime;
        const elapsed = now - this.startTime;

        // Prevent NaN logic cascade
        if (isNaN(elapsed) || isNaN(this.loopLength) || this.loopLength <= 0) {
            this.requestId = requestAnimationFrame(() => this.schedule());
            return;
        }

        const loopIndex = Math.floor(elapsed / this.loopLength);
        const currentPlayheadTime = Math.max(0, elapsed - loopIndex * this.loopLength);
        this.playheadTime = currentPlayheadTime;

        if (this.onPlayheadUpdate) this.onPlayheadUpdate(currentPlayheadTime);

        this.scheduledNotes.forEach((scheduledTime, key) => {
            if (scheduledTime < now) this.scheduledNotes.delete(key);
        });

        // Cleanup any lingering active notes manually just in case onended misses something
        this.activeNotes.forEach((source, key) => {
            const parts = key.split(':');
            const noteLoopIndexStr = parts.pop() || '0';
            const noteId = parts.join(':');
            const noteLoopIndex = parseInt(noteLoopIndexStr, 10);
            const note = this.notes.find(n => n.id === noteId);

            // If the note was deleted, or we are past its intended playtime in its specific loop
            const noteExpectedEnd = this.startTime + noteLoopIndex * this.loopLength + (note?.startTime || 0) + (note?.duration || 0);

            if (!note || now > noteExpectedEnd + 0.1) {
                try { source.stop(); } catch (e) { }
                this.activeNotes.delete(key);
            }
        });

        const lookaheadTime = now + this.scheduleAheadTime;

        if (this.nextMainBuffer && this.audioContext) {
            this.currentMainBuffer = this.nextMainBuffer;
            this.nextMainBuffer = null;
        }

        // Schedule notes for the current loop and the next loop to handle the window perfectly
        [loopIndex, loopIndex + 1].forEach(targetLoopIndex => {
            const loopAbsoluteStart = this.startTime + (targetLoopIndex * this.loopLength);

            // Schedule background tracks (metrors and main loop) exactly once per loop
            if (!this.scheduledLoops.has(targetLoopIndex)) {
                if (loopAbsoluteStart <= lookaheadTime && loopAbsoluteStart + this.loopLength > now) {
                    let startAt = loopAbsoluteStart;
                    let offset = 0;
                    if (startAt < now) {
                        offset = now - startAt;
                        startAt = now;
                    }
                    this.scheduleLoops(targetLoopIndex, startAt, offset);
                    this.scheduledLoops.add(targetLoopIndex);
                }
            }

            this.notes.forEach(note => {
                const absoluteStart = loopAbsoluteStart + note.startTime;
                // If it's already in the past (with a small epsilon for late scheduling), or too far in the future, skip
                // if (absoluteStart < now - 0.05 || absoluteStart > lookaheadTime) return;  //makes farts (multiple schedulings)
                if (absoluteStart < now || absoluteStart > lookaheadTime) return;
                const activeKey = `${note.id}:${targetLoopIndex}`;

                // Already playing or scheduled?
                if (this.activeNotes.has(activeKey) || this.scheduledNotes.has(activeKey)) return;

                this.scheduledNotes.set(activeKey, absoluteStart);
                this.playNote(note, absoluteStart, targetLoopIndex);
            });
        });

        // Cleanup old scheduled loop records to prevent memory leak
        this.scheduledLoops.forEach(idx => {
            if (idx < loopIndex - 1) this.scheduledLoops.delete(idx);
        });

        this.requestId = requestAnimationFrame(() => this.schedule());
    }

    playNoteImmediate(trackId: TrackId, duration: number) {
        if (!this.audioContext || this.audioContext.state === 'suspended') return;
        const buffer = this.sampleBuffers[trackId];
        if (!buffer) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.detune.value = this.kitDetune;

        const gain = this.audioContext.createGain();
        gain.gain.value = 1;
        if (this.masterGain) source.connect(gain).connect(this.masterGain);
        else source.connect(gain).connect(this.audioContext.destination);
        source.start(0, 0, duration);
    }

    private playNote(note: Note, scheduleTime: number, loopIndex: number) {
        const ctx = this.audioContext;
        if (!ctx) return;
        const buffer = this.sampleBuffers[note.trackId];
        if (!buffer) return;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.detune.value = this.kitDetune;

        const gain = ctx.createGain();
        gain.gain.value = 1;
        if (this.masterGain) source.connect(gain).connect(this.masterGain);
        else source.connect(gain).connect(ctx.destination);
        source.start(scheduleTime, 0, note.duration);

        // Map by note ID AND loop index so notes wrapping the loop boundary don't block themselves
        const activeKey = `${note.id}:${loopIndex}`;
        this.activeNotes.set(activeKey, source);

        source.onended = () => {
            this.activeNotes.delete(activeKey);
        };

    }
}
