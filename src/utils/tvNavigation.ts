// src/utils/tvNavigation.ts
// Pure directional selection; candidates may be outside a scroll viewport.
export type TvDirection = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
export interface TvRect { left: number; top: number; right: number; bottom: number; }

export const acceptTvRepeat = (repeat: boolean, now: number, previous: number): boolean => !repeat || now - previous >= 90;

/** Prefer the same row/column, then the nearest item in the requested half-plane. */
export const findTvNeighbor = (origin: TvRect, candidates: TvRect[], direction: TvDirection): number => {
    const vertical = direction === 'ArrowUp' || direction === 'ArrowDown';
    const sign = direction === 'ArrowUp' || direction === 'ArrowLeft' ? -1 : 1;
    const primary = (r: TvRect) => vertical ? (r.top + r.bottom) / 2 : (r.left + r.right) / 2;
    const cross = (r: TvRect) => vertical ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2;
    const nearestRow = vertical ? Math.min(...candidates.map(candidate => (primary(candidate) - primary(origin)) * sign).filter(distance => distance > 1)) : Infinity;
    let best = -1;
    let bestScore = Infinity;
    candidates.forEach((candidate, index) => {
        const distance = (primary(candidate) - primary(origin)) * sign;
        if (distance <= 1 || (vertical && distance > nearestRow + 24)) return;
        const overlap = vertical
            ? Math.min(origin.right, candidate.right) - Math.max(origin.left, candidate.left)
            : Math.min(origin.bottom, candidate.bottom) - Math.max(origin.top, candidate.top);
        const score = distance + Math.abs(cross(candidate) - cross(origin)) * 2 + (overlap > 0 ? 0 : 10000);
        if (score < bestScore) { best = index; bestScore = score; }
    });
    return best;
};
