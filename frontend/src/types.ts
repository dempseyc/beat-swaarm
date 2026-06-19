export type TrackId = 0 | 1 | 2 | 3;

export const TRACK_IDS: TrackId[] = [3, 2, 1, 0];

export interface Note {
    id: string;
    trackId: TrackId;
    startTime: number; // in seconds
    duration: number; // in seconds
    valid: boolean;
}

export interface SequencerState {
    bpm: number;
    playheadTime: number; // in seconds
    notes: Note[];
    loopLength: number; // in seconds (e.g., 16 beats at 120 BPM = 8 seconds)
}

export interface KitLoadedEvent {
    trackId: TrackId;
    sampleUrl: string;
    sampleName: string;
}
