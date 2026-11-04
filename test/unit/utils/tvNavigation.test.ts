import { describe, expect, it } from 'vitest';
import { findTvNeighbor, acceptTvRepeat, type TvRect } from '../../../src/utils/tvNavigation';
// test/unit/utils/tvNavigation.test.ts

const rect = (x: number, y: number, width = 100, height = 40): TvRect => ({ left: x, top: y, right: x + width, bottom: y + height });

describe('TV directional focus', () => {
    it('moves below the last card to the parameter tabs instead of a wide card above', () => {
        const candidates = [rect(0, 0, 600, 100), rect(0, 270, 80, 36), rect(500, 280)];
        expect(findTvNeighbor(rect(0, 150, 120, 80), candidates, 'ArrowDown')).toBe(1);
    });
    it('keeps horizontal navigation on the same row', () => {
        expect(findTvNeighbor(rect(100, 100), [rect(230, 120), rect(210, 300)], 'ArrowRight')).toBe(0);
    });
    it('can reach offscreen controls in a long scrolling form', () => {
        expect(findTvNeighbor(rect(100, 700), [rect(100, 820), rect(0, 100)], 'ArrowDown')).toBe(0);
    });
    it('does not skip a nearby choice row for a distant full-width slider', () => {
        expect(findTvNeighbor(rect(800, 0), [rect(300, 80), rect(250, 200, 700, 30)], 'ArrowDown')).toBe(0);
    });
    it('stays on the boundary when no candidate exists', () => {
        expect(findTvNeighbor(rect(100, 100), [rect(100, 10)], 'ArrowDown')).toBe(-1);
    });
    it('accepts rapid separate presses and limits only held-key repeats', () => {
        expect(acceptTvRepeat(false, 10, 0)).toBe(true);
        expect(acceptTvRepeat(true, 50, 0)).toBe(false);
        expect(acceptTvRepeat(true, 90, 0)).toBe(true);
    });
});
