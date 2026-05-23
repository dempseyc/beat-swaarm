import React from 'react';

interface BpmControlProps {
    bpm: number;
}

export function BpmControl({ bpm }: BpmControlProps) {
    return (
        <div className="bpm-control" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>BPM</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>{bpm}</span>
        </div>
    );
}
