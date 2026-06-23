import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearContentCache,
  consumeCachedPoetryUnit,
  ensureContentCache,
  getContentCacheSize,
} from '../../src/services/contentApi';

describe('在线内容缓存队列', () => {
  beforeEach(() => {
    clearContentCache();
    vi.unstubAllGlobals();
  });

  it('缓存少于目标数量时会补齐到 3 题且不会覆盖旧缓存', async () => {
    const poems = [
      '行到水穷处坐看云起时《终南别业》 — 王维',
      '春眠不觉晓处处闻啼鸟《春晓》 — 孟浩然',
      '白日依山尽黄河入海流《登鹳雀楼》 — 王之涣',
    ];
    let index = 0;
    vi.stubGlobal('fetch', vi.fn(() => {
      const data = poems[index];
      index += 1;
      return Promise.resolve(jsonResponse({ code: 200, data }));
    }));

    await ensureContentCache('poem', 3);

    expect(getContentCacheSize('poem')).toBe(3);
    expect(consumeCachedPoetryUnit()?.text).toBe('行到水穷处坐看云起时');
    expect(consumeCachedPoetryUnit()?.text).toBe('春眠不觉晓处处闻啼鸟');
    expect(getContentCacheSize('poem')).toBe(1);
  });

  it('缓存为空时消费返回 null', () => {
    expect(consumeCachedPoetryUnit()).toBeNull();
  });

  it('清空缓存后未完成的旧请求不会重新写回缓存', async () => {
    const pending = deferredJsonResponse({
      code: 200,
      data: '行到水穷处坐看云起时《终南别业》 — 王维',
    });
    vi.stubGlobal('fetch', vi.fn(() => pending.promise));

    const prefetch = ensureContentCache('poem', 1);
    clearContentCache('poem');
    pending.resolve();
    await prefetch;

    expect(getContentCacheSize('poem')).toBe(0);
  });
});

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(payload),
  } as Response;
}

function deferredJsonResponse(payload: unknown) {
  let resolve!: () => void;
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = () => resolvePromise(jsonResponse(payload));
  });
  return { promise, resolve };
}
