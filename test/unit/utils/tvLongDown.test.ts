import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTvLongDown } from '../../../src/services/tvLongDown';
// test/unit/utils/tvLongDown.test.ts
const key = (repeat = false, name = 'ArrowDown') => ({ key: name, repeat } as KeyboardEvent);
afterEach(() => vi.useRealTimers());
describe('TV held Down shortcut', () => {
    it('preserves a tap and cancels on release', () => {
        vi.useFakeTimers(); const action = vi.fn(); const hold = createTvLongDown(() => action);
        expect(hold.keydown(key())).toBe(false);
        vi.advanceTimersByTime(600); hold.keyup(key()); vi.advanceTimersByTime(1000);
        expect(action).not.toHaveBeenCalled();
    });
    it('returns once after a second and consumes repeats until release', () => {
        vi.useFakeTimers(); const action = vi.fn(); const hold = createTvLongDown(() => action);
        hold.keydown(key()); expect(hold.keydown(key(true))).toBe(true);
        vi.advanceTimersByTime(1000); expect(action).toHaveBeenCalledTimes(1);
        expect(hold.keydown(key(true))).toBe(true); vi.advanceTimersByTime(2000);
        expect(action).toHaveBeenCalledTimes(1); hold.keyup(key());
    });
    it('does not leave a modal or fire after focus/window cancellation', () => {
        vi.useFakeTimers(); let allowed = true; const action = vi.fn();
        const hold = createTvLongDown(() => allowed ? action : undefined);
        hold.keydown(key()); allowed = false; vi.advanceTimersByTime(1000);
        expect(action).not.toHaveBeenCalled(); hold.cancel(); allowed = true;
        hold.keydown(key()); hold.cancel(); vi.advanceTimersByTime(1000);
        expect(action).not.toHaveBeenCalled();
    });
});
