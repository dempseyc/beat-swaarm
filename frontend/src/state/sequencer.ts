import { Note, TrackId } from '../types';

export function createInitialSequencerState() {
    const notes: Note[] = [
        { id: '1', trackId: 0, startTime: 0, duration: 0.5 },       // Beat 0
        { id: '2', trackId: 0, startTime: 2, duration: 0.5 },       // Beat 4
        { id: '3', trackId: 1, startTime: 1, duration: 0.5 },       // Beat 2
        { id: '4', trackId: 2, startTime: 0.5, duration: 0.5 },     // Beat 1
        { id: '5', trackId: 2, startTime: 1.5, duration: 0.5 },     // Beat 3
    ];

    const beatsPerLoop = 8;
    const loopLength = (beatsPerLoop * 60) / 120; // seconds at 120 BPM

    return {
        bpm: 120,
        isPlaying: false,
        playheadTime: 0,
        notes,
        loopLength,
    };
}

export function generateNoteId(): string {
    return `note-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export function addNote(notes: Note[], trackId: TrackId, startTime: number, duration: number = 0.5): Note[] {
    const newNote: Note = {
        id: generateNoteId(),
        trackId,
        startTime,
        duration,
    };
    return [...notes, newNote];
}

export function deleteNote(notes: Note[], noteId: string): Note[] {
    return notes.filter(n => n.id !== noteId);
}

export function updateNote(notes: Note[], noteId: string, updates: Partial<Omit<Note, 'id' | 'trackId'>>): Note[] {
    return notes.map(n => (n.id === noteId ? { ...n, ...updates } : n));
}

