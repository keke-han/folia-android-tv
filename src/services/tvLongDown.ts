// src/services/tvLongDown.ts
// A held Down key returns to playback without repurposing any television system button.
export const createTvLongDown = (getAction: () => (() => void) | undefined, delay = 1000) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let held = false;
    let fired = false;
    const cancel = () => { clearTimeout(timer); timer = undefined; held = false; fired = false; };
    return {
        keydown(event: Pick<KeyboardEvent, 'key' | 'repeat'>) {
            if (event.key !== 'ArrowDown') { cancel(); return false; }
            if (held) return true;
            if (event.repeat) return false;
            const action = getAction();
            if (!action) return false;
            held = true;
            timer = setTimeout(() => {
                timer = undefined;
                const latestAction = held ? getAction() : undefined;
                if (latestAction) { fired = true; latestAction(); }
            }, delay);
            // A tap still performs ordinary navigation. Repeats are reserved for the shortcut.
            return false;
        },
        keyup(event: Pick<KeyboardEvent, 'key'>) {
            if (event.key !== 'ArrowDown') return;
            cancel();
        },
        cancel,
        get fired() { return fired; },
    };
};
