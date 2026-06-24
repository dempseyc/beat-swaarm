import React from 'react';
// @ts-ignore

interface MasterMuteProps {
    isMuted: boolean;
    onToggleMute: () => void;
}

export function MasterMute({ isMuted, onToggleMute }: MasterMuteProps) {
    return (
        <button
            className={`control-button master-mute-button ${!isMuted ? 'active' : ''}`}
            type="button"
            onClick={onToggleMute}
        >
            {isMuted ? 'PLAY' : 'MUTE'}
        </button>
    );
}
