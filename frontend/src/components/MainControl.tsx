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
        <div className='mixer-channel' style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}>
            <h4>Main Loop Volume</h4>
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