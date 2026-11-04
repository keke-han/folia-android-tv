import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readTvPlaybackPosition, restoreTvPlaybackPosition, saveTvPlaybackPosition, TV_RESUME_KEY } from '../../../src/services/tvPlaybackResume';
import type { SongResult } from '../../../src/types';
// test/unit/utils/tvPlaybackResume.test.ts
const durable = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../src/services/db', () => ({ saveToCache: async (k: string, v: unknown) => { durable.set(k, v); }, getFromCache: async (k: string) => durable.get(k) ?? null }));
const song = (providerId: 'netease' | 'qq' = 'netease'): SongResult => ({ id: 1, name: 'Test', artists: [], album: { id: 1, name: 'Test' }, durationMs: 60000, sourceRef: { kind: 'online', providerId, mediaId: '1' } });
beforeEach(() => {
    durable.clear();
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
});
afterEach(() => vi.unstubAllGlobals());
describe('TV playback checkpoint', () => {
    it('persists position across reads without mixing providers sharing the same ID', () => {
        saveTvPlaybackPosition(song(), 23.5);
        expect(readTvPlaybackPosition(song())).toBe(23.5);
        expect(readTvPlaybackPosition(song('qq'))).toBe(null);
    });
    it('restores the durable position after WebView localStorage is lost', async () => {
        await saveTvPlaybackPosition(song(), 23.5);
        localStorage.setItem(TV_RESUME_KEY, 'null');
        expect(await restoreTvPlaybackPosition(song())).toBe(23.5);
    });
    it('keeps a matching durable position when the newer local copy is for another song', async () => {
        await saveTvPlaybackPosition(song(), 23.5);
        localStorage.setItem(TV_RESUME_KEY, JSON.stringify({ songKey: 'online:qq:1', position: 0, savedAt: Date.now() + 1 }));
        expect(await restoreTvPlaybackPosition(song())).toBe(23.5);
    });
    it('ignores corrupt and invalid checkpoint values', () => {
        localStorage.setItem(TV_RESUME_KEY, '{broken'); expect(readTvPlaybackPosition(song())).toBe(null);
        saveTvPlaybackPosition(song(), NaN); expect(readTvPlaybackPosition(song())).toBe(null);
        saveTvPlaybackPosition(song(), -2); expect(readTvPlaybackPosition(song())).toBe(0);
    });
});
