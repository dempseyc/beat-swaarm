import React, { useEffect, useState } from 'react';
import { LightComponent } from '../components/LightComponent'; // Assuming @LightComponent is in the same directory
// import styles from './Metror2Control.module.css';

interface Metror2ControlProps {
    onM2VolumeChange: (vol: number) => void;
}

export function Metror2Control({ onM2VolumeChange }: Metror2ControlProps) {
    const [metror2Vol, setMetror2Vol] = useState(0.6);

    useEffect(() => {
        onM2VolumeChange(metror2Vol);
    }, [metror2Vol, onM2VolumeChange]);

    return (
        <div className='control metror-control metror2-control' style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}  >
            <LightComponent triggerSignal={false} pulseLength={100} />
            <h4>Metror 02 Volume</h4>
            <input
                type="range"
                min="0" max="1" step="0.01"
                value={metror2Vol}
                onChange={(e) => setMetror2Vol(parseFloat(e.target.value))}
            />
        </div>
    );
}

export default Metror2Control;