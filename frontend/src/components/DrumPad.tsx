import React from 'react';
import { TrackId } from '../types';
import { TRACK_COLORS } from '../constants';


interface DrumPadProps {
    onPadTrigger: (trackId: TrackId, recording: boolean) => void;
    isMuted?: boolean;
    overwrite?: boolean;
    handleOverwriteToggle: () => void;
}



export function DrumPad({ onPadTrigger, isMuted, overwrite = false, handleOverwriteToggle }: DrumPadProps) {
    const [recording, setRecording] = React.useState(true);
    const handleTrigger = (e: React.MouseEvent | React.TouchEvent, trackId: TrackId) => {
        e.preventDefault();
        onPadTrigger(trackId, recording);
    };

    return (
        <div className="drum-pad-container">
            <div className="drum-pad-controls">
                <button style={{ color: recording && !isMuted ? '#e04f5f' : '#222', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'white', fontWeight: 'bold' }} onClick={() => setRecording(!recording)}>
                    REC+
                </button>
                <button style={{ color: overwrite && !isMuted ? '#e04f5f' : '#222', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'white', fontWeight: 'bold' }} onClick={handleOverwriteToggle}>
                    OVER
                </button>
            </div>
            <button
                className="drum-pad accent"
                onMouseDown={e => handleTrigger(e, 0)}
                onTouchStart={e => handleTrigger(e, 0)}
                style={{ flex: 1, backgroundColor: TRACK_COLORS[0], border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
            >
                A            </button>
            <button
                className="drum-pad left"
                onMouseDown={e => handleTrigger(e, 1)}
                onTouchStart={e => handleTrigger(e, 1)}
                style={{ flex: 3, backgroundColor: TRACK_COLORS[1], border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
            >
                S            </button>
            <button
                className="drum-pad right"
                onMouseDown={e => handleTrigger(e, 2)}
                onTouchStart={e => handleTrigger(e, 2)}
                style={{ flex: 3, backgroundColor: TRACK_COLORS[2], border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
            >
                D            </button>
            <button
                className="drum-pad tap"
                onMouseDown={e => handleTrigger(e, 3)}
                onTouchStart={e => handleTrigger(e, 3)}
                style={{ flex: 1, backgroundColor: TRACK_COLORS[3], border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
            >
                F            </button>
        </div>
    );
}
