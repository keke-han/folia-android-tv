// src/types/softCover.ts
// Independent, shareable settings for the complete-cover background.
export interface SoftCoverTuning {
    source: 'cover' | 'custom';
    blur: number;
    dim: number;
}

// Keep saved slider values while making the soft-cover treatment three times clearer.
export const SOFT_COVER_BLUR_SCALE = 1 / 3;

export const DEFAULT_SOFT_COVER_TUNING: SoftCoverTuning = { source: 'cover', blur: 3, dim: 0.28 };

export function normalizeSoftCoverTuning(value: Partial<SoftCoverTuning> | null | undefined): SoftCoverTuning {
    const finite = (value: unknown, fallback: number, max: number) =>
        typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback;
    return {
        source: value?.source === 'custom' ? 'custom' : 'cover',
        blur: finite(value?.blur, DEFAULT_SOFT_COVER_TUNING.blur, 12),
        dim: finite(value?.dim, DEFAULT_SOFT_COVER_TUNING.dim, 0.8),
    };
}
