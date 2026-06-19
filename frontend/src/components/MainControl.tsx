import React, { useEffect, useState } from 'react';
// import styles from './@MainControl.module.css';

interface MainControlProps {
    onMainVolumeChange: (vol: number) => void;
    playheadTime: number;
}

export function MainControl({ onMainVolumeChange, playheadTime }: MainControlProps) {
    const [mainVol, setMainVol] = useState(0.6);

    useEffect(() => {
        onMainVolumeChange(mainVol);
    }, [mainVol, onMainVolumeChange]);

    return (
        <div className='mixer-channel'>
            <h1>{playheadTime.toFixed(2)}</h1>
            <h4>Swarm</h4>
            <input
                type="range"
                min="0" max="1" step="0.01"
                value={mainVol}
                onChange={(e) => setMainVol(parseFloat(e.target.value))}
            />
        </div>
    );
}

export default MainControl;