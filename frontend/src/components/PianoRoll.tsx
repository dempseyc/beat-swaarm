import React, { useRef, useState } from 'react';
import { Note, TrackId, TRACK_IDS } from '../types';
import { addNote, deleteNote, updateNote } from '../state/sequencer';
// @ts-ignore
import './PianoRoll.css';

interface PianoRollProps {
    notes: Note[];
    playheadTime: number;
    loopLength: number;
    onNotesChange: (notes: Note[]) => void;
    bpm: number;
}

const PIXELS_PER_SECOND = 160;
const TRACK_HEIGHT = 60;

interface DragState {
    type: 'move' | 'resizeStart' | 'resizeEnd' | null;
    noteId: string | null;
    startX: number;
    originalStartTime: number;
    originalDuration: number;
}

export function PianoRoll({ notes, playheadTime, loopLength, onNotesChange, bpm }: PianoRollProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [dragState, setDragState] = useState<DragState>({
        type: null,
        noteId: null,
        startX: 0,
        originalStartTime: 0,
        originalDuration: 0,
    });
    const [quantizeDenom, setQuantizeDenom] = useState<number>(16); // default 1/16

    const timelineWidth = loopLength * PIXELS_PER_SECOND;

    const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>, trackId: TrackId) => {
        if (e.button !== 0) return;

        const rect = scrollRef.current?.getBoundingClientRect();
        if (!rect) return;

        const clickX = e.clientX - rect.left;
        const startTime = clickX / PIXELS_PER_SECOND;

        if (startTime >= 0 && startTime < loopLength) {
            const snapped = snapToGrid(startTime, quantizeDenom, true);
            const newNotes = addNote(notes, trackId, snapped);
            onNotesChange(newNotes);
        }
    };

    function snapToGrid(time: number, denom: number, applyJitter = false) {
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

    const handleNoteDoubleClick = (e: React.MouseEvent, noteId: string) => {
        e.stopPropagation();
        const newNotes = deleteNote(notes, noteId);
        onNotesChange(newNotes);
    };

    const handleMouseDown = (e: React.MouseEvent, noteId: string, resizeType: 'start' | 'end' | null) => {
        if (e.button !== 0) return;
        e.preventDefault();

        const rect = scrollRef.current?.getBoundingClientRect();
        if (!rect) return;

        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        const dragType = resizeType === 'start' ? 'resizeStart' : resizeType === 'end' ? 'resizeEnd' : 'move';

        setDragState({
            type: dragType,
            noteId,
            startX: e.clientX,
            originalStartTime: note.startTime,
            originalDuration: note.duration,
        });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!dragState.type || !dragState.noteId) return;

        const rect = scrollRef.current?.getBoundingClientRect();
        if (!rect) return;

        const deltaX = e.clientX - dragState.startX;
        const deltaTime = deltaX / PIXELS_PER_SECOND;

        const note = notes.find(n => n.id === dragState.noteId);
        if (!note) return;

        let newStartTime = dragState.originalStartTime;
        let newDuration = dragState.originalDuration;

        if (dragState.type === 'move') {
            newStartTime = Math.max(0, Math.min(dragState.originalStartTime + deltaTime, loopLength));
            // apply quantize snapping
            newStartTime = snapToGrid(newStartTime, quantizeDenom, true);
        } else if (dragState.type === 'resizeStart') {
            const newStart = dragState.originalStartTime + deltaTime;
            const maxStart = dragState.originalStartTime + dragState.originalDuration - 0.05;
            newStartTime = Math.max(0, Math.min(newStart, maxStart));
            newDuration = dragState.originalDuration - (newStartTime - dragState.originalStartTime);
            // snap start and duration to grid
            newStartTime = snapToGrid(newStartTime, quantizeDenom, true);
            const unit = 240 / (bpm || 120) / quantizeDenom;
            newDuration = Math.max(0.05, Math.round(newDuration / unit) * unit);
        } else if (dragState.type === 'resizeEnd') {
            const newEnd = dragState.originalStartTime + dragState.originalDuration + deltaTime;
            const maxEnd = loopLength;
            newDuration = Math.max(0.05, Math.min(newEnd, maxEnd) - dragState.originalStartTime);
            // snap end/duration to grid, with jitter for natural feel
            const endTime = snapToGrid(dragState.originalStartTime + newDuration, quantizeDenom, true);
            newDuration = Math.max(0.05, endTime - dragState.originalStartTime);
        }

        const updatedNotes = updateNote(notes, dragState.noteId, {
            startTime: newStartTime,
            duration: newDuration,
        });
        onNotesChange(updatedNotes);
    };

    const handleMouseUp = () => {
        setDragState({ type: null, noteId: null, startX: 0, originalStartTime: 0, originalDuration: 0 });
    };

    const trackNotes = TRACK_IDS.map(trackId => notes.filter(n => n.trackId === trackId));

    return (
        <div
            className="piano-roll"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div className="piano-roll-toolbar">
                <label htmlFor="quantize-select">Quantize</label>
                <select
                    id="quantize-select"
                    value={quantizeDenom}
                    onChange={e => setQuantizeDenom(Number(e.target.value))}
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
            <div className="piano-roll-header">
                <div className="piano-roll-timeline">
                    {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="piano-roll-time-marker" style={{ left: `${(i / 8) * loopLength * PIXELS_PER_SECOND}px` }}>
                            {i}
                        </div>
                    ))}
                </div>
            </div>

            <div className="piano-roll-tracks">
                {TRACK_IDS.map(trackId => (
                    <div
                        key={trackId}
                        className="piano-roll-track-row"
                        style={{ height: TRACK_HEIGHT }}
                        onDoubleClick={e => handleDoubleClick(e, trackId)}
                    >
                        <div
                            ref={trackId === 0 ? scrollRef : undefined}
                            className="piano-roll-track-content"
                            style={{
                                width: timelineWidth,
                                height: TRACK_HEIGHT,
                                position: 'relative',
                            }}
                        >
                            {trackNotes[trackId].map(note => (
                                <div
                                    key={note.id}
                                    className="piano-roll-note"
                                    style={{
                                        left: `${note.startTime * PIXELS_PER_SECOND}px`,
                                        width: `${note.duration * PIXELS_PER_SECOND}px`,
                                        height: '100%',
                                    }}
                                    onDoubleClick={e => handleNoteDoubleClick(e, note.id)}
                                    onMouseDown={e => handleMouseDown(e, note.id, null)}
                                >
                                    <div
                                        className="piano-roll-note-resize-start"
                                        onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, note.id, 'start'); }}
                                    />
                                    <div className="piano-roll-note-content">{note.id.substring(0, 6)}</div>
                                    <div
                                        className="piano-roll-note-resize-end"
                                        onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, note.id, 'end'); }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                <div
                    className="piano-roll-playhead"
                    style={{
                        left: `${playheadTime * PIXELS_PER_SECOND}px`,
                    }}
                />
            </div>
        </div>
    );
}
