import React, { useEffect, useState } from 'react';
// import styles from './@MainControl.module.css';

interface MainControlProps {
    onMainVolumeChange: (vol: number) => void;
}

export function MainControl({ onMainVolumeChange }: MainControlProps) {
    const [mainVol, setMainVol] = useState(0.6);

    useEffect(() => {
        onMainVolumeChange(mainVol);
    }, [mainVol, onMainVolumeChange]);

    return (
        <div className='controls'>
            <h4>SWAARM</h4>
            <input
                className='mini-input'
                type="range"
                min="0" max="1" step="0.01"
                value={mainVol}
                onChange={(e) => setMainVol(parseFloat(e.target.value))}
            />
        </div>
    );
}

export default MainControl;