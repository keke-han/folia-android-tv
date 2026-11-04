import { acceptTvRepeat, type TvDirection } from '../utils/tvNavigation';
import { createTvLongDown } from './tvLongDown';
import { isTvMode } from './tvMode';
import { hasBlockingWindow } from '../utils/keyboardTargets';
import { createTvTextInputGuard, isTvTextField } from './tvTextInput';
import { focusTvControl, tvControls, tvNextControl, tvScope, tvTransportEntry, tvVisible } from './tvRemoteDom';
// src/services/tvRemote.ts
// One capture-phase handler gives all settings, dialogs and search fields consistent TV controls.

let stopEditing: (() => boolean) | undefined;
export const stopTvTextEditing = (): boolean => stopEditing?.() ?? false;

export const installTvRemote = (): (() => void) => {
    if (!isTvMode()) return () => {};
    document.documentElement.dataset.foliaTv = 'true';
    const guard = createTvTextInputGuard(visible => {
        const plugin = (window as unknown as { Capacitor?: { Plugins?: { FoliaNative?: { setTvKeyboard: (options: { visible: boolean }) => Promise<unknown> } } } }).Capacitor?.Plugins?.FoliaNative;
        void plugin?.setTvKeyboard({ visible }).catch(() => {});
    });
    stopEditing = guard.stop;
    const remembered = new WeakMap<HTMLElement, HTMLElement>();
    const menus = new WeakMap<HTMLElement, HTMLElement>();
    let scope = document.body;
    const heldKeys = new Set<string>();
    let lastKey = '';
    let lastTime = -Infinity;
    let frame = 0;
    let pendingEntry: HTMLElement | null = null;
    let beforeTransport: HTMLElement | null = null;
    const enterContent = () => {
        if (!pendingEntry?.isConnected) { pendingEntry = null; return; }
        const next = tvNextControl(tvScope(), pendingEntry, 'ArrowRight', menus.get(scope));
        if (next) { pendingEntry = null; focusTvControl(next); }
    };
    const prepare = (root: ParentNode) => root.querySelectorAll('input, textarea').forEach(node => {
        if (!guard.isEditing(node)) guard.lock(node);
    });
    const repairFocus = () => {
        frame = 0;
        const nextScope = tvScope();
        if ((document.activeElement as HTMLElement)?.closest('[data-tv-transport]') && tvTransportEntry(nextScope)) return;
        const current = document.activeElement as HTMLElement | null;
        if (nextScope !== scope || !current || current === document.body || !scope.contains(current) || !tvVisible(current)) {
            scope = nextScope;
            const saved = remembered.get(scope);
            const target = saved?.isConnected && tvVisible(saved) ? saved
                : scope.querySelector<HTMLElement>('[data-tv-sidebar] [aria-current], [data-tv-sidebar] [aria-pressed="true"]') ?? tvControls(scope).find(node => node.matches('[data-tv-native-navigation], [data-tv-player-surface]')) ?? tvControls(scope)[0];
            if (target) focusTvControl(target);
        }
    };
    const onFocus = (event: FocusEvent) => {
        const node = event.target;
        if (!(node instanceof HTMLElement)) return;
        if (pendingEntry && node !== pendingEntry) pendingEntry = null;
        if (!guard.isEditing(node)) guard.lock(node);
        if (node.closest('[data-tv-transport]')) {
            beforeTransport = remembered.get(scope) ?? null;
            return;
        }
        const activeScope = tvScope();
        remembered.set(activeScope, node);
        if (node.closest('[data-tv-sidebar]')) menus.set(activeScope, node);
    };
    const onBlur = (event: FocusEvent) => {
        guard.lock(event.target);
        if (event.target instanceof HTMLElement) delete event.target.dataset.tvAdjusting;
    };
    const onClick = (event: MouseEvent) => {
        const target = event.target;
        if (isTvTextField(target)) guard.edit(target);
    };
    const longDown = createTvLongDown(() => {
        const current = document.activeElement;
        if (guard.isEditing(current) || current?.closest('[role="combobox"][aria-expanded="true"], [data-tv-adjusting="true"]')) return undefined;
        const target = tvTransportEntry(tvScope());
        return target && tvVisible(target) ? () => target.click() : undefined;
    });
    const onKey = (event: KeyboardEvent) => {
        if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
        // Android WebViews can omit repeat=true; physical down/up is the reliable boundary.
        const repeat = event.repeat || heldKeys.has(event.key);
        heldKeys.add(event.key);
        if (longDown.keydown({ key: event.key, repeat })) { event.preventDefault(); event.stopImmediatePropagation(); return; }
        if (pendingEntry) enterContent();
        const current = document.activeElement as HTMLElement;
        pendingEntry = null;
        if (current?.closest('[data-tv-transport], [data-tv-floating-controls]')) window.dispatchEvent(new Event('folia-tv-reveal-controls'));
        if (guard.isEditing(current)) {
            if (event.key === 'Escape' || event.key === 'GoBack') {
                event.preventDefault(); event.stopImmediatePropagation(); guard.stop();
            }
            return;
        }
        // Select popovers own their keys. Custom color sliders enter full adjustment with OK;
        // ordinary Up/Down always lets the user leave a horizontal slider or offset ruler.
        if (current?.closest('[role="combobox"][aria-expanded="true"]')) return;
        if (current?.dataset.tvAdjusting === 'true') {
            if (event.key === 'Escape' || event.key === 'Enter') {
                event.preventDefault(); event.stopImmediatePropagation(); delete current.dataset.tvAdjusting;
            }
            return;
        }
        if (current instanceof HTMLSelectElement && event.key === 'Enter') {
            current.dataset.tvAdjusting = 'true'; return;
        }
        if (current?.getAttribute('role') === 'slider') {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') return;
            if (event.key === 'Enter') {
                event.preventDefault(); event.stopImmediatePropagation(); current.dataset.tvAdjusting = 'true'; return;
            }
        }
        // Range values go through the native setter so React's onChange receives an actual change.
        if (current instanceof HTMLInputElement && current.type === 'range' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            event.preventDefault(); event.stopImmediatePropagation();
            const now = performance.now();
            if (!acceptTvRepeat(repeat && lastKey === event.key, now, lastTime)) return;
            lastKey = event.key; lastTime = now;
            const step = current.closest('[data-tv-progress]') ? 5 : current.step === 'any' ? 1 : Number(current.step || 1);
            const value = Math.max(Number(current.min || 0), Math.min(Number(current.max || 100), Number(current.value) + (event.key === 'ArrowRight' ? step : -step)));
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(current, String(Number(value.toFixed(6))));
            current.dispatchEvent(new Event('input', { bubbles: true }));
            current.dispatchEvent(new Event('change', { bubbles: true }));
            current.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
            return;
        }
        // The bottom transport is shared by every browsing/settings scope. Up returns to its owner.
        if (current?.closest('[data-tv-transport]')) {
            const progress = current.closest('[data-tv-transport]')?.querySelector<HTMLInputElement>('[data-tv-progress] input[type="range"]');
            if (progress && (event.key === 'ArrowDown' || (event.key === 'ArrowUp' && current === progress))) {
                event.preventDefault(); event.stopImmediatePropagation();
                const target = current === progress
                    ? document.querySelector<HTMLElement>(event.key === 'ArrowUp' ? '[data-tv-toggle-play]' : '[data-tv-player-surface]') : progress;
                if (target) focusTvControl(target);
                return;
            }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault(); event.stopImmediatePropagation();
                const buttons = tvControls(current.closest<HTMLElement>('[data-tv-transport]')!);
                const next = buttons[buttons.indexOf(current) + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0)];
                if (next) focusTvControl(next);
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault(); event.stopImmediatePropagation();
                if (beforeTransport?.isConnected && tvVisible(beforeTransport)) focusTvControl(beforeTransport);
                else { (current as HTMLElement).blur(); repairFocus(); }
                return;
            }
            if (event.key === 'Enter' || event.key === 'Accept' || event.key === ' ') {
                event.preventDefault(); event.stopImmediatePropagation();
                if (!repeat) current.click();
                return;
            }
        }
        if (current?.hasAttribute('data-tv-player-surface') && !hasBlockingWindow()) {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault(); event.stopImmediatePropagation();
                window.dispatchEvent(new Event('folia-tv-reveal-controls'));
                if (!repeat) requestAnimationFrame(() => {
                    const button = document.querySelector<HTMLButtonElement>('[data-tv-toggle-play]');
                    if (button && !button.disabled && tvVisible(button)) focusTvControl(button);
                });
                return;
            }
            const selector = event.key === 'ArrowLeft' ? '[data-tv-previous]'
                : event.key === 'ArrowRight' ? '[data-tv-next]'
                    : ['Enter', 'Accept', ' '].includes(event.key) ? '[data-tv-toggle-play]' : null;
            if (selector) {
                event.preventDefault(); event.stopImmediatePropagation();
                if (!repeat) {
                    window.dispatchEvent(new Event('folia-tv-reveal-controls'));
                    document.querySelector<HTMLButtonElement>(selector)?.click();
                }
                return;
            }
        }
        const arrow = /^Arrow(Up|Down|Left|Right)$/.test(event.key);
        const nativeRegion = current?.closest<HTMLElement>('[data-tv-native-navigation]');
        const nativeKey = nativeRegion?.dataset.tvNativeNavigation === 'horizontal'
            ? event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Enter'
            : arrow || event.key === 'Enter';
        if (nativeRegion && nativeKey && tvScope().contains(nativeRegion) && !current.closest('button, input, select, textarea, a[href]')) {
            if (repeat && event.key === 'Enter') { event.preventDefault(); event.stopImmediatePropagation(); return; }
            const now = performance.now();
            if (!acceptTvRepeat(repeat && lastKey === event.key, now, lastTime)) {
                event.preventDefault(); event.stopImmediatePropagation();
            } else { lastKey = event.key; lastTime = now; }
            return;
        }
        const activate = event.key === 'Enter' || event.key === ' ' || event.key === 'Accept';
        if (!arrow && !activate) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const now = performance.now();
        if (arrow && !acceptTvRepeat(repeat && lastKey === event.key, now, lastTime)) return;
        lastKey = event.key; lastTime = now;
        repairFocus();
        const focused = document.activeElement as HTMLElement;
        if (!focused || focused === document.body) return;
        if (activate) {
            if (repeat) return;
            if (!guard.edit(focused)) focused.click();
            return;
        }
        if (event.key === 'ArrowRight' && focused.closest('[data-tv-sidebar]')) {
            pendingEntry = focused;
            focused.click();
            requestAnimationFrame(enterContent);
            return;
        }
        const next = tvNextControl(scope, focused, event.key as TvDirection, menus.get(scope));
        if (next) focusTvControl(next);
    };
    const onKeyUp = (event: KeyboardEvent) => { heldKeys.delete(event.key); lastKey = ''; longDown.keyup(event); };
    const cancelHold = () => { heldKeys.clear(); longDown.cancel(); };
    const onImeHidden = () => { guard.stop(); };
    // Newly mounted input fields are locked before the browser can display an IME. Repair focus
    // only on structural changes, never on every lyric/preview animation update.
    const observer = new MutationObserver(records => {
        let structural = !document.activeElement || document.activeElement === document.body;
        for (const record of records) for (const added of record.addedNodes) {
            if (!(added instanceof HTMLElement)) continue;
            if (isTvTextField(added)) guard.lock(added);
            prepare(added);
            if (added.matches('.fixed, [data-folia-tv-scope], [role="dialog"]') || added.querySelector('.fixed, [data-folia-tv-scope], [role="dialog"]')) structural = true;
        }
        if (structural && !frame) frame = requestAnimationFrame(repairFocus);
        if (pendingEntry) requestAnimationFrame(enterContent);
    });
    prepare(document);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', cancelHold);
    document.addEventListener('visibilitychange', cancelHold);
    window.addEventListener('folia-tv-ime-hidden', onImeHidden);
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('focusout', onBlur, true);
    document.addEventListener('click', onClick, true);
    frame = requestAnimationFrame(repairFocus);
    return () => {
        longDown.cancel(); guard.stop(); stopEditing = undefined; observer.disconnect(); cancelAnimationFrame(frame);
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('keyup', onKeyUp, true);
        window.removeEventListener('blur', cancelHold);
        document.removeEventListener('visibilitychange', cancelHold);
        window.removeEventListener('folia-tv-ime-hidden', onImeHidden);
        document.removeEventListener('focusin', onFocus, true);
        document.removeEventListener('focusout', onBlur, true);
        document.removeEventListener('click', onClick, true);
    };
};
