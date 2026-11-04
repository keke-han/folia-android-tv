import { expect, test, type Page } from '@playwright/test';
import { APP_VERSION, GUIDE_VERSION_STORAGE_KEY, waitForAppMounted } from '../helpers/appState';
import { installBaseState, mockNeteaseApi, neteaseFixtures } from './helpers/appFixtures';
// test/ui/androidTvSettings.spec.ts
// Exercises shipped settings with real layout and keyboard events, no component doubles.

test.use({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });

const openSettings = async (page: Page, subview: string | null = null) => {
    await page.addInitScript(([version, guideKey]) => {
        localStorage.clear();
        localStorage.setItem('library_suite_prompt_seen', 'true');
        localStorage.setItem('i18nextLng', 'zh-CN');
        localStorage.setItem('static_mode', 'true');
        localStorage.setItem('visualizer_mode', 'classic');
        localStorage.setItem(guideKey, version);
    }, [APP_VERSION, GUIDE_VERSION_STORAGE_KEY]);
    await page.route('**/__mock_netease__/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto('/?tv=1');
    await waitForAppMounted(page);
    await page.evaluate(async subview => {
        const path = '/src/stores/useSettingsModalStore.ts';
        const { useSettingsModalStore } = await import(path);
        useSettingsModalStore.getState().openSettings('options', subview);
    }, subview);
};

test('all settings categories use the left sidebar and its final menu stays reachable', async ({ page }) => {
    await openSettings(page);
    const nav = page.locator('[data-tv-sidebar="settings"]');
    const body = page.locator('[data-folia-settings-content]');
    const categories = nav.locator('[data-tv-section]');
    await expect(categories).toHaveCount(9);
    for (const category of await categories.all()) {
        await category.focus();
        await page.keyboard.press('Enter');
        await expect(category).toHaveAttribute('aria-current', 'page');
        await expect(body).toBeVisible();
        const [left, right] = await Promise.all([nav.boundingBox(), body.boundingBox()]);
        expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x + 5);
    }
    const first = nav.locator('input').first();
    await first.focus();
    const count = await nav.locator('button').count();
    for (let index = 0; index < count; index++) await page.keyboard.press('ArrowDown');
    await expect(nav.locator('button').last()).toBeFocused();
    expect(await nav.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/tv-settings.png' });
});

test('search focus does not edit until confirmation and Escape returns to navigation', async ({ page }) => {
    await openSettings(page);
    const input = page.locator('[data-tv-sidebar="settings"] input');
    await input.focus();
    await expect(input).toHaveJSProperty('readOnly', true);
    await page.keyboard.press('ArrowDown');
    await expect(input).not.toBeFocused();
    await input.focus();
    await page.keyboard.press('Enter');
    await expect(input).toHaveJSProperty('readOnly', false);
    await page.keyboard.type('字体');
    await page.keyboard.press('Escape');
    await expect(input).toHaveJSProperty('readOnly', true);
    await expect(page.locator('[data-folia-settings-overlay]')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(input).not.toBeFocused();
});

test('Android IME dismissal ends editing even when the OS consumes Back', async ({ page }) => {
    await openSettings(page);
    const input = page.locator('[data-tv-sidebar="settings"] input');
    await input.focus();
    await page.keyboard.press('Enter');
    await expect(input).toHaveJSProperty('readOnly', false);
    await page.evaluate(() => window.dispatchEvent(new Event('folia-tv-ime-hidden')));
    await expect(input).toHaveJSProperty('readOnly', true);
});

test('lyrics editor exposes all six vertical categories and enters their controls', async ({ page }) => {
    await openSettings(page, 'visualizer');
    const scope = page.locator('[data-folia-tv-scope="visualizer"]');
    const menus = scope.locator('[data-tv-sidebar] button');
    await expect(menus).toHaveCount(6);
    await expect(scope.locator('[data-tv-live-preview]')).toBeVisible();
    for (const menu of await menus.all()) {
        await menu.focus();
        await page.keyboard.press('ArrowRight');
        await expect(menu).toHaveAttribute('aria-current', 'page');
        await expect.poll(() => scope.locator('[data-tv-content]').evaluate(node => node.contains(document.activeElement))).toBe(true);
    }
    await page.screenshot({ path: 'test-results/tv-lyrics-settings.png' });
});

test('range keys change the saved value and Down leaves the slider', async ({ page }) => {
    await openSettings(page, 'visualizer');
    const scope = page.locator('[data-folia-tv-scope="visualizer"]');
    await scope.locator('[data-tv-sidebar] button').last().focus();
    await page.keyboard.press('ArrowRight');
    const slider = scope.locator('input[type="range"]').first();
    await slider.focus();
    const before = Number(await slider.inputValue());
    await page.keyboard.press('ArrowLeft');
    expect(Number(await slider.inputValue())).toBeLessThan(before);
    await page.keyboard.press('ArrowUp');
    await expect(slider).not.toBeFocused();
});

test('nested theme editor keeps categories left and restores parent focus on Back', async ({ page }) => {
    await openSettings(page, 'themePark');
    const scope = page.locator('[data-folia-tv-scope="theme"]');
    await expect(scope.locator('[data-tv-sidebar] button')).toHaveCount(4);
    for (const button of await scope.locator('[data-tv-sidebar] button').all()) {
        await button.focus();
        await page.keyboard.press('ArrowRight');
        await expect(button).toHaveAttribute('aria-current', 'page');
        await expect.poll(() => scope.locator('[data-tv-content]').evaluate(node => node.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(scope).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.activeElement !== document.body)).toBe(true);
});

test('540p layout keeps a long parameter form scrollable and returns to its selected sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 540 });
    await openSettings(page, 'visualizer');
    const scope = page.locator('[data-folia-tv-scope="visualizer"]');
    const menu = scope.locator('[data-tv-sidebar] button').nth(4);
    await menu.focus();
    await page.keyboard.press('ArrowRight');
    const controls = scope.locator('[data-tv-content] button, [data-tv-content] input:not(:disabled)');
    const last = controls.last();
    // Move with the production helper; virtual geometry includes controls below the viewport.
    for (let index = 0; index < 40; index++) await page.keyboard.press('ArrowDown');
    expect(await scope.locator('[data-tv-content]').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    await last.focus();
    await page.keyboard.press('ArrowUp');
    await expect(last).not.toBeFocused();
    await menu.focus();
    await page.keyboard.press('ArrowRight');
    for (let index = 0; index < 8; index++) await page.keyboard.press('ArrowLeft');
    await expect(menu).toBeFocused();
    await page.screenshot({ path: 'test-results/tv-settings-540p.png' });
});

test('custom dropdown consumes its own directions and returns focus when dismissed', async ({ page }) => {
    await openSettings(page);
    const menu = page.locator('[data-tv-section="general"]');
    await menu.focus();
    await page.keyboard.press('ArrowRight');
    const select = page.locator('[data-folia-settings-content] [role="combobox"]').first();
    await select.focus();
    await page.keyboard.press('Enter');
    await expect(select).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(select).toHaveAttribute('aria-expanded', 'false');
    await expect(select).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(select).not.toBeFocused();
});

test('rapid separate presses respond immediately while held repeats are bounded', async ({ page }) => {
    await openSettings(page);
    const nav = page.locator('[data-tv-sidebar="settings"]');
    await nav.locator('input').focus();
    const result = await page.evaluate(() => {
        const start = performance.now();
        const dispatch = (repeat: boolean) => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true, repeat }));
        for (let i = 0; i < 5; i++) dispatch(false);
        const five = document.activeElement;
        for (let i = 0; i < 20; i++) dispatch(true);
        return { same: five === document.activeElement, elapsed: performance.now() - start };
    });
    expect(result.same).toBe(true);
    expect(result.elapsed).toBeLessThan(200);
});

test('TV theme editing can reach header Save and apply the theme using only remote keys', async ({ page }) => {
    await openSettings(page, 'themePark');
    const scope = page.locator('[data-folia-tv-scope="theme"]');
    const first = scope.locator('[data-tv-sidebar] button').first();
    await first.focus();
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => scope.evaluate(node => {
        const active = document.activeElement;
        return Boolean(active && node.contains(active) && !active.closest('[data-tv-sidebar], [data-tv-content]'));
    })).toBe(true);
    const save = scope.getByRole('button', { name: /保存.*应用|保存到当前歌曲/ }).last();
    for (let i = 0; i < 8 && !(await save.evaluate(node => node === document.activeElement)); i++) await page.keyboard.press('ArrowRight');
    await expect(save).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(scope).toHaveCount(0);
});

test('font picker traps focus and Back closes it before the underlying editor', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, 'queryLocalFonts', { value: undefined, configurable: true }));
    await openSettings(page, 'visualizer');
    const scope = page.locator('[data-folia-tv-scope="visualizer"]');
    await scope.locator('[data-tv-sidebar] button').nth(3).focus();
    await page.keyboard.press('ArrowRight');
    await scope.getByRole('button', { name: '自定义字体', exact: true }).focus();
    await page.keyboard.press('Enter');
    const picker = page.locator('[data-folia-tv-scope="font-picker"]');
    await expect(picker).toBeVisible();
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
    await expect.poll(() => picker.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
    await expect(scope).toBeVisible();
});

test('home carousel keeps its native remote selection and opens the selected collection', async ({ page }) => {
    await installBaseState(page, { neteaseMode: 'logged-in', preserveNativeMediaQueries: true });
    await mockNeteaseApi(page, 'logged-in');
    await page.route(/\/__mock_netease__\/user\/cloud\?/, route => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, count: 2, data: [
            neteaseFixtures.cloudSongs[0], { ...neteaseFixtures.cloudSongs[0], id: 7002, name: 'Second cloud track' },
        ] }),
    }));
    await page.goto('/?tv=1');
    await waitForAppMounted(page);
    const carousel = page.locator('[data-grid3d-slider]');
    await expect(carousel).toBeVisible();
    await expect(carousel).toBeFocused();
    await expect(carousel).toHaveCSS('outline-style', 'none');
    await expect(carousel).toHaveCSS('box-shadow', 'none');
    await expect(carousel.locator('[data-tv-card-current]')).toHaveCount(1);
    await expect(carousel.locator('[data-tv-card-current]')).toHaveCSS('outline-color', 'rgb(255, 224, 102)');
    const title = page.locator('[data-grid3d-slider] + div h3');
    const before = await title.textContent();
    await page.keyboard.press('ArrowRight');
    await expect(title).not.toHaveText(before!);
    await page.keyboard.press('Enter');
    const collection = page.locator('[data-library-renderer="grid"]');
    await expect(collection).toBeVisible();
    const scene = collection.locator('[data-tv-native-navigation="grid"]');
    await expect(scene).toBeFocused();
    await expect(scene).toHaveCSS('outline-style', 'none');
    await expect(scene.locator('[data-tv-card-current]')).toHaveCount(1);
    await expect(scene.locator('[data-tv-card-current]')).toHaveCSS('outline-color', 'rgb(255, 224, 102)');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(scene).not.toBeFocused();
    await expect(collection).toHaveCount(0);
    await expect(carousel).toBeVisible();
});


test('background choices are entered directly and every type is selectable with remote keys', async ({ page }) => {
    await openSettings(page, 'visualizer');
    const scope = page.locator('[data-folia-tv-scope="visualizer"]');
    const menu = scope.locator('[data-tv-sidebar] button').nth(2);
    await menu.focus();
    await page.keyboard.press('ArrowRight');
    const choices = scope.locator('[data-tv-focus-group="background"] [data-tv-choice]');
    await expect(choices).toHaveCount(6);
    await expect(choices.first()).toBeFocused();
    const order = [0, 1, 2, 5, 4, 3];
    const keys = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft'];
    for (let step = 0; step < order.length; step++) {
        const choice = choices.nth(order[step]);
        await expect(choice).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(choice).toHaveAttribute('aria-pressed', 'true');
        const mode = await choice.getAttribute('data-tv-choice');
        await expect(scope.locator('[data-tv-live-preview]')).toHaveAttribute('data-preview-background', mode!);
        await expect.poll(() => page.evaluate(async () => {
            const path = '/src/stores/useVisualizerSettingsStore.ts';
            const { useVisualizerSettingsStore } = await import(path);
            return useVisualizerSettingsStore.getState().visualizerBackgroundMode;
        })).toBe(mode);
        await expect.poll(() => choice.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
        if (keys[step]) await page.keyboard.press(keys[step]);
    }
    await page.screenshot({ path: 'test-results/tv-background-choice-previews.png' });
});

test('TV animation selection retains its visible effect preview', async ({ page }) => {
    await openSettings(page, 'visualizer');
    await expect(page.locator('[data-tv-live-preview]')).toBeVisible();
});


test('all fourteen animation cards retain images and can be confirmed with only directions', async ({ page }) => {
    await openSettings(page, 'visualizer');
    const scope = page.locator('[data-folia-tv-scope="visualizer"]');
    await scope.locator('[data-tv-sidebar] button').first().focus();
    await page.keyboard.press('ArrowRight');
    const choices = scope.locator('[data-tv-focus-group="animation"] [data-tv-choice]');
    await expect(choices).toHaveCount(14);
    const order = [0, 1, 2, 5, 4, 3, 6, 7, 8, 11, 10, 9, 12, 13];
    const keys = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
    for (let step = 0; step < order.length; step++) {
        const choice = choices.nth(order[step]);
        await expect(choice).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(choice).toHaveAttribute('aria-pressed', 'true');
        const mode = await choice.getAttribute('data-tv-choice');
        await expect(scope.locator('[data-tv-live-preview]')).toHaveAttribute('data-preview-mode', mode!);
        await expect.poll(() => page.evaluate(async () => {
            const path = '/src/stores/useVisualizerSettingsStore.ts';
            const { useVisualizerSettingsStore } = await import(path);
            return useVisualizerSettingsStore.getState().visualizerMode;
        })).toBe(mode);
        await expect.poll(() => choice.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
        if (keys[step]) await page.keyboard.press(keys[step]);
    }
    await page.screenshot({ path: 'test-results/tv-animation-choice-previews.png' });
});

test('every enabled control in each lyrics category has a directional path', async ({ page }) => {
    await openSettings(page, 'visualizer');
    const scope = page.locator('[data-folia-tv-scope="visualizer"]');
    for (const menu of await scope.locator('[data-tv-sidebar] button').all()) {
        await menu.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => scope.locator('[data-tv-content]').evaluate(node => node.contains(document.activeElement))).toBe(true);
        const unreachable = await page.evaluate(async () => {
            const path = '/src/services/tvRemoteDom.ts';
            const { tvControls, tvNextControl } = await import(path);
            const root = document.querySelector('[data-folia-tv-scope="visualizer"]') as HTMLElement;
            const nodes: HTMLElement[] = tvControls(root);
            const menu = root.querySelector('[data-tv-sidebar] [aria-current]') as HTMLElement;
            const reached = new Set<HTMLElement>([document.activeElement as HTMLElement]);
            const queue = [...reached];
            while (queue.length) {
                const node = queue.shift()!;
                for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
                    if (node.matches('input[type="range"], [role="slider"]') && (key === 'ArrowLeft' || key === 'ArrowRight')) continue;
                    const next = tvNextControl(root, node, key, menu);
                    if (next && !reached.has(next)) { reached.add(next); queue.push(next); }
                }
            }
            return nodes.filter(node => node.closest('[data-tv-content]') && !reached.has(node))
                .map(node => node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 60) || node.outerHTML.slice(0, 100));
        });
        expect(unreachable).toEqual([]);
    }
});

test('TV confirm pauses/resumes real audio and returning through Now Playing preserves its position', async ({ page }) => {
    await openSettings(page);
    // A minute of local PCM audio exercises the real media element without an account or network.
    const pcm = Buffer.alloc(44 + 8000 * 60 * 2);
    pcm.write('RIFF'); pcm.writeUInt32LE(pcm.length - 8, 4); pcm.write('WAVEfmt ', 8);
    pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
    pcm.writeUInt32LE(8000, 24); pcm.writeUInt32LE(16000, 28); pcm.writeUInt16LE(2, 32);
    pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(pcm.length - 44, 40);
    await page.evaluate(async source => {
        const playbackPath = '/src/stores/usePlaybackStore.ts';
        const settingsPath = '/src/stores/useSettingsModalStore.ts';
        const { usePlaybackStore } = await import(playbackPath);
        const { useSettingsModalStore } = await import(settingsPath);
        useSettingsModalStore.getState().closeSettings();
        usePlaybackStore.setState({
            currentSong: { id: 87654, name: 'TV local audio', artists: [{ id: 1, name: 'TV test' }], album: { id: 1, name: 'Test' }, durationMs: 60000 },
            audioSrc: source,
            playerState: 'PAUSED',
        });
    }, `data:audio/wav;base64,${pcm.toString('base64')}`);
    const entry = page.locator('[data-tv-now-playing]');
    await expect(entry).toBeVisible();
    await entry.focus();
    await page.keyboard.press('Enter');
    const surface = page.locator('[data-tv-player-surface]');
    await expect(surface).toBeFocused();
    await expect(page.locator('[data-folia-keyboard-window="true"]')).toHaveCount(0);
    await expect(page.locator('[data-tv-toggle-play]')).toBeEnabled();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('audio')).some(node => node.getAttribute('src')?.startsWith('data:audio') && node.readyState >= 2));
    await page.keyboard.press('Enter');
    const audioState = () => page.evaluate(() => {
        const audio = Array.from(document.querySelectorAll('audio')).find(node => node.getAttribute('src')?.startsWith('data:audio'))!;
        return { paused: audio.paused, time: audio.currentTime, source: audio.currentSrc.length };
    });
    await expect.poll(async () => (await audioState()).paused).toBe(false);
    await page.evaluate(() => {
        const audio = Array.from(document.querySelectorAll('audio')).find(node => node.getAttribute('src')?.startsWith('data:audio'))!;
        audio.currentTime = 23;
    });
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await audioState()).paused).toBe(true);
    const position = (await audioState()).time;
    expect(position).toBeGreaterThanOrEqual(23);
    await page.keyboard.press('Escape');
    await expect(entry).toBeVisible();
    await page.evaluate(async () => {
        const path = '/src/stores/useSettingsModalStore.ts';
        const { useSettingsModalStore } = await import(path);
        useSettingsModalStore.getState().openSettings('options', 'visualizer');
    });
    const editor = page.locator('[data-folia-tv-scope="visualizer"]');
    await editor.locator('[data-tv-sidebar] button').nth(3).focus();
    await page.keyboard.press('ArrowRight');
    await editor.getByRole('button', { name: '自定义字体', exact: true }).focus();
    await page.keyboard.press('Enter');
    const picker = page.locator('[data-folia-tv-scope="font-picker"]');
    await expect(picker).toBeVisible();
    await expect(entry).toBeHidden();
    await picker.locator('button').last().focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => picker.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
    const sidebarLast = page.locator('[data-folia-tv-scope="visualizer"] [data-tv-sidebar] button').last();
    await sidebarLast.focus();
    await page.keyboard.press('ArrowDown');
    await expect(entry).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-tv-toggle-play]')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(entry).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(sidebarLast).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-folia-tv-scope="visualizer"]')).toHaveCount(0);
    await expect(surface).toBeFocused();
    const returned = await audioState();
    expect(returned.paused).toBe(true);
    expect(returned.time).toBeCloseTo(position, 1);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await audioState()).paused).toBe(false);
    expect((await audioState()).time).toBeGreaterThanOrEqual(position);
});

test('TV focus uses a contrasting yellow ring while the chosen category keeps its own selection', async ({ page }) => {
    await openSettings(page, 'visualizer');
    const scope = page.locator('[data-folia-tv-scope="visualizer"]');
    const category = scope.locator('[data-tv-sidebar] button').first(); await category.focus();
    await expect(category).toHaveCSS('outline-color', 'rgb(255, 224, 102)');
    await expect(category).toHaveCSS('outline-width', '4px');
    await expect(category).toHaveCSS('background-color', 'rgb(23, 34, 54)');
    await expect(category).toHaveCSS('color', 'rgb(255, 255, 255)');
    await page.keyboard.press('ArrowRight');
    const choice = scope.locator('[data-tv-choice]').first(); await expect(choice).toBeFocused();
    await expect(choice).toHaveCSS('outline-color', 'rgb(255, 224, 102)');
    await expect(category).not.toBeFocused(); await expect(category).toHaveAttribute('aria-current', 'page');
    await expect(scope).toHaveCSS('opacity', '1');
    await expect(scope.locator('[data-ponder="vis-playground"]')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: 'test-results/tv-high-contrast-focus.png' });
});
