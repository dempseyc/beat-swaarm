import React from 'react';
import { TRACK_IDS, TrackId, Note } from '../types';
import './SequencerGrid.css';

interface SequencerGridProps {
    notes: Note[];
    currentTime: number;
    onNotesChange: (notes: Note[]) => void;
}

const LABELS: Record<TrackId, string> = {
    0: 'Track 1',
    1: 'Track 2',
    2: 'Track 3',
    3: 'Track 4',
};

export function SequencerGrid({ notes, currentTime, onNotesChange }: SequencerGridProps) {
    return (
        <div className="sequencer-grid" role="grid" aria-label="Drum sequencer">
            {TRACK_IDS.map(track => (
                <div key={track} className="sequencer-row" role="row">
                    <div className="track-label">{LABELS[track]}</div>
                    <div className="step-row" role="rowgroup">
                        {/* Piano roll notes would be rendered here */}
                    </div>
                </div>
            ))}
        </div>
    );
}
