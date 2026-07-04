import React from 'react';
import { TrackId } from '../types';
import { TRACK_COLORS } from '../constants';
import { usePointerInput } from '../hooks/usePointerInput';


interface DrumPadProps {
    onPadTrigger: (trackId: TrackId, recording: boolean, duration?: number, startTime?: number) => void;
    isMuted?: boolean;
    overwrite?: boolean;
    handleOverwriteToggle: () => void;
    getCurrentPlayheadTime: () => number;
}

export function DrumPad({ onPadTrigger, isMuted, overwrite = false, handleOverwriteToggle, getCurrentPlayheadTime }: DrumPadProps) {
    const [recording, setRecording] = React.useState(true);
    const recordingRef = React.useRef(recording);
    const activePressesRef = React.useRef<Map<TrackId, number>>(new Map());
    const activeKeyPressesRef = React.useRef<Record<string, number>>({});
    const activeNoteIdsRef = React.useRef<Map<TrackId, string>>(new Map());

    React.useEffect(() => {
        recordingRef.current = recording;
    }, [recording]);

    const startPad = (trackId: TrackId) => {
        console.log('startPad', { trackId, alreadyActive: activePressesRef.current.has(trackId) });
        if (activePressesRef.current.has(trackId)) return;
        activePressesRef.current.set(trackId, performance.now() / 1000);
        onPadTrigger(trackId, recordingRef.current, 0, getCurrentPlayheadTime());
    };

    const endPad = (trackId: TrackId) => {
        const startedAt = activePressesRef.current.get(trackId);
        activePressesRef.current.delete(trackId);
        if (startedAt === undefined) {
            console.log('endPad skipped because no start', { trackId });
            return;
        }

        const duration = Math.max(0.05, (performance.now() / 1000) - startedAt);
        console.log('endPad', { trackId, duration });
        onPadTrigger(trackId, recordingRef.current, duration, getCurrentPlayheadTime());
    };

    React.useEffect(() => {
        const keyToTrack: Record<string, TrackId> = { a: 0, s: 1, d: 2, f: 3 };

        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            const trackId = keyToTrack[key];
            if (trackId === undefined || event.repeat) return;

            activeKeyPressesRef.current[key] = performance.now() / 1000;
            event.preventDefault();
            onPadTrigger(trackId, recordingRef.current, 0, getCurrentPlayheadTime());
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            const trackId = keyToTrack[key];
            if (trackId === undefined) return;

            const startedAt = activeKeyPressesRef.current[key];
            delete activeKeyPressesRef.current[key];
            if (startedAt === undefined) return;

            const duration = Math.max(0.05, (performance.now() / 1000) - startedAt);
            event.preventDefault();
            onPadTrigger(trackId, recordingRef.current, duration, getCurrentPlayheadTime());
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [onPadTrigger]);

    const { createPointerHandlers, pointerStyle } = usePointerInput();

    const makePadHandlers = (trackId: TrackId) =>
        createPointerHandlers({
            onDown: () => startPad(trackId),
            onUp: () => endPad(trackId),
            onCancel: () => endPad(trackId),
            stopPropagation: true,
        });

    return (
        <div className="drum-pad-container" style={{ touchAction: 'none' }}>
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
                {...makePadHandlers(0)}
                style={{ ...pointerStyle, flex: 1, backgroundColor: TRACK_COLORS[0], border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
            >
                A            </button>
            <button
                className="drum-pad left"
                {...makePadHandlers(1)}
                style={{ flex: 3, backgroundColor: TRACK_COLORS[1], border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
            >
                S            </button>
            <button
                className="drum-pad right"
                {...makePadHandlers(2)}
                style={{ flex: 3, backgroundColor: TRACK_COLORS[2], border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
            >
                D            </button>
            <button
                className="drum-pad tap"
                {...makePadHandlers(3)}
                style={{ flex: 1, backgroundColor: TRACK_COLORS[3], border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
            >
                F            </button>
        </div>
    );
}
