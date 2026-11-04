// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createTvTextInputGuard } from '../../../src/services/tvTextInput';
// test/unit/utils/tvTextInput.test.ts

describe('TV input confirmation', () => {
    it('locks navigation focus until explicitly activated, then locks again on blur', () => {
        const guard = createTvTextInputGuard();
        const input = document.createElement('input');
        input.type = 'search';
        document.body.append(input);
        guard.lock(input);
        expect(input.readOnly).toBe(true);
        expect(input.inputMode).toBe('none');
        guard.edit(input);
        expect(input.readOnly).toBe(false);
        expect(guard.isEditing(input)).toBe(true);
        guard.lock(input);
        expect(input.readOnly).toBe(true);
        expect(guard.isEditing(input)).toBe(false);
        input.remove();
    });
    it('preserves genuinely readonly fields and does not lock sliders or checkboxes', () => {
        const guard = createTvTextInputGuard();
        for (const type of ['range', 'checkbox', 'file', 'color']) {
            const input = document.createElement('input');
            input.type = type;
            expect(guard.lock(input)).toBe(false);
        }
        const readonly = document.createElement('input');
        readonly.readOnly = true;
        expect(guard.edit(readonly)).toBe(false);
        expect(readonly.readOnly).toBe(true);
    });
    it('asks the Android keyboard bridge to show only when entering edit mode', () => {
        const show = vi.fn();
        const guard = createTvTextInputGuard(show);
        const input = document.createElement('textarea');
        guard.lock(input);
        expect(show).not.toHaveBeenCalled();
        guard.edit(input);
        expect(show).toHaveBeenCalledOnce();
    });
});
