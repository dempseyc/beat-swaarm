import React, { useEffect, useState } from 'react';
import styles from './KitSelector.module.css';

export type KitName = 'haand' | 'drumm' | 'tiiine' | 'piaano' | 'thumpp' | 'pllluk' | 'bipp' | 'blokk' | 'boingg' | 'craigg';

const KIT_LABELS: Record<KitName, string> = {
    haand: 'HAAND',
    tiiine: 'TIIINE',
    drumm: 'DRUMM',
    piaano: 'PIAANO',
    thumpp: 'THUMPP',
    pllluk: 'PLLLUK',
    bipp: 'BIPP',
    blokk: 'BLOKK',
    boingg: 'BOINGG',
    craigg: '80CRAIGG',
};

interface KitSelectorProps {
    selectedKit: KitName;
    onKitChange: (kit: KitName) => void;
}

export function KitSelector({ selectedKit, onKitChange }: KitSelectorProps) {
    const [kitLoading, setKitLoading] = useState(false);

    useEffect(() => {
        setKitLoading(true);
        const timer = setTimeout(() => {
            setKitLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
    }, [selectedKit]);

    return (<div className="control kit-selector">
        <select
            style={{ display: kitLoading ? 'none' : 'block' }}
            value={selectedKit}
            onChange={e => onKitChange(e.target.value as KitName)}
        >
            {Object.entries(KIT_LABELS).map(([kit, label]) => (
                <option key={kit} value={kit}>
                    {label}
                </option>
            ))}
        </select>
        <span className="kit-loading" style={{ visibility: kitLoading ? 'visible' : 'hidden' }}>
            {kitLoading ? 'Loading…' : ''}
        </span>
    </div>);
}

export default KitSelector;