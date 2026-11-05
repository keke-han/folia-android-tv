import { create } from 'zustand';
import { DEFAULT_SOFT_COVER_TUNING, normalizeSoftCoverTuning, type SoftCoverTuning } from '../types/softCover';

// src/stores/useSoftCoverSettingsStore.ts
// Keeps soft-cover parameters independent of Monet and survives TV restarts.
const STORAGE_KEY = 'soft_cover_tuning';
const read = (): SoftCoverTuning => {
    try { return normalizeSoftCoverTuning(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
    catch { return { ...DEFAULT_SOFT_COVER_TUNING }; }
};

export const useSoftCoverSettingsStore = create<{
    tuning: SoftCoverTuning;
    update: (patch: Partial<SoftCoverTuning>) => void;
    reset: () => void;
}>((set, get) => ({
    tuning: read(),
    update: patch => {
        const tuning = normalizeSoftCoverTuning({ ...get().tuning, ...patch });
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning)); } catch { /* Retain session settings if storage is full. */ }
        set({ tuning });
    },
    reset: () => get().update(DEFAULT_SOFT_COVER_TUNING),
}));
