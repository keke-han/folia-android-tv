import { test, expect, type Page } from '@playwright/test';
import { installBaseState, mockNeteaseApi } from './helpers/appFixtures';
import { APP_VERSION, GUIDE_VERSION_STORAGE_KEY, waitForAppMounted } from '../helpers/appState';
// test/ui/androidTvPlayback.spec.ts
// Exercises held remote keys and warm/cold resume with an actual cached PCM audio file.

test.use({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });

const seedAudio = async (page: Page, count = 1) => {
    const pcm = Buffer.alloc(44 + 8000 * 60 * 2);
    pcm.write('RIFF'); pcm.writeUInt32LE(pcm.length - 8, 4); pcm.write('WAVEfmt ', 8);
    pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
    pcm.writeUInt32LE(8000, 24); pcm.writeUInt32LE(16000, 28); pcm.writeUInt16LE(2, 32);
    pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(pcm.length - 44, 40);
    await page.evaluate(async ({ source, count }) => {
        const storePath = '/src/stores/usePlaybackStore.ts';
        const cachePath = '/src/services/audioCache.ts';
        const keysPath = '/src/services/onlineMusic/resourceKeys.ts';
        const dbPath = '/src/services/db.ts';
        const { saveToCache } = await import(dbPath);
        const lyricPath = '/src/stores/useLyricSettingsStore.ts';
        const { useLyricSettingsStore } = await import(lyricPath);
        useLyricSettingsStore.setState({ autoUseBestLyric: false });
        const persistPath = '/src/components/app/playback/persistPlaybackCache.ts';
        const { usePlaybackStore } = await import(storePath);
        const { saveAudioBlob } = await import(cachePath);
        const { getSongResourceCacheKey } = await import(keysPath);
        const { persistPlaybackCache } = await import(persistPath);
        const song = { id: 87654, name: 'TV resume test', artists: [{ id: 1, name: 'Test' }], album: { id: 1, name: 'Test' }, durationMs: 60000,
            sourceRef: { kind: 'online', providerId: 'netease', mediaId: 87654 } };
        const queue = Array.from({ length: count }, (_, i) => ({ ...song, id: song.id + i, name: `${song.name} ${i + 1}`, sourceRef: { ...song.sourceRef, mediaId: String(song.id + i) } }));
        const blob = await (await fetch(source)).blob();
        await Promise.all(queue.map(track => saveAudioBlob(getSongResourceCacheKey('audio', track), blob)));
        await Promise.all(queue.map(track => saveToCache(getSongResourceCacheKey('lyric', track), { lines: [{ fullText: 'TV playback test', startTime: 0, endTime: 60, words: [] }], totalDuration: 60 })));
        await persistPlaybackCache(queue[0], queue);
        usePlaybackStore.setState({ currentSong: queue[0], playQueue: queue, audioSrc: source, playerState: 'PAUSED' });
    }, { source: `data:audio/wav;base64,${pcm.toString('base64')}`, count });
    await page.waitForFunction(() => [...document.querySelectorAll('audio')].some(a => a.readyState >= 2));
};

const open = async (page: Page) => {
    await page.addInitScript(([version, key]) => {
        if (localStorage.getItem('tv-resume-test')) return;
        localStorage.clear(); localStorage.setItem('tv-resume-test', 'true');
        localStorage.setItem(key, version); localStorage.setItem('library_suite_prompt_seen', 'true');
        localStorage.setItem('i18nextLng', 'zh-CN'); localStorage.setItem('static_mode', 'true');
        localStorage.setItem('visualizer_mode', 'classic');
    }, [APP_VERSION, GUIDE_VERSION_STORAGE_KEY]);
    await page.route('**/__mock_netease__/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto('/?tv=1'); await waitForAppMounted(page); await seedAudio(page);
};
const playing = async (page: Page) => {
    const entry = page.locator('[data-tv-now-playing]'); await entry.focus(); await page.keyboard.press('Enter');
    const surface = page.locator('[data-tv-player-surface]'); await expect(surface).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('audio')].some(a => !a.paused))).toBe(true);
    await page.evaluate(() => { [...document.querySelectorAll('audio')].find(a => !a.paused)!.currentTime = 23; });
};
const position = (page: Page) => page.evaluate(() => Math.max(...[...document.querySelectorAll('audio')].map(a => a.currentTime)));

test('held Down returns directly from settings while taps keep navigating and footer stays reachable', async ({ page }) => {
    await open(page); await playing(page); await page.keyboard.press('Escape');
    await page.evaluate(async () => {
        const path = '/src/stores/useSettingsModalStore.ts'; const { useSettingsModalStore } = await import(path);
        useSettingsModalStore.getState().openSettings('options', 'visualizer');
    });
    const scope = page.locator('[data-folia-tv-scope="visualizer"]');
    const first = scope.locator('[data-tv-sidebar] button').first(); await first.focus();
    await page.keyboard.press('ArrowDown'); await expect(scope).toBeVisible();
    await page.keyboard.press('ArrowLeft'); await expect(page.locator('[data-tv-now-playing]')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.down('ArrowDown');
    // Browser key auto-repeat is not generated by automation, so send a repeated keydown too.
    await page.keyboard.down('ArrowDown');
    await expect(scope).toHaveCount(0); await page.keyboard.up('ArrowDown');
    await expect(page.locator('[data-tv-player-surface]')).toBeFocused();
    expect(await position(page)).toBeGreaterThanOrEqual(23);
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('audio')].some(a => !a.paused))).toBe(true);
});

test('leaving TV pauses and checkpoints; warm and cold reopen preserve position without autoplay', async ({ page }) => {
    await open(page); await playing(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('folia-tv-app-active', { detail: { active: false } })));
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused))).toBe(true);
    const saved = await position(page); expect(saved).toBeGreaterThanOrEqual(23);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('folia_tv_playback_position_v1')!).position)).toBeGreaterThanOrEqual(23);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('folia-tv-app-active', { detail: { active: true } })));
    expect(await position(page)).toBeCloseTo(saved, 1);
    expect(await page.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused))).toBe(true);
    // The TV policy also wins over a previously enabled phone/desktop autoplay preference.
    await page.evaluate(async () => {
        const path = '/src/stores/useAudioSettingsStore.ts'; const { useAudioSettingsStore } = await import(path);
        useAudioSettingsStore.getState().handleToggleAutoPlayOnLaunch(true);
    });
    await page.addInitScript(() => {
        const observer = new MutationObserver(() => {
            const audio = [...document.querySelectorAll('audio')].find(a => a.getAttribute('src')?.startsWith('blob:'));
            if (!audio || audio.readyState !== 0) return;
            observer.disconnect();
            window.dispatchEvent(new CustomEvent('folia-tv-app-active', { detail: { active: false } }));
            (window as unknown as { earlyTvCheckpoint: number }).earlyTvCheckpoint = JSON.parse(localStorage.getItem('folia_tv_playback_position_v1')!).position;
        });
        observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['src'] });
    });
    await page.reload(); await waitForAppMounted(page);
    await expect.poll(() => page.evaluate(() => (window as unknown as { earlyTvCheckpoint: number }).earlyTvCheckpoint)).toBeCloseTo(saved, 1);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('folia-tv-app-active', { detail: { active: true } })));

    await page.waitForFunction(() => [...document.querySelectorAll('audio')].some(a => a.readyState >= 2));
    await expect.poll(() => position(page)).toBeCloseTo(saved, 1);
    expect(await page.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused))).toBe(true);
    const entry = page.locator('[data-tv-now-playing]');
    if (await entry.count()) { await entry.focus(); await page.keyboard.press('Enter'); }
    await expect(page.locator('[data-tv-player-surface]')).toBeFocused(); await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('audio')].some(a => !a.paused))).toBe(true);
    expect(await position(page)).toBeGreaterThanOrEqual(saved);
});

test('held Down returns from the central song grid without reaching its final row', async ({ page }) => {
    await installBaseState(page, { neteaseMode: 'logged-in', preserveNativeMediaQueries: true });
    await mockNeteaseApi(page, 'logged-in');
    await page.goto('/?tv=1'); await waitForAppMounted(page); await seedAudio(page); await playing(page);
    await page.keyboard.press('Escape');
    const carousel = page.locator('[data-grid3d-slider]'); await carousel.focus(); await page.keyboard.press('Enter');
    const scene = page.locator('[data-folia-grid-canvas]'); await expect(scene).toBeFocused();
    await page.keyboard.down('ArrowDown'); await page.keyboard.down('ArrowDown');
    await expect(page.locator('[data-tv-player-surface]')).toBeFocused();
    await page.keyboard.up('ArrowDown'); expect(await position(page)).toBeGreaterThanOrEqual(23);
});

test('player Left/Right selects actual previous/next tracks once per press and leaves settings navigation intact', async ({ page }) => {
    await open(page); await seedAudio(page, 3); await playing(page);
    const currentId = () => page.evaluate(async () => {
        const path = '/src/stores/usePlaybackStore.ts'; const { usePlaybackStore } = await import(path);
        return usePlaybackStore.getState().currentSong?.id;
    });
    const surface = page.locator('[data-tv-player-surface]');
    await page.keyboard.press('ArrowRight'); await expect.poll(currentId).toBe(87655);
    await expect(surface).toBeFocused();
    await page.keyboard.press('ArrowLeft'); await expect.poll(currentId).toBe(87654);
    await page.keyboard.down('ArrowRight'); await expect.poll(currentId).toBe(87655);
    await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowRight');
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', repeat: false, bubbles: true, cancelable: true })));
    await expect.poll(currentId).toBe(87655); await page.keyboard.up('ArrowRight');
    await page.locator('[data-tv-next]').click(); await expect.poll(currentId).toBe(87656);
    await page.locator('[data-tv-previous]').click(); await expect.poll(currentId).toBe(87655);
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
        const path = '/src/stores/useSettingsModalStore.ts'; const { useSettingsModalStore } = await import(path);
        useSettingsModalStore.getState().openSettings('options', 'visualizer');
    });
    const scope = page.locator('[data-folia-tv-scope="visualizer"]');
    await scope.locator('[data-tv-sidebar] button').first().focus(); await page.keyboard.press('ArrowRight');
    await expect.poll(() => scope.locator('[data-tv-content]').evaluate(node => node.contains(document.activeElement))).toBe(true);
    expect(await currentId()).toBe(87655);
});

test('TV playback controls fade out at idle, Up/Down reveals them and browsing keeps Now Playing visible', async ({ page }) => {
    await open(page); await playing(page);
    const bar = page.locator('[data-tv-transport]'); const floating = page.locator('[data-tv-floating-controls]');
    const surface = page.locator('[data-tv-player-surface]');
    await expect(bar).toHaveAttribute('aria-hidden', 'true'); await expect(bar).toBeHidden();
    await expect(floating).toHaveAttribute('aria-hidden', 'true');
    await expect(surface).toBeFocused();
    await page.keyboard.press('ArrowUp'); await expect(bar).toBeVisible();
    await expect(page.locator('[data-tv-toggle-play]')).toBeFocused();
    await expect(floating).not.toHaveAttribute('aria-hidden', 'true');
    await page.keyboard.press('ArrowRight'); await expect(page.locator('[data-tv-next]')).toBeFocused();
    await expect(bar).toHaveAttribute('aria-hidden', 'true'); await expect(surface).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(bar).toBeVisible();
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused))).toBe(true);
    await expect(bar).toHaveAttribute('aria-hidden', 'true');
    await page.keyboard.press('ArrowDown'); await expect(bar).toBeVisible();
    await expect(page.locator('[data-tv-toggle-play]')).toBeFocused();
    await expect(page.locator('[data-tv-floating-controls]')).toHaveCount(1);
    await expect(bar.locator('[data-tv-progress]')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(bar.locator('input[type="range"]')).toBeFocused();
    const beforeSeek = await position(page); await page.keyboard.press('ArrowRight');
    await expect.poll(() => position(page)).toBeGreaterThanOrEqual(beforeSeek + 4.8);
    await page.keyboard.press('ArrowUp'); await expect(page.locator('[data-tv-toggle-play]')).toBeFocused();
    await page.keyboard.press('Escape'); await expect(page.locator('[data-tv-now-playing]')).toBeVisible();
    await page.waitForTimeout(3300);
    await expect(page.locator('[data-tv-now-playing]')).toBeVisible();
});

test('TV upgrade shows original lyrics without a translation or upcoming-lyrics black box', async ({ page }) => {
    await open(page); await playing(page);
    await page.evaluate(async () => {
        const path = '/src/stores/usePlaybackStore.ts'; const { usePlaybackStore } = await import(path);
        usePlaybackStore.getState().setLyricsState({ lines: [{ fullText: 'Original TV lyric', translation: 'Unwanted translation', startTime: 0, endTime: 60,
            words: [{ text: 'Original TV lyric', startTime: 0, endTime: 60 }] }], totalDuration: 60 });
    });
    await expect(page.locator('[data-testid="player-visual-surface"]')).toContainText('Original TV lyric');
    await expect(page.locator('[data-folia-subtitle-overlay]')).toHaveCount(0);
    expect(await page.evaluate(async () => {
        const path = '/src/stores/useTypographySettingsStore.ts'; const { useTypographySettingsStore } = await import(path);
        const s = useTypographySettingsStore.getState(); return { hide: s.hidePlayerTranslationSubtitle, mode: s.subtitleContentMode, harmony: s.showHarmonySubtitle };
    })).toEqual({ hide: true, mode: 'none', harmony: false });
});
