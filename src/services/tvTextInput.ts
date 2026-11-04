// src/services/tvTextInput.ts
// Focus is navigation; only activation gives a text field permission to open the IME.
type TextField = HTMLInputElement | HTMLTextAreaElement;
const TEXT_TYPES = new Set(['text', 'search', 'url', 'email', 'password', 'tel', 'number']);
export const isTvTextField = (node: unknown): node is TextField => node instanceof HTMLTextAreaElement
    || (node instanceof HTMLInputElement && TEXT_TYPES.has(node.type));

export const createTvTextInputGuard = (showKeyboard: (visible: boolean) => void = () => {}) => {
    const originals = new WeakMap<TextField, { readOnly: boolean; inputMode: string }>();
    let editing: TextField | null = null;
    const remember = (input: TextField) => {
        if (!originals.has(input)) originals.set(input, { readOnly: input.readOnly, inputMode: input.inputMode });
        return originals.get(input)!;
    };
    const lock = (node: unknown): boolean => {
        if (!isTvTextField(node)) return false;
        const original = remember(node);
        if (original.readOnly) return false;
        node.readOnly = true;
        node.inputMode = 'none';
        if (editing === node) {
            editing = null;
            delete node.dataset.tvEditing;
            showKeyboard(false);
        }
        return true;
    };
    const edit = (node: unknown): boolean => {
        if (!isTvTextField(node) || node.disabled) return false;
        const original = remember(node);
        if (original.readOnly) return false;
        if (editing && editing !== node) lock(editing);
        editing = node;
        node.readOnly = false;
        node.inputMode = original.inputMode;
        node.dataset.tvEditing = 'true';
        node.focus({ preventScroll: true });
        showKeyboard(true);
        return true;
    };
    const stop = () => {
        if (!editing) return false;
        lock(editing);
        return true;
    };
    return { lock, edit, stop, isEditing: (node: unknown) => editing === node && editing !== null };
};
