import { describe, expect, it } from 'vitest';
import merge from 'deepmerge';

// 当前文件：验证构建链本地 deepmerge 修订的原型边界和兼容行为。
describe('build dependency deepmerge security patch', () => {
    it.each(['__proto__', 'constructor', 'prototype'])('rejects dangerous key %s in target and source', key => {
        const malicious = JSON.parse(`{"${key}":{"admin":true},"safe":1}`);
        for (const result of [merge<Record<string, unknown>>(malicious, {}), merge<Record<string, unknown>>({}, malicious), merge.all<Record<string, unknown>>([malicious, { ok: true }])]) {
            expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
            expect(Object.hasOwn(result, key)).toBe(false);
            expect((result as any).admin).toBeUndefined();
            expect(result.safe).toBe(1);
        }
        expect(({} as any).admin).toBeUndefined();
    });
    it('also rejects nested and null-prototype target poisoning', () => {
        const target = Object.assign(Object.create(null), JSON.parse('{"__proto__":{"admin":true}}'));
        const result = merge({ nested: target }, { nested: { value: 2 } });
        expect(Object.getPrototypeOf(result.nested)).toBe(Object.prototype);
        expect((result.nested as any).admin).toBeUndefined();
        expect(result.nested.value).toBe(2);
    });
    it('retains nested values, array concatenation and enumerable symbol keys', () => {
        const symbol = Symbol('build');
        const input = { config: { first: true }, list: [1], [symbol]: { enabled: true } };
        const result = merge(input, { config: { second: true }, list: [2] });
        expect(result).toMatchObject({ config: { first: true, second: true }, list: [1, 2] });
        expect(result[symbol]).toEqual({ enabled: true });
        expect(result.config).not.toBe(input.config);
    });
    it('retains custom array merging and clone=false behavior', () => {
        const object = { value: 1 };
        expect(merge({}, { object }, { clone: false }).object).toBe(object);
        expect(merge({ list: [1] }, { list: [2] }, { arrayMerge: (_target, source) => source })).toEqual({ list: [2] });
    });
});
