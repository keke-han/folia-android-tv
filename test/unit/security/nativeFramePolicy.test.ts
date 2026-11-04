import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeFrameSandbox } from '../../../src/utils/nativeFramePolicy';

// 当前文件：验证恢复/导入的远程网页在安卓端也不能获得脚本权限。
afterEach(() => vi.unstubAllGlobals());
describe('native iframe script boundary', () => {
    it('strips all sandbox capabilities for native Android', () => {
        vi.stubGlobal('window', { Capacitor: { getPlatform: () => 'android' } });
        expect(nativeFrameSandbox('allow-scripts allow-same-origin allow-forms')).toBe('');
    });
    it('preserves browser capabilities and works without window', () => {
        vi.stubGlobal('window', undefined);
        expect(nativeFrameSandbox('allow-scripts')).toBe('allow-scripts');
        vi.stubGlobal('window', { Capacitor: { getPlatform: () => 'web' } });
        expect(nativeFrameSandbox('allow-scripts')).toBe('allow-scripts');
    });
});
