import React from 'react';
import { TrackId } from '../types';
import { TRACK_COLORS } from '../constants';


interface DrumPadProps {
    onPadTrigger: (trackId: TrackId) => void;
}



export function DrumPad({ onPadTrigger }: DrumPadProps) {
    const handleTrigger = (e: React.MouseEvent | React.TouchEvent, trackId: TrackId) => {
        e.preventDefault();
        onPadTrigger(trackId);
    };

    return (
        <div className="drum-pad-container" style={{ display: 'flex', width: '100%', height: '150px', marginTop: '20px', gap: '10px' }}>
            <button
                className="drum-pad accent"
                onMouseDown={e => handleTrigger(e, 0)}
                onTouchStart={e => handleTrigger(e, 0)}
                style={{ flex: 1, backgroundColor: TRACK_COLORS[0], border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
            >
                Accent (0)
            </button>
            <button
                className="drum-pad left"
                onMouseDown={e => handleTrigger(e, 1)}
                onTouchStart={e => handleTrigger(e, 1)}
                style={{ flex: 3, backgroundColor: TRACK_COLORS[1], border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
            >
                Left (1)
            </button>
            <button
                className="drum-pad right"
                onMouseDown={e => handleTrigger(e, 2)}
                onTouchStart={e => handleTrigger(e, 2)}
                style={{ flex: 3, backgroundColor: TRACK_COLORS[2], border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
            >
                Right (2)
            </button>
            <button
                className="drum-pad tap"
                onMouseDown={e => handleTrigger(e, 3)}
                onTouchStart={e => handleTrigger(e, 3)}
                style={{ flex: 1, backgroundColor: TRACK_COLORS[3], border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
            >
                Tap (3)
            </button>
        </div>
    );
}
