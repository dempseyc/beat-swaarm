export function generateNoteId(): string {
    return `note-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export function snapToGrid(time: number, denom: number, bpm: number, loopLength: number, applyJitter = false) {
    if (denom === 0) return time; // 0 means unquantized
    // denom is denominator of whole note (e.g., 16 -> 1/16)
    // whole note duration = 240 / bpm seconds
    const whole = 240 / (bpm || 120);
    const unit = whole / denom;
    let snapped = Math.max(0, Math.min(loopLength, Math.round(time / unit) * unit));
    if (applyJitter) {
        // add a tiny random delay between 0.000 and 0.002999 seconds (0 - 2.999 ms)
        const jitter = Math.random() * 0.002999;
        snapped = Math.min(loopLength, snapped + jitter);
    }
    return snapped;
}
