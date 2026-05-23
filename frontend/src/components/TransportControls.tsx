import React from 'react';
// @ts-ignore
import './TransportControls.css';

interface TransportControlsProps {
    isMuted: boolean;
    onToggleMute: () => void;
}

export function TransportControls({ isMuted, onToggleMute }: TransportControlsProps) {
    return (
        <div className="transport-controls">
            <button
                className={`transport-button ${isMuted ? 'muted' : ''}`}
                type="button"
                onClick={onToggleMute}
            >
                <div className="speaker-icon">
                    {isMuted ? '🔇' : '🔊'}
                </div>
                <span>{isMuted ? 'Muted' : 'Live'}</span>
            </button>
        </div>
    );
}
