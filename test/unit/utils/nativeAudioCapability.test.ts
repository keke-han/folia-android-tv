import { afterEach, describe, expect, it, vi } from 'vitest';

// 当前文件：验证原生音频链接必须来自本次会话的能力地址。
vi.mock('../../../src/services/db', () => ({ saveLocalSongs: vi.fn() }));
vi.mock('../../../src/utils/localMetadataWorkerClient', () => ({ parseEmbeddedMetadataAsync: vi.fn() }));
vi.mock('../../../src/nativeBridge/api/libraryTrace.js', () => ({ noteLibraryStep: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('native audio capability URL', () => {
    it('rebuilds an encoded reference using only the current native capability base', async () => {
        const localAudioServerPort = vi.fn(async () => ({ port: 12345, baseUrl: 'http://127.0.0.1:12345/session-capability' }));
        vi.stubGlobal('window', { Capacitor: { Plugins: { FoliaNative: { localAudioServerPort } } } });
        const { nativeAudioUrlForRef } = await import('../../../src/services/nativeLocalMusic');
        expect(await nativeAudioUrlForRef('file-/storage/song name.mp3')).toBe('http://127.0.0.1:12345/session-capability/audio/file-%2Fstorage%2Fsong%20name.mp3');
        expect(await nativeAudioUrlForRef('42')).toBe('http://127.0.0.1:12345/session-capability/audio/42');
        expect(localAudioServerPort).toHaveBeenCalledTimes(1);
    });

    it('does not fall back to an unauthenticated URL when the bridge omits its capability', async () => {
        vi.stubGlobal('window', { Capacitor: { Plugins: { FoliaNative: { localAudioServerPort: async () => ({ port: 12345 }) } } } });
        const { nativeAudioUrlForRef } = await import('../../../src/services/nativeLocalMusic');
        expect(await nativeAudioUrlForRef('42')).toBeNull();
    });
});
