export function generateNoteId(): string {
    return `note-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
