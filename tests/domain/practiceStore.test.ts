import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePracticeStore } from '../../src/stores/practiceStore';
import type { MistakeRecord } from '../../src/domain/practice/mistakes';
import { db } from '../../src/storage/db';
import { upsertMistake } from '../../src/storage/repositories';

describe('练习状态', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('测试环境不请求在线内容')));
    await db.mistakes.clear();
    await db.sessions.clear();
    await db.preferences.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('按错键时记录错误键且不推进', async () => {
    const store = usePracticeStore();

    const result = store.pressKey('s');

    expect(result.status).toBe('wrong');
    expect(store.wrongKey).toBe('s');
    expect(store.session.cursor.charIndex).toBe(0);
    expect(store.session.cursor.codeIndex).toBe(0);
    await waitForMistake('xiaohe-poem-001-0-d-s');
  });

  it('默认统计为 0 且键盘不默认高亮', () => {
    const store = usePracticeStore();

    expect(store.keyboardActiveKey).toBeNull();
    expect(store.liveStats.accuracy).toBe(0);
    expect(store.liveStats.elapsedMs).toBe(0);
    expect(store.liveStats.maxCombo).toBe(0);
    expect(store.liveStats.wpm).toBe(0);
  });

  it('输入后更新顶部进度', () => {
    const store = usePracticeStore();

    expect(store.progressPercent).toBe(0);
    store.pressKey('d');

    expect(store.progressPercent).toBeGreaterThan(0);
  });

  it('切换自然码后刷新当前编码', () => {
    const store = usePracticeStore();

    store.setScheme('ziranma');

    expect(store.scheme.id).toBe('ziranma');
    expect(store.currentCode).toBe('do');
  });

  it('切换方案和模块会保存本地偏好', async () => {
    const store = usePracticeStore();

    store.setScheme('ziranma');
    await store.setModule('article');

    const preference = await waitForPreference();
    expect(preference.scheme).toBe('ziranma');
    expect(preference.module).toBe('article');
  });

  it('刷新首页会恢复方案，但练习模块默认回到诗词句子', async () => {
    await db.preferences.put({ id: 'default', scheme: 'ziranma', module: 'article', updatedAt: 1000 });
    const store = usePracticeStore();

    await store.hydratePreferences();

    expect(store.schemeId).toBe('ziranma');
    expect(store.module).toBe('poem');
    expect(store.activeUnit.module).toBe('poem');
  });

  it('旧版本保存的单字偏好会回到诗词模块', async () => {
    await db.preferences.put({ id: 'default', scheme: 'xiaohe', module: 'character', updatedAt: 1000 });
    const store = usePracticeStore();

    await store.hydratePreferences();

    expect(store.module).toBe('poem');
    expect(store.activeUnit.module).toBe('poem');
  });

  it('可以切换练习模块并重置题目', async () => {
    const store = usePracticeStore();

    await store.setModule('article');

    expect(store.module).toBe('article');
    expect(store.activeUnit.module).toBe('article');
    expect(store.progressPercent).toBe(0);
  });

  it('快速切换模块时，较慢返回的旧请求不能覆盖当前模块题目', async () => {
    const tongueTwister = deferredResponse({
      code: 200,
      data: '四是四，十是十。',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('tongue-twister')) return tongueTwister.promise;
        if (url.includes('diary-poetry')) {
          return Promise.resolve(jsonResponse({
            code: 200,
            data: {
              content: '行到水穷处坐看云起时',
              origin: '终南别业',
              author: '王维',
              category: '古诗文-山水',
            },
          }));
        }
        return Promise.reject(new Error('未模拟的请求'));
      }),
    );
    const store = usePracticeStore();

    const slowArticleSwitch = store.setModule('article');
    await store.setModule('poem');
    tongueTwister.resolve();
    await slowArticleSwitch;

    expect(store.module).toBe('poem');
    expect(store.activeUnit.module).toBe('poem');
    expect(store.activeUnit.text).toBe('行到水穷处坐看云起时');
  });

  it('换一组会切换到同模块下一题', async () => {
    const store = usePracticeStore();
    const firstId = store.activeUnit.id;

    await store.nextUnit();

    expect(store.activeUnit.id).not.toBe(firstId);
    expect(store.activeUnit.module).toBe('poem');
  });

  it('按错键会生成待保存的易错记录', async () => {
    const store = usePracticeStore();

    store.pressKey('s');

    expect(store.pendingMistake?.targetChar).toBe('多');
    expect(store.pendingMistake?.expectedKey).toBe('d');
    expect(store.pendingMistake?.actualKey).toBe('s');
    await waitForMistake('xiaohe-poem-001-0-d-s');
  });

  it('按错键会保存并合并到本地易错库', async () => {
    const store = usePracticeStore();

    store.pressKey('s');
    store.restartCurrent();
    store.pressKey('s');

    const record = await waitForMistake('xiaohe-poem-001-0-d-s', 2);
    expect(record.count).toBe(2);
  });

  it('易错练习会优先加载当前方案下的高分错题', async () => {
    const store = usePracticeStore();
    await upsertMistake(makeMistake({ id: 'xiaohe-low', targetChar: '多', targetSyllable: 'duo', expectedCode: 'do', count: 1 }));
    await upsertMistake(makeMistake({ id: 'xiaohe-high', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qk', count: 8 }));

    await store.setModule('mistake');

    expect(store.activeUnit.text).toBe('情');
    expect(store.currentCode).toBe('qk');
  });

  it('完成易错复练会标记该错题连续正确', async () => {
    const store = usePracticeStore();
    await upsertMistake(makeMistake({ id: 'xiaohe-high', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qk', count: 8 }));
    await store.setModule('mistake');

    store.pressKey('q');
    store.pressKey('k');

    const record = await waitForMistakeCorrect('xiaohe-high');
    expect(record.correctStreak).toBe(1);
  });

  it('完成后可以重新开始下一组', () => {
    const store = usePracticeStore();

    store.restartCurrent();

    expect(store.lastStatus).toBe('ignored');
    expect(store.progressPercent).toBe(0);
  });

  it('完成弹窗可以关闭且保留本轮统计', async () => {
    const store = usePracticeStore();
    await store.setModule('character');

    for (const key of store.currentCode) {
      store.pressKey(key);
    }

    expect(store.lastStatus).toBe('complete');
    const accuracy = store.liveStats.accuracy;
    const maxCombo = store.liveStats.maxCombo;

    store.closeCompletion();

    expect(store.lastStatus).toBe('ignored');
    expect(store.liveStats.accuracy).toBe(accuracy);
    expect(store.liveStats.maxCombo).toBe(maxCombo);
  });

  it('完成后点击下一组会立刻关闭完成弹窗', async () => {
    const store = usePracticeStore();
    await store.setModule('character');

    for (const key of store.currentCode) {
      store.pressKey(key);
    }

    expect(store.lastStatus).toBe('complete');

    const pendingNext = store.nextUnit();

    expect(store.lastStatus).toBe('ignored');
    await pendingNext;
  });

  it('完成一轮后会保存练习记录', async () => {
    const store = usePracticeStore();
    await store.setModule('character');

    for (const key of store.currentCode) {
      store.pressKey(key);
    }

    const session = await waitForSession();
    expect(session.module).toBe('character');
    expect(session.scheme).toBe('xiaohe');
    expect(session.maxCombo).toBe(2);
  });
});

async function waitForMistake(id: string, minCount = 1): Promise<MistakeRecord> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const record = await db.mistakes.get(id);
    if (record && record.count >= minCount) return record;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`未找到易错记录：${id}`);
}

function makeMistake(overrides: Partial<MistakeRecord>): MistakeRecord {
  return {
    id: 'xiaohe-low',
    scheme: 'xiaohe',
    module: 'poem',
    targetChar: '多',
    targetSyllable: 'duo',
    expectedCode: 'do',
    expectedKey: 'd',
    actualKey: 's',
    errorType: 'initial-key',
    contextText: '多情却被无情恼',
    count: 1,
    lastWrongAt: 1000,
    lastCorrectAt: null,
    correctStreak: 0,
    averageCorrectionMs: 0,
    ...overrides,
  };
}

async function waitForPreference() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const preference = await db.preferences.get('default');
    if (preference) return preference;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('未找到本地偏好');
}

async function waitForSession() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const session = await db.sessions.orderBy('createdAt').last();
    if (session) return session;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('未找到练习记录');
}

async function waitForMistakeCorrect(id: string): Promise<MistakeRecord> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const record = await db.mistakes.get(id);
    if (record && record.correctStreak > 0) return record;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`错题未标记连续正确：${id}`);
}

function deferredResponse(payload: unknown) {
  let resolve!: () => void;
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = () => resolvePromise(jsonResponse(payload));
  });
  return { promise, resolve };
}

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(payload),
  } as Response;
}
