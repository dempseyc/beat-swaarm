import React, { useEffect, useRef, useState } from 'react';
import { Note, TrackId, TRACK_IDS } from '../types';
import { addNote, deleteNote, updateNote } from '../state/sequencer';
import { TRACK_COLORS } from '../constants';
import { usePointerInput, NormalizedPointerEvent } from '../hooks/usePointerInput';
// ts-ignore for CSS import
// @ts-ignore
import './PianoRoll.css';

interface PianoRollProps {
    notes: Note[];
    playheadTime: number;
    loopLength: number;
    onNotesChange: (notes: Note[]) => void;
    bpm: number;
    quantizeDenom?: number;
    overwrite?: boolean;
}

interface DragState {
    type: 'move' | 'resizeStart' | 'resizeEnd' | null;
    noteId: string | null;
    startX: number;
    originalStartTime: number;
    originalDuration: number;
}

export function PianoRoll({ notes, playheadTime, loopLength, onNotesChange, bpm, quantizeDenom = 0, overwrite }: PianoRollProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [dragState, setDragState] = useState<DragState>({
        type: null,
        noteId: null,
        startX: 0,
        originalStartTime: 0,
        originalDuration: 0,
    });
    const activeQuantizeDenom = quantizeDenom > 0 ? quantizeDenom : 16;

    const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement> | NormalizedPointerEvent, trackId: TrackId) => {
        // Accept either mouse double-click event or our normalized pointer double-tap
        const button = (e as any).button;
        if (button !== 0) return;

        const rect = scrollRef.current?.getBoundingClientRect();
        if (!rect) return;

        const clientX = (e as any).clientX as number;
        const clickX = clientX - rect.left;
        const width = rect.width;
        const startTime = (clickX / width) * loopLength;

        if (startTime >= 0 && startTime < loopLength) {
            const snapped = snapToGrid(startTime, activeQuantizeDenom, true);
            const newNotes = addNote(notes, trackId, snapped, activeQuantizeDenom > 0 ? 2 / activeQuantizeDenom : 0.5);
            onNotesChange(newNotes);
        }
    };

    function snapToGrid(time: number, denom: number, applyJitter = true) {
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

    const { createPointerHandlers, pointerStyle } = usePointerInput();

    const handlePointerDown = (event: NormalizedPointerEvent, noteId: string, resizeType: 'start' | 'end' | null) => {
        if (event.button !== 0) return;
        event.originalEvent.preventDefault();
        const rect = scrollRef.current?.getBoundingClientRect();
        if (!rect) return;

        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        const dragType = resizeType === 'start' ? 'resizeStart' : resizeType === 'end' ? 'resizeEnd' : 'move';

        setDragState({
            type: dragType,
            noteId,
            startX: event.clientX,
            originalStartTime: note.startTime,
            originalDuration: note.duration,
        });
    };

    const handlePointerMove = (e: NormalizedPointerEvent) => {
        if (!dragState.type || !dragState.noteId) return;

        const rect = scrollRef.current?.getBoundingClientRect();
        if (!rect) return;

        const deltaX = e.clientX - dragState.startX;
        const width = rect.width;
        const deltaTime = (deltaX / width) * loopLength;

        const note = notes.find(n => n.id === dragState.noteId);
        if (!note) return;

        let newStartTime = dragState.originalStartTime;
        let newDuration = dragState.originalDuration;

        if (dragState.type === 'move') {
            newStartTime = Math.max(0, Math.min(dragState.originalStartTime + deltaTime, loopLength));
            // apply quantize snapping
            newStartTime = snapToGrid(newStartTime, activeQuantizeDenom, true);
        } else if (dragState.type === 'resizeStart') {
            const newStart = dragState.originalStartTime + deltaTime;
            const maxStart = dragState.originalStartTime + dragState.originalDuration - 0.05;
            newStartTime = Math.max(0, Math.min(newStart, maxStart));
            newDuration = dragState.originalDuration - (newStartTime - dragState.originalStartTime);
            // snap start and duration to grid
            newStartTime = snapToGrid(newStartTime, activeQuantizeDenom, true);
            const unit = 240 / (bpm || 120) / activeQuantizeDenom;
            newDuration = Math.max(0.05, Math.round(newDuration / unit) * unit);
        } else if (dragState.type === 'resizeEnd') {
            const newEnd = dragState.originalStartTime + dragState.originalDuration + deltaTime;
            const maxEnd = loopLength;
            newDuration = Math.max(0.05, Math.min(newEnd, maxEnd) - dragState.originalStartTime);
            // snap end/duration to grid, with jitter for natural feel
            const endTime = snapToGrid(dragState.originalStartTime + newDuration, activeQuantizeDenom, true);
            newDuration = Math.max(0.05, endTime - dragState.originalStartTime);
        }

        const updatedNotes = updateNote(notes, dragState.noteId, {
            startTime: newStartTime,
            duration: newDuration,
        });
        onNotesChange(updatedNotes);
    };

    const handlePointerUp = (_e?: NormalizedPointerEvent) => {
        setDragState({ type: null, noteId: null, startX: 0, originalStartTime: 0, originalDuration: 0 });
    };

    const trackNotes = TRACK_IDS.map(trackId => notes.filter(n => n.trackId === trackId));

    return (
        <div
            className="piano-roll flex-row"
            {...createPointerHandlers({
                onMove: handlePointerMove,
                onUp: handlePointerUp,
                onCancel: handlePointerUp,
                stopPropagation: false,
                capture: true,
            })}
            style={{ touchAction: 'none' }}
        >
            <div className="clear-notes-button-container">
                <button
                    className="clear-notes-button clear-all-notes-button"
                    onClick={() => onNotesChange([])}
                >
                    X
                </button>
                {TRACK_IDS.reverse().map((trackId) => (
                    <button
                        key={trackId}
                        className="clear-notes-button clear-track-notes-button"
                        onClick={() => onNotesChange(notes.filter(n => n.trackId !== trackId))}
                    >
                        X
                    </button>
                ))}
            </div>
            <div className="piano-roll-tracks-container">
                <div className="piano-roll-tracks">
                    <div className="piano-roll-track-row piano-roll-timeline">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="piano-roll-time-marker" style={{ left: `${(i / 4) * 100}%` }}>
                                {i + 1}
                            </div>
                        ))}
                    </div>

                    {TRACK_IDS.map(trackId => (
                        <div
                            key={trackId}
                            className="piano-roll-track-row"
                            onDoubleClick={e => handleDoubleClick(e, trackId)}
                            {...createPointerHandlers({
                                onDoubleClick: (ev) => { if (ev.pointerType !== 'mouse') handleDoubleClick(ev, trackId); },
                                stopPropagation: false,
                                capture: false,
                            })}
                        >
                            <div
                                ref={trackId === 0 ? scrollRef : undefined}
                                className="piano-roll-track-content"
                            >
                                {trackNotes[trackId].map(note => {
                                    const noteStyle: React.CSSProperties = {
                                        ...pointerStyle,
                                        left: `${(note.startTime / loopLength) * 100}%`,
                                        width: `${(note.duration / loopLength) * 100}%`,
                                        height: '50%',
                                        top: '25%',
                                        backgroundColor: TRACK_COLORS[trackId]
                                    };

                                    return (
                                        <div
                                            key={note.id}
                                            className="piano-roll-note"
                                            style={noteStyle}
                                            onDoubleClick={e => handleNoteDoubleClick(e, note.id)}
                                            {...createPointerHandlers({
                                                onDown: e => handlePointerDown(e, note.id, null),
                                                stopPropagation: true,
                                                capture: false,
                                            })}
                                        >
                                            <div
                                                className="piano-roll-note-resize-start"
                                                {...createPointerHandlers({
                                                    onDown: e => { e.originalEvent.stopPropagation(); handlePointerDown(e, note.id, 'start'); },
                                                    stopPropagation: true,
                                                    capture: false,
                                                })}
                                            />
                                            <div
                                                className="piano-roll-note-resize-end"
                                                {...createPointerHandlers({
                                                    onDown: e => { e.originalEvent.stopPropagation(); handlePointerDown(e, note.id, 'end'); },
                                                    stopPropagation: true,
                                                    capture: false,
                                                })}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div
                        className="piano-roll-playhead"
                        style={{
                            left: `${(playheadTime / loopLength) * 100}%`,
                        }}
                    />
                </div >

            </div>
        </div>
    );
}
