import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePracticeStore } from '../../src/stores/practiceStore';
import type { MistakeRecord } from '../../src/domain/practice/mistakes';
import { db } from '../../src/storage/db';
import { clearMistakes, clearSessions, upsertMistake } from '../../src/storage/repositories';
import { installVocabularyPackage } from '../../src/storage/vocabularyRepository';

describe('练习状态', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.stubGlobal('fetch', vi.fn(defaultFetch));
    await db.mistakes.clear();
    await db.sessions.clear();
    await db.preferences.clear();
    await db.vocabularyPackages.clear();
    await db.vocabularyEntries.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('按错键时记录错误键且不推进', async () => {
    const store = await createHydratedStore();

    const result = store.pressKey('s');

    expect(result.status).toBe('wrong');
    expect(store.wrongKey).toBe('s');
    expect(store.session.cursor.charIndex).toBe(0);
    expect(store.session.cursor.codeIndex).toBe(0);
    await waitForMistake(store.pendingMistake?.id ?? '');
  });

  it('默认统计为 0 且键盘不默认高亮', () => {
    const store = usePracticeStore();

    expect(store.keyboardActiveKey).toBeNull();
    expect(store.liveStats.accuracy).toBe(0);
    expect(store.liveStats.elapsedMs).toBe(0);
    expect(store.liveStats.maxCombo).toBe(0);
    expect(store.liveStats.wpm).toBe(0);
  });

  it('在线诗词未加载成功时不使用本地诗词兜底', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('测试环境模拟在线内容失败')));
    const store = usePracticeStore();

    await store.hydratePreferences();

    expect(store.module).toBe('poem');
    expect(store.activeUnit.text).toBe('');
    expect(store.currentCode).toBe('');
    expect(store.pressKey('d').status).toBe('ignored');
  });

  it('首页加载时会请求在线诗词作为默认练习内容', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/poetry-api/yiyan')) {
          return Promise.resolve(jsonResponse({
            code: 200,
            data: '行到水穷处坐看云起时《终南别业》 — 王维',
          }));
        }
        if (url.includes('/external-api/chicken-soup')) {
          return Promise.resolve(jsonResponse({
            code: 200,
            data: { content: '知不足而奋进，望远山而前行。' },
          }));
        }
        return Promise.reject(new Error('未模拟的请求'));
      }),
    );
    const store = usePracticeStore();

    await store.hydratePreferences();

    expect(store.activeUnit.text).toBe('行到水穷处坐看云起时');
    expect(store.currentCode).toBe('xk');
  });

  it('首页初始化会立刻进入取题状态，不等待每日一言返回', async () => {
    const quote = deferredResponse({
      code: 200,
      data: { content: '知不足而奋进，望远山而前行。' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/external-api/chicken-soup')) return quote.promise;
        if (url.includes('/poetry-api/yiyan')) {
          return Promise.resolve(jsonResponse({
            code: 200,
            data: '行到水穷处坐看云起时《终南别业》 — 王维',
          }));
        }
        return Promise.reject(new Error('未模拟的请求'));
      }),
    );
    const store = usePracticeStore();

    const hydrate = store.hydratePreferences();
    await Promise.resolve();

    expect(store.isSwitching).toBe(true);
    expect(store.awaitingOnlineContent).toBe(true);

    quote.resolve();
    await hydrate;
  });

  it('输入后更新顶部进度', async () => {
    const store = await createHydratedStore();

    expect(store.progressPercent).toBe(0);
    store.pressKey('x');

    expect(store.progressPercent).toBeGreaterThan(0);
  });

  it('切换自然码后刷新当前编码', async () => {
    const store = await createHydratedStore();

    store.setScheme('ziranma');

    expect(store.scheme.id).toBe('ziranma');
    expect(store.currentCode).toBe('xy');
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

  it('可以保存默认模块和逐字编码偏好', async () => {
    const store = usePracticeStore();

    await store.setDefaultModule('article');
    await store.setShowCharacterCodes(false);

    const preference = await waitForPreference();
    expect(preference.defaultModule).toBe('article');
    expect(preference.showCharacterCodes).toBe(false);
  });

  it('清空本地错题和练习记录', async () => {
    await upsertMistake(makeMistake({ id: 'mistake-clear' }));
    await db.sessions.put({
      id: 'session-clear',
      scheme: 'xiaohe',
      module: 'poem',
      accuracy: 100,
      wpm: 30,
      maxCombo: 10,
      elapsedMs: 1000,
      createdAt: Date.now(),
    });

    await clearMistakes();
    await clearSessions();

    expect(await db.mistakes.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
  });

  it('可以切换练习模块并重置题目', async () => {
    const store = usePracticeStore();

    await store.setModule('article');

    expect(store.module).toBe('article');
    expect(store.activeUnit.module).toBe('article');
    expect(store.progressPercent).toBe(0);
  });

  it('没有安装词库时进入词库练习会展示安装空状态', async () => {
    const store = usePracticeStore();

    await store.setModule('vocabulary');

    expect(store.module).toBe('vocabulary');
    expect(store.vocabularyNeedsInstall).toBe(true);
    expect(store.activeUnit.text).toBe('');
  });

  it('安装词库后可以进入 12 字词库练习', async () => {
    await installVocabularyPackage({
      schemaVersion: 1,
      id: 'daily-common',
      name: '日常常用词',
      version: '1.0.0',
      author: 'Shuangpin Cabin',
      license: 'MIT',
      pricingType: 'free',
      description: '适合日常输入热身。',
      tags: ['daily'],
      entries: [
        { text: '今天', weight: 99 },
        { text: '事情', weight: 98 },
        { text: '可以', weight: 97 },
        { text: '我们', weight: 96 },
        { text: '项目', weight: 95 },
        { text: '完成', weight: 94 },
      ],
    }, 'https://example.com/daily.json');
    const store = usePracticeStore();

    await store.setModule('vocabulary');

    expect(store.vocabularyNeedsInstall).toBe(false);
    expect(store.activeUnit.module).toBe('vocabulary');
    expect(store.activeUnit.text).toBe('今天事情可以我们项目完成');
    expect(store.activeUnit.lineCharCount).toBe(6);
    expect(store.session.codes).toHaveLength(12);
  });

  it('混合词库会使用全部已安装词库生成练习', async () => {
    await installVocabularyPackage({
      schemaVersion: 1,
      id: 'local-tech',
      name: '技术词库',
      version: '1.0.0',
      author: '本地导入',
      license: 'Personal',
      pricingType: 'owned',
      description: '本地技术词库。',
      tags: ['tech'],
      entries: [
        { text: '字符串', weight: 99 },
        { text: '初始化', weight: 98 },
        { text: '数组', weight: 97 },
      ],
    }, 'local-file:tech.json', { sourceType: 'local' });
    await installVocabularyPackage({
      schemaVersion: 1,
      id: 'remote-daily',
      name: '在线日常词库',
      version: '1.0.0',
      author: 'Shuangpin Cabin',
      license: 'MIT',
      pricingType: 'free',
      description: '在线日常词库。',
      tags: ['daily'],
      entries: [
        { text: '今天', weight: 96 },
        { text: '事情', weight: 95 },
        { text: '完成', weight: 94 },
      ],
    }, 'https://example.com/daily.json');
    const store = usePracticeStore();

    await store.setModule('vocabulary');
    await store.setMixedVocabularyPackage();

    expect(store.isMixedVocabularyMode).toBe(true);
    expect(store.currentVocabularyPackage?.name).toBe('混合词库');
    expect(store.activeUnit.source).toBe('混合词库');
    expect(store.activeUnit.text).toBe('字符串初始化数组今天事情');
  });

  it('只有一个本地词库时也可以进入混合词库模式', async () => {
    await installVocabularyPackage({
      schemaVersion: 1,
      id: 'local-only',
      name: '本地词库',
      version: '1.0.0',
      author: '本地导入',
      license: 'Personal',
      pricingType: 'owned',
      description: '本地词库。',
      tags: ['local'],
      entries: [
        { text: '今天', weight: 99 },
        { text: '事情', weight: 98 },
        { text: '完成', weight: 97 },
      ],
    }, 'local-file:local.json', { sourceType: 'local' });
    const store = usePracticeStore();

    await store.setModule('vocabulary');
    await store.setMixedVocabularyPackage();

    expect(store.isMixedVocabularyMode).toBe(true);
    expect(store.activeUnit.source).toBe('混合词库');
    expect(store.activeUnit.text).toBe('今天事情完成');
  });

  it('快速切换模块时，较慢返回的旧请求不能覆盖当前模块题目', async () => {
    const tongueTwister = deferredResponse({
      code: 0,
      data: { content: '四是四，十是十。' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/tongue-api/raokouling')) return tongueTwister.promise;
        if (url.includes('/poetry-api/yiyan')) {
          return Promise.resolve(jsonResponse({
            code: 200,
            data: '行到水穷处坐看云起时《终南别业》 — 王维',
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
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/poetry-api/yiyan')) {
          return Promise.resolve(jsonResponse({
            code: 200,
            data: '行到水穷处坐看云起时《终南别业》 — 王维',
          }));
        }
        return Promise.reject(new Error('未模拟的请求'));
      }),
    );
    const store = usePracticeStore();
    const firstId = store.activeUnit.id;

    await store.nextUnit();

    expect(store.activeUnit.id).not.toBe(firstId);
    expect(store.activeUnit.module).toBe('poem');
  });

  it('绕口令在线内容重复时，换一组不会回退到本地绕口令', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/tongue-api/raokouling')) {
          return Promise.resolve(jsonResponse({
            code: 0,
            data: { content: '四是四，十是十。十四是十四，四十是四十。' },
          }));
        }
        return Promise.reject(new Error('未模拟的请求'));
      }),
    );
    const store = usePracticeStore();

    await store.setModule('article');
    const firstText = store.activeUnit.text;
    await store.nextUnit();

    expect(store.activeUnit.text).toBe(firstText);
    expect(store.activeUnit.module).toBe('article');
  });

  it('按错键会生成待保存的易错记录', async () => {
    const store = await createHydratedStore();

    store.pressKey('s');

    expect(store.pendingMistake?.targetChar).toBe('行');
    expect(store.pendingMistake?.expectedKey).toBe('x');
    expect(store.pendingMistake?.actualKey).toBe('s');
    await waitForMistake(store.pendingMistake?.id ?? '');
  });

  it('按错键会保存并合并到本地易错库', async () => {
    const store = await createHydratedStore();

    store.pressKey('s');
    store.restartCurrent();
    store.pressKey('s');

    const record = await waitForMistake(store.pendingMistake?.id ?? '', 2);
    expect(record.count).toBe(2);
  });

  it('易错练习会优先加载当前方案下的高分错题', async () => {
    const store = usePracticeStore();
    await upsertMistake(makeMistake({ id: 'xiaohe-low', targetChar: '多', targetSyllable: 'duo', expectedCode: 'do', count: 1 }));
    await upsertMistake(makeMistake({ id: 'xiaohe-high', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qk', count: 8 }));

    await store.setModule('mistake');

    expect(store.activeUnit.text.startsWith('情')).toBe(true);
    expect(store.currentCode).toBe('qk');
  });

  it('易错练习会把同错因错题组成一组并暴露组信息', async () => {
    const store = usePracticeStore();
    await upsertMistake(makeMistake({ id: 'same-1', targetChar: '多', targetSyllable: 'duo', expectedCode: 'do', expectedKey: 'd', actualKey: 's', count: 5 }));
    await upsertMistake(makeMistake({ id: 'same-2', targetChar: '打', targetSyllable: 'da', expectedCode: 'da', expectedKey: 'd', actualKey: 's', count: 4 }));
    await upsertMistake(makeMistake({ id: 'other', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qk', expectedKey: 'q', actualKey: 'w', count: 1 }));

    await store.setModule('mistake');

    expect(store.activeUnit.text).toBe('多打');
    expect(store.mistakeGroupTitle).toBe('声母键误按');
    expect(store.mistakeGroupFocusKeys).toEqual(['s']);
    expect(store.mistakeGroupProgress.total).toBe(2);
    expect(store.mistakeGroupProgress.completed).toBe(0);
  });

  it('没有错题时易错练习会进入冷启动分组', async () => {
    const store = usePracticeStore();

    await store.setModule('mistake');

    expect(store.mistakeGroupEmpty).toBe(true);
    expect(store.mistakeGroupTitle).toBe('太棒了，没有出过错误');
    expect(store.activeUnit.text).toBe('');
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

  it('完成易错分组会标记组内所有错题连续正确', async () => {
    const store = usePracticeStore();
    await upsertMistake(makeMistake({ id: 'same-1', targetChar: '多', targetSyllable: 'duo', expectedCode: 'do', expectedKey: 'd', actualKey: 's', count: 5 }));
    await upsertMistake(makeMistake({ id: 'same-2', targetChar: '打', targetSyllable: 'da', expectedCode: 'da', expectedKey: 'd', actualKey: 's', count: 4 }));
    await store.setModule('mistake');

    for (const code of store.session.codes) {
      for (const key of code) {
        store.pressKey(key);
      }
    }

    const first = await waitForMistakeCorrect('same-1');
    const second = await waitForMistakeCorrect('same-2');
    expect(first.correctStreak).toBe(1);
    expect(second.correctStreak).toBe(1);
    expect(store.mistakeCompletion.practiced).toBe(2);
    expect(store.mistakeCompletion.streakGain).toBe(1);
  });

  it('完成后可以重新开始下一组', () => {
    const store = usePracticeStore();

    store.restartCurrent();

    expect(store.lastStatus).toBe('ignored');
    expect(store.progressPercent).toBe(0);
  });

  it('完成弹窗可以关闭且保留本轮统计', async () => {
    const store = await createHydratedStore();

    finishActiveUnit(store);

    expect(store.lastStatus).toBe('complete');
    const accuracy = store.liveStats.accuracy;
    const maxCombo = store.liveStats.maxCombo;

    store.closeCompletion();

    expect(store.lastStatus).toBe('ignored');
    expect(store.liveStats.accuracy).toBe(accuracy);
    expect(store.liveStats.maxCombo).toBe(maxCombo);
  });

  it('完成后点击下一组会立刻关闭完成弹窗', async () => {
    const store = await createHydratedStore();

    finishActiveUnit(store);

    expect(store.lastStatus).toBe('complete');

    const pendingNext = store.nextUnit();

    expect(store.lastStatus).toBe('ignored');
    await pendingNext;
  });

  it('完成一轮后会保存练习记录', async () => {
    const store = await createHydratedStore();

    finishActiveUnit(store);

    const session = await waitForSession();
    expect(session.module).toBe('poem');
    expect(session.scheme).toBe('xiaohe');
    expect(session.maxCombo).toBeGreaterThan(0);
  });
});

async function createHydratedStore() {
  const store = usePracticeStore();
  await store.hydratePreferences();
  return store;
}

function finishActiveUnit(store: ReturnType<typeof usePracticeStore>) {
  for (const code of store.session.codes) {
    for (const key of code) {
      store.pressKey(key);
    }
  }
}

function defaultFetch(url: string): Promise<Response> {
  if (url.includes('/poetry-api/yiyan')) {
    return Promise.resolve(jsonResponse({
      code: 200,
      data: '行到水穷处坐看云起时《终南别业》 — 王维',
    }));
  }
  if (url.includes('/tongue-api/raokouling')) {
    return Promise.resolve(jsonResponse({
      code: 0,
      data: { content: '四是四，十是十。十四是十四，四十是四十。' },
    }));
  }
  if (url.includes('/external-api/chicken-soup')) {
    return Promise.resolve(jsonResponse({
      code: 200,
      data: { content: '知不足而奋进，望远山而前行。' },
    }));
  }
  return Promise.reject(new Error('未模拟的请求'));
}

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
