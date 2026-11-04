import type { SongResult } from '../types';
import { getPlaybackSongKey, isStagePlaybackSong } from '../utils/appPlaybackGuards';
import { getFromCache, saveToCache } from './db';
// src/services/tvPlaybackResume.ts
// The DB checkpoint survives a killed WebView; localStorage also provides an immediate warm-session copy.
export const TV_RESUME_KEY = 'folia_tv_playback_position_v1';
export const TV_RESUME_CACHE_KEY = 'tv_playback_position';
type Checkpoint = { songKey: string; position: number; savedAt: number };

const localCheckpoint = (): Checkpoint | null => {
    try { return JSON.parse(localStorage.getItem(TV_RESUME_KEY) ?? 'null'); } catch { return null; }
};
const positionFor = (saved: Checkpoint | null, song: SongResult): number | null =>
    saved?.songKey === getPlaybackSongKey(song) && typeof saved.position === 'number'
        && Number.isFinite(saved.position) && saved.position >= 0 ? saved.position : null;

export const saveTvPlaybackPosition = (song: SongResult | null, position: number): Promise<void> => {
    if (!song || isStagePlaybackSong(song) || !Number.isFinite(position)) return Promise.resolve();
    const saved = { songKey: getPlaybackSongKey(song), position: Math.max(0, position), savedAt: Date.now() };
    try { localStorage.setItem(TV_RESUME_KEY, JSON.stringify(saved)); } catch { /* The durable copy still works without localStorage. */ }
    return saveToCache(TV_RESUME_CACHE_KEY, saved);
};

export const readTvPlaybackPosition = (song: SongResult): number | null => positionFor(localCheckpoint(), song);

/** Prefer the newest durable or immediate checkpoint, never a position belonging to another song. */
export const restoreTvPlaybackPosition = async (song: SongResult): Promise<number | null> => {
    const durable = await getFromCache<Checkpoint>(TV_RESUME_CACHE_KEY);
    const local = localCheckpoint();
    const candidates = [local, durable].filter((saved): saved is Checkpoint => saved !== null && positionFor(saved, song) !== null);
    candidates.sort((a, b) => (Number.isFinite(b.savedAt) ? b.savedAt : 0) - (Number.isFinite(a.savedAt) ? a.savedAt : 0));
    return positionFor(candidates[0] ?? null, song);
};
