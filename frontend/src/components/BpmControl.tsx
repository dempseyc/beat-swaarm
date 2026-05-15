import React from 'react';

interface BpmControlProps {
    bpm: number;
    onChangeBpm: (value: number) => void;
}

export function BpmControl({ bpm, onChangeBpm }: BpmControlProps) {
    return (
        <div className="bpm-control">
            <label htmlFor="bpm">BPM</label>
            <input
                id="bpm"
                type="range"
                min="60"
                max="180"
                value={bpm}
                onChange={event => onChangeBpm(Number(event.target.value))}
            />
            <span>{bpm}</span>
        </div>
    );
}
