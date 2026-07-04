import React, { useEffect, useState } from 'react';
import { LightComponent } from '../components/LightComponent'; // Assuming @LightComponent is in the same directory
// import styles from './Metror1Control.module.css';

interface Metror1ControlProps {
    onM1VolumeChange: (vol: number) => void;
}

export function Metror1Control({ onM1VolumeChange }: Metror1ControlProps) {
    const [metror1Vol, setMetror1Vol] = useState(0.6);

    useEffect(() => {
        onM1VolumeChange(metror1Vol);
    }, [metror1Vol, onM1VolumeChange]);

    return (
        <div className='controls metror-control metror1-control' >
            <LightComponent triggerSignal={false} pulseLength={100} />
            <h3>SYNCOR</h3>
            <input
                className='mini-input'
                type="range"
                min="0" max="1" step="0.01"
                value={metror1Vol}
                onChange={(e) => setMetror1Vol(parseFloat(e.target.value))}
            />
        </div>
    );
}

export default Metror1Control;