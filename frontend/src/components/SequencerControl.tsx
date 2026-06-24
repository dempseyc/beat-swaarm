import React, { useEffect, useState } from 'react';
import KitSelector from './KitSelector';
import type { KitName } from './KitSelector';

interface SequencerControlProps {
    onSequencerVolumeChange: (vol: number) => void;
    selectedKit: KitName;
    onKitChange: (kit: KitName) => void;

}

export function SequencerControl({ onSequencerVolumeChange, selectedKit, onKitChange, }: SequencerControlProps) {
    const [seqVol, setSeqVol] = useState(0.6);

    useEffect(() => {
        onSequencerVolumeChange(seqVol);
    }, [seqVol, onSequencerVolumeChange]);

    return (
        <div className='controls sequencer-controls'>
            <KitSelector selectedKit={selectedKit} onKitChange={onKitChange} />
            <input
                className='mini-input'
                type="range"
                min="0" max="1" step="0.01"
                value={seqVol}
                onChange={(e) => setSeqVol(parseFloat(e.target.value))}
            />
        </div>
    );
}

export default SequencerControl;