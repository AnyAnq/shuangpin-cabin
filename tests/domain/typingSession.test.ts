import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTypingReport } from '../../src/domain/practice/typing';
import { db } from '../../src/storage/db';
import * as repository from '../../src/storage/repositories';
import { useTypingStore } from '../../src/stores/typingStore';

const article = { id: 'test', title: '测试', text: '甲乙。丙丁。' };

beforeEach(async () => {
  setActivePinia(createPinia());
  await repository.clearSessions();
  await db.preferences.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('跟打会话与本地记录', () => {
  it('候选词不判错，首笔计时包含停顿，改正的句子保留复练但不扣交卷分', async () => {
    const store = useTypingStore();
    store.start(article);
    store.composing = true;
    store.markStarted(1000);
    store.commitText('jia', 2000);
    await store.finish(3000);
    expect(store.inputText).toBe('');
    expect(store.report).toBeNull();
    store.composing = false;
    store.commitText('甲错。', 5000);
    store.commitText(article.text, 10000);
    expect(store.report).toBeNull();
    await store.finish(61000);
    expect(store.report).toMatchObject({ accuracy: 100, cpm: 6, elapsedMs: 60000, reviewTexts: ['甲乙。'] });
    expect(await repository.listTypingSessions()).toEqual([store.report]);
    expect(await db.sessions.count()).toBe(0);
    expect(store.needsLeaveWarning).toBe(false);
  });

  it('保存失败保留报告，重试与重复交卷只保存同一条记录', async () => {
    const store = useTypingStore();
    store.start(article);
    store.commitText('甲乙。', 1000);
    const save = vi.spyOn(repository, 'saveTypingSession').mockRejectedValueOnce(new Error('quota'));
    await Promise.all([store.finish(61000), store.finish(61001)]);
    const id = store.report!.id;
    expect(save).toHaveBeenCalledTimes(1);
    expect(store.saveError).toContain('尚未保存');
    expect(store.needsLeaveWarning).toBe(true);
    expect(store.report).toMatchObject({ omissions: 3, accuracy: 50 });
    await store.persistReport();
    await store.finish(121000);
    expect(store.saveError).toBe('');
    expect(await repository.listTypingSessions()).toMatchObject([{ id, elapsedMs: 60000 }]);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('每日目标合计两种方案、全文和复练；清空记录保留设置', async () => {
    const now = new Date(2026, 8, 18, 12).getTime();
    const base = { id: 'keys', scheme: 'xiaohe' as const, module: 'poem' as const, accuracy: 100, wpm: 50, maxCombo: 1, elapsedMs: 60000, createdAt: now - 1000 };
    await db.sessions.bulkPut([base, { ...base, id: 'keys2', scheme: 'ziranma', elapsedMs: 120000 }, { ...base, id: 'yesterday', createdAt: now - 86400000 }]);
    for (const kind of ['full', 'review'] as const) {
      await repository.saveTypingSession(createTypingReport({ article, kind, inputText: article.text, elapsedMs: 30000, now, observedRanges: [] }));
    }
    const preferences = { id: 'default', scheme: 'xiaohe' as const, module: 'poem' as const, dailyGoalMinutes: 15, updatedAt: now };
    await repository.savePreferences(preferences);
    expect(await repository.totalPracticeTimeToday(now)).toBe(240000);
    await repository.clearSessions();
    expect(await db.sessions.count()).toBe(0);
    expect(await db.typingSessions.count()).toBe(0);
    expect(await repository.loadPreferences()).toEqual(preferences);
  });
});
