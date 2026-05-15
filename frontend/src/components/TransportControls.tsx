import React from 'react';

interface TransportControlsProps {
    isPlaying: boolean;
    onTogglePlay: () => void;
}

export function TransportControls({ isPlaying, onTogglePlay }: TransportControlsProps) {
    return (
        <div className="transport-controls">
            <button className="transport-button" type="button" onClick={onTogglePlay}>
                {isPlaying ? 'Pause' : 'Play'}
            </button>
        </div>
    );
}
