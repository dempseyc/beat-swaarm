import React, { useEffect, useRef, useState } from 'react';

interface MixerProps {
    onSequencerVolumeChange: (vol: number) => void;
}

export function Mixer({ onSequencerVolumeChange }: MixerProps) {
    const [seqVol, setSeqVol] = useState(1);
    const [mainVol, setMainVol] = useState(1);
    const [metror1Vol, setMetror1Vol] = useState(1);
    const [metror2Vol, setMetror2Vol] = useState(1);

    const [mainUrl, setMainUrl] = useState<string | null>(null);

    const mainAudioRef = useRef<HTMLAudioElement | null>(null);
    const m1AudioRef = useRef<HTMLAudioElement | null>(null);
    const m2AudioRef = useRef<HTMLAudioElement | null>(null);

    // Setup websocket for main loop updates
    useEffect(() => {
        const ws = new WebSocket('ws://localhost:4000');
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'main-loop-updated') {
                    console.log('Main loop updated', data.url);
                    // Add timestamp to bypass cache
                    setMainUrl(`${data.url}?t=${data.timestamp}`);
                }
            } catch (e) {
                console.error(e);
            }
        };
        return () => ws.close();
    }, []);

    useEffect(() => {
        onSequencerVolumeChange(seqVol);
    }, [seqVol, onSequencerVolumeChange]);

    useEffect(() => {
        if (mainAudioRef.current) mainAudioRef.current.volume = mainVol;
    }, [mainVol]);

    useEffect(() => {
        if (m1AudioRef.current) m1AudioRef.current.volume = metror1Vol;
    }, [metror1Vol]);

    useEffect(() => {
        if (m2AudioRef.current) m2AudioRef.current.volume = metror2Vol;
    }, [metror2Vol]);

    return (
        <div className="mixer-panel" style={{ display: 'flex', gap: '20px', padding: '20px', background: '#1a1a1a', borderRadius: '8px', marginTop: '20px' }}>
            <div className="mixer-channel">
                <h4>Local Seq</h4>
                <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={seqVol} 
                    onChange={e => setSeqVol(parseFloat(e.target.value))} 
                />
            </div>
            <div className="mixer-channel">
                <h4>Main Loop</h4>
                <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={mainVol} 
                    onChange={e => setMainVol(parseFloat(e.target.value))} 
                />
                {mainUrl && <audio ref={mainAudioRef} src={mainUrl} autoPlay loop />}
            </div>
            <div className="mixer-channel">
                <h4>Metror 01</h4>
                <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={metror1Vol} 
                    onChange={e => setMetror1Vol(parseFloat(e.target.value))} 
                />
                <audio ref={m1AudioRef} src="/audio/native-kits/metrors/METROR-01.wav" autoPlay loop />
            </div>
            <div className="mixer-channel">
                <h4>Metror 02</h4>
                <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={metror2Vol} 
                    onChange={e => setMetror2Vol(parseFloat(e.target.value))} 
                />
                <audio ref={m2AudioRef} src="/audio/native-kits/metrors/METROR-02.wav" autoPlay loop />
            </div>
        </div>
    );
}
