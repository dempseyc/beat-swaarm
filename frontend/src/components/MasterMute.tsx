import React from 'react';
// @ts-ignore
import './MasterMute.css';

interface MasterMuteProps {
    isMuted: boolean;
    onToggleMute: () => void;
}

export function MasterMute({ isMuted, onToggleMute }: MasterMuteProps) {
    return (
        <div className="transport-controls">
            <button
                className={`master-mute-button ${isMuted ? 'muted' : ''}`}
                type="button"
                onClick={onToggleMute}
            >
                <div className="speaker-icon">
                    {isMuted ? '\\0\\' : '/•/'}
                </div>
                <span>{isMuted ? 'Play' : 'Mute'}</span>
            </button>
        </div>
    );
}
