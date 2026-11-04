import { hasBlockingWindow } from '../utils/keyboardTargets';
import { findTvNeighbor, type TvDirection } from '../utils/tvNavigation';
// src/services/tvRemoteDom.ts
// DOM queries happen on navigation events, never continuously on the animation path.

const CONTROLS = 'button, a[href], input:not([type="hidden"]), textarea, select, [tabindex], [role="switch"], [role="checkbox"], [role="button"]';

export const tvVisible = (node: HTMLElement): boolean => {
    if (node.closest('[hidden], [inert], [aria-hidden="true"]') || !node.getClientRects().length) return false;
    const style = getComputedStyle(node);
    return style.visibility !== 'hidden' && style.display !== 'none';
};

export const tvControls = (scope: HTMLElement): HTMLElement[] => Array.from(scope.querySelectorAll<HTMLElement>(CONTROLS))
    .filter(node => !node.matches(':disabled, [aria-disabled="true"], [tabindex="-1"]') && tvVisible(node));

/** Only ordinary browse/settings surfaces may hand focus to the shared bottom bar. */
export const tvTransportEntry = (scope: HTMLElement): HTMLElement | undefined => {
    const kind = scope.dataset.foliaTvScope;
    if (kind ? !['settings', 'visualizer', 'theme'].includes(kind) : hasBlockingWindow() || scope.getAttribute('role') === 'dialog') return undefined;
    return document.querySelector<HTMLElement>('[data-tv-now-playing]') ?? undefined;
};

/** Full-window layers isolate focus; compact native/custom select popovers keep their own keys. */
export const tvScope = (): HTMLElement => {
    const layers = Array.from(document.querySelectorAll<HTMLElement>('[data-folia-tv-scope], [role="dialog"], .fixed'))
        .filter(node => {
            if (!tvVisible(node)) return false;
            const box = node.getBoundingClientRect();
            return node.hasAttribute('data-folia-tv-scope') || node.getAttribute('role') === 'dialog'
                || (box.width > innerWidth * 0.5 && box.height > innerHeight * 0.5 && getComputedStyle(node).pointerEvents !== 'none');
        });
    const zIndex = (node: HTMLElement): number => {
        let z = 0;
        for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
            const value = Number.parseInt(getComputedStyle(parent).zIndex, 10);
            if (!Number.isNaN(value)) z += value;
        }
        return z;
    };
    layers.sort((a, b) => zIndex(a) - zIndex(b));
    return layers.at(-1) ?? document.body;
};

export const focusTvControl = (node: HTMLElement): void => {
    if (!node.matches('button, a, input, textarea, select, [tabindex]')) node.tabIndex = 0;
    node.focus({ preventScroll: true });
    node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
};

/** Enter the actual choice group instead of a reset/pause control above it. */
const tvEntryControl = (target: HTMLElement): HTMLElement | undefined => {
    const controls = tvControls(target);
    return controls.find(node => node.hasAttribute('data-tv-entry')) ?? controls[0];
};

/** Sidebar order is explicit; content uses geometry with a left-boundary return to the selected menu. */
export const tvNextControl = (scope: HTMLElement, current: HTMLElement, direction: TvDirection, remembered?: HTMLElement): HTMLElement | undefined => {
    const controls = tvControls(scope);
    const sidebar = current.closest<HTMLElement>('[data-tv-sidebar]');
    if (sidebar && (direction === 'ArrowDown' || direction === 'ArrowUp')) {
        const items = controls.filter(node => sidebar.contains(node));
        const next = items[items.indexOf(current) + (direction === 'ArrowDown' ? 1 : -1)];
        if (next) return next;
        if (direction === 'ArrowDown') return tvTransportEntry(scope);
        const header = controls.filter(node => !node.closest('[data-tv-sidebar], [data-tv-content]'));
        return header[findTvNeighbor(current.getBoundingClientRect(), header.map(node => node.getBoundingClientRect()), direction)];
    }
    if (sidebar && direction === 'ArrowLeft') return tvTransportEntry(scope);
    const content = scope.querySelector<HTMLElement>('[data-tv-content]');
    if (sidebar && direction === 'ArrowRight' && content) {
        const anchor = current.dataset.tvAnchor;
        const target = anchor ? content.querySelector<HTMLElement>(`[data-settings-anchor="${anchor}"]`) : content;
        return tvEntryControl(target ?? content);
    }
    const origin = current.getBoundingClientRect();
    const inContent = content?.contains(current);
    const horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight';
    const peers = controls.filter(node => {
        if (node === current || (inContent && !content?.contains(node))) return false;
        if (!inContent || !horizontal) return true;
        const box = node.getBoundingClientRect();
        return Math.min(origin.bottom, box.bottom) > Math.max(origin.top, box.top);
    });
    const index = findTvNeighbor(current.getBoundingClientRect(), peers.map(node => node.getBoundingClientRect()), direction);
    if (index >= 0) return peers[index];
    if (direction === 'ArrowUp' && inContent) {
        const header = controls.filter(node => !node.closest('[data-tv-sidebar], [data-tv-content]'));
        return header[findTvNeighbor(origin, header.map(node => node.getBoundingClientRect()), direction)];
    }
    if (direction === 'ArrowLeft' && content?.contains(current)) {
        return remembered?.isConnected ? remembered
            : scope.querySelector<HTMLElement>('[data-tv-sidebar] [aria-current], [data-tv-sidebar] [aria-pressed="true"]')
                ?? scope.querySelector<HTMLElement>('[data-tv-sidebar] button') ?? undefined;
    }
    if (direction === 'ArrowDown') return tvTransportEntry(scope);
    return undefined;
};
