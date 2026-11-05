import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawCoverContained } from '@/components/visualizer/monet/monetBackgroundPipeline';
import { compressConfig, decompressConfig } from '@/utils/appearanceCodec';
import { normalizeSoftCoverTuning } from '@/types/softCover';
import { useSoftCoverSettingsStore } from '@/stores/useSoftCoverSettingsStore';
import { buildSyncedVisualSettings, readSyncableSettingsState, applySyncedVisualSettings } from '@/services/sync/settingsSnapshot';
import { buildVisualSettingsConfig } from '@/services/obs/visualSettingsConfig';

// test/unit/visualizer/completeCoverBackground.test.ts
// Exercise actual drawing bounds, independent persistence and shareable TV appearance settings.
describe('complete cover backgrounds', () => {
    beforeEach(() => {
        const data = new Map<string, string>();
        vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    });
    afterEach(() => vi.unstubAllGlobals());
    it.each([[800, 800], [600, 1200], [1800, 600]])('keeps all pixels of a %dx%d image inside the TV', (width, height) => {
        const drawImage = vi.fn();
        drawCoverContained({ drawImage } as unknown as CanvasRenderingContext2D, { width, height } as HTMLImageElement, 1920, 1080);
        const [, x, y, w, h] = drawImage.mock.calls[0];
        expect(x).toBeGreaterThan(0);
        expect(y).toBeGreaterThan(0);
        expect(x + w).toBeLessThan(1920);
        expect(y + h).toBeLessThan(1080);
        expect(w / h).toBeCloseTo(width / height);
        expect(drawImage.mock.calls[0]).toHaveLength(5); // No source cropping rectangle.
    });

    it('exports the persisted soft-cover selection and restores its parameters through both formats', () => {
        const tuning = { source: 'custom' as const, blur: 2, dim: 0.35 };
        useSoftCoverSettingsStore.getState().update(tuning);
        expect(JSON.parse(localStorage.getItem('soft_cover_tuning')!)).toEqual(tuning);
        const config = { ...buildVisualSettingsConfig(), visualizerBackgroundMode: 'soft-cover' };
        expect(decompressConfig(compressConfig(config))).toMatchObject({ visualizerBackgroundMode: 'soft-cover', softCoverTuning: tuning });
        expect(decompressConfig(JSON.stringify(config))).toMatchObject({ softCoverTuning: tuning });
        useSoftCoverSettingsStore.getState().reset();
        expect(useSoftCoverSettingsStore.getState().tuning).toEqual({ source: 'cover', blur: 3, dim: 0.28 });
    });

    it('syncs a stable snapshot and restores soft-cover values through the normal setter', () => {
        useSoftCoverSettingsStore.getState().update({ source: 'custom', blur: 5 });
        const snapshot = readSyncableSettingsState();
        useSoftCoverSettingsStore.getState().reset();
        const settings = buildSyncedVisualSettings(snapshot);
        expect(settings.softCoverTuning).toMatchObject({ source: 'custom', blur: 5 });
        applySyncedVisualSettings(readSyncableSettingsState(), { softCoverTuning: settings.softCoverTuning });
        expect(useSoftCoverSettingsStore.getState().tuning).toMatchObject({ source: 'custom', blur: 5 });
    });

    it('rejects invalid numeric input instead of rendering invisible or unbounded filters', () => {
        expect(normalizeSoftCoverTuning({ blur: Infinity, dim: NaN })).toEqual({ source: 'cover', blur: 3, dim: 0.28 });
        expect(normalizeSoftCoverTuning({ blur: 99, dim: -1 })).toEqual({ source: 'cover', blur: 12, dim: 0 });
    });
});
