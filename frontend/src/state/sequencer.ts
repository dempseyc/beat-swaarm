import { generateNoteId } from '../utils';
import { Note, TrackId } from '../types';

export function createInitialSequencerState() {
    const notes: Note[] = [
        { id: '1', trackId: 0, startTime: 0, duration: 0.5, valid: true },
        { id: '3', trackId: 1, startTime: 1, duration: 0.5, valid: true },
        { id: '2', trackId: 0, startTime: 2, duration: 0.5, valid: true },
        { id: '4', trackId: 2, startTime: 3, duration: 0.5, valid: true },
        { id: '5', trackId: 3, startTime: 4.5, duration: 0.5, valid: true },
    ];

    const beatsPerLoop = 8;
    const loopLength = (beatsPerLoop * 60) / 120;

    return {
        bpm: 120,
        playheadTime: 0,
        notes,
        loopLength,
        epoch: 0,
    };
}

export function addNote(notes: Note[], trackId: TrackId, startTime: number, duration: number = 0.5, valid: boolean = true): Note[] {
    const newNote: Note = {
        id: generateNoteId(),
        trackId,
        startTime,
        duration,
        valid,
    };
    console.log('New note created', newNote.id);
    return [...notes, newNote];
}

export function deleteNote(notes: Note[], noteId: string): Note[] {
    return notes.filter(n => n.id !== noteId);
}

export function updateNote(notes: Note[], noteId: string, updates: Partial<Omit<Note, 'id' | 'trackId'>>): Note[] {
    return notes.map(n => (n.id === noteId ? { ...n, ...updates } : n));
}

