import React, { useEffect, useState } from 'react';
// import styles from './SequencerControl.module.css';
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
        <div className='sequencer-control' style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}>
            <KitSelector selectedKit={selectedKit} onKitChange={onKitChange} />
            <input
                type="range"
                min="0" max="1" step="0.01"
                value={seqVol}
                onChange={(e) => setSeqVol(parseFloat(e.target.value))}
            />
        </div>
    );
}

export default SequencerControl;