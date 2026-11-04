import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
// dev/tv/capturePreviews.mjs
// Capture actual Folia renderers into local choice thumbnails. Run against a local Vite server.

const baseURL = process.env.FOLIA_PREVIEW_URL || 'http://127.0.0.1:4175';
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const output = path.resolve('public/tv-previews');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--enable-unsafe-swiftshader'],
});
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.pathname.includes('__mock_netease__')) return route.fulfill({ json: {} });
        return url.origin === baseURL ? route.continue() : route.abort();
    });
    await page.addInitScript(version => {
        localStorage.clear();
        localStorage.setItem('library_suite_prompt_seen', 'true');
        localStorage.setItem('folia_last_seen_ponder_onboarding_version', version);
        localStorage.setItem('folia_app_language', 'zh-CN');
        localStorage.setItem('static_mode', 'false');
    }, version);
    await page.goto(`${baseURL}/?tv=1`);
    await page.evaluate(async () => {
        const settingsPath = '/src/stores/useSettingsModalStore.ts';
        const visualizerPath = '/src/stores/useVisualizerSettingsStore.ts';
        const { useVisualizerSettingsStore } = await import(visualizerPath);
        useVisualizerSettingsStore.getState().handleSetVisualizerBackgroundMode('common');
        const { useSettingsModalStore } = await import(settingsPath);
        useSettingsModalStore.getState().openSettings('options', 'visualizer');
    });
    const scope = page.locator('[data-folia-tv-scope="visualizer"]');
    await scope.locator('[data-tv-focus-group="animation"]').waitFor();
    const captured = [];
    for (const [kind, menu] of [['animation', 0], ['background', 2]]) {
        await scope.locator('[data-tv-sidebar] button').nth(menu).click();
        const choices = scope.locator(`[data-tv-focus-group="${kind}"] [data-tv-choice]`);
        await choices.first().waitFor();
        const ids = await choices.evaluateAll(nodes => nodes.map(node => node.dataset.tvChoice));
        for (const id of ids) {
            await scope.locator(`[data-tv-choice="${id}"]`).click();
            // Let lazy renderers, fonts, shaders and entrance motion produce an actual sample frame.
            await page.waitForTimeout(1800);
            const surface = scope.locator('[data-tv-preview-stage]');
            await surface.screenshot({ path: path.join(output, `${kind}-${id}.png`) });
            captured.push({ kind, id, file: `${kind}-${id}.png` });
            console.log(`Captured ${kind}/${id}`);
        }
    }
    writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ source: 'Folia VisPlayground actual renderer screenshots', captured }, null, 2) + '\n');
} finally {
    await browser.close();
}
