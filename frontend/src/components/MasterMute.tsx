import React from 'react';
// @ts-ignore

interface MasterMuteProps {
    isMuted: boolean;
    onToggleMute: () => void;
}

export function MasterMute({ isMuted, onToggleMute }: MasterMuteProps) {
    return (
        <div className="transport-controls">
            <button
                className={`control-button master-mute-button ${isMuted ? 'muted' : ''}`}
                type="button"
                onClick={onToggleMute}
            >
                {isMuted ? 'HEAR' : 'MUTE'}
            </button>
        </div>
    );
}
