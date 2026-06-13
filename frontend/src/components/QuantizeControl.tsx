import React, { useEffect } from 'react';

type QuantizeControlProps = {
    onToggle: (enabled: boolean) => void;
    onChangeDenom: (denom: number) => void;
};

export function QuantizeControl({ onToggle, onChangeDenom }: QuantizeControlProps) {
    const [enabled, setEnabled] = React.useState(false);
    const [denom, setDenom] = React.useState(8);
    useEffect(() => {
        onChangeDenom(denom);
    }, [denom, onChangeDenom]);
    useEffect(() => {
        onToggle(enabled);
    }, [enabled, onToggle]);
    return (
        <div className="quantize-controls">
            <label
                htmlFor="quantize-enable"
                style={{ color: "#fff", fontSize: "0.8rem", marginRight: 5 }}
            >
                <input
                    type="checkbox"
                    id="quantize-enable"
                    checked={enabled}
                    onChange={setEnabled.bind(null, !enabled)}
                    style={{ marginRight: 5 }}
                />
                Quantize
            </label>

            <select
                id="quantize-select"
                value={denom}
                onChange={(e) => setDenom(Number(e.target.value))}
                disabled={!enabled}
            >
                <option value={48}>1/48</option>
                <option value={32}>1/32</option>
                <option value={24}>1/24 (triplet)</option>
                <option value={16}>1/16</option>
                <option value={12}>1/12 (triplet)</option>
                <option value={8}>1/8</option>
                <option value={6}>1/6 (triplet)</option>
                <option value={4}>1/4</option>
                <option value={3}>1/3 (triplet)</option>
                <option value={2}>1/2</option>
                <option value={1}>Whole</option>
            </select>
        </div>
    );
};