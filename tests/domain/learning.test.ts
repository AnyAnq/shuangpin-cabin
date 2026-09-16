import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { lessons, lessonUnit } from '../../src/domain/practice/lessons';
import { localDateKey, weeklyProgress } from '../../src/domain/practice/progress';
import { xiaoheScheme } from '../../src/domain/schemes/xiaohe';
import { ziranmaScheme } from '../../src/domain/schemes/ziranma';
import { usePracticeStore } from '../../src/stores/practiceStore';
import { db, type PracticeSessionRecord } from '../../src/storage/db';

beforeEach(async () => {
  setActivePinia(createPinia());
  await db.sessions.clear();
  await db.preferences.clear();
  await db.mistakes.clear();
});

describe('新手课程与学习记录', () => {
  it.each([xiaoheScheme, ziranmaScheme])('$name 的四节课程都能完整编码并完成', scheme => {
    for (const lesson of lessons) {
      const unit = lessonUnit(lesson.id);
      expect(unit.text.match(/\p{Script=Han}/gu)).toHaveLength(unit.syllables.length);
      expect(unit.syllables.map(scheme.encodeSyllable).every(code => /^[a-z]{2}$/.test(code))).toBe(true);
    }
    expect(() => lessonUnit('unknown')).toThrow('未找到');
  });

  it('达标会保存课程成绩，继续按键不重复记账，下一阶段复用当前方案', async () => {
    const store = usePracticeStore();
    store.setScheme('ziranma');
    await store.startLesson('initials');
    const keys = store.session.codes.join('');
    for (const key of keys) store.pressKey(key);
    store.pressKey('a');
    await vi.waitFor(async () => expect(await db.sessions.count()).toBe(1));
    const records = await db.sessions.toArray();
    expect(records[0]).toMatchObject({ module: 'lesson', lessonId: 'initials', scheme: 'ziranma', accuracy: 100 });
    await store.nextUnit();
    expect(store.currentLesson?.id).toBe('finals');
    expect(store.session.scheme.id).toBe('ziranma');
    expect(store.session.unit).toEqual(store.activeUnit);
  });

  it('未达标准时继续练同一课，最后一课完成后可以重练', async () => {
    const store = usePracticeStore();
    await store.startLesson('initials');
    store.pressKey('z');
    store.pressKey('z');
    for (const key of store.session.codes.join('')) store.pressKey(key);
    expect(store.lessonPassed).toBe(false);
    await vi.waitFor(async () => expect(await db.sessions.count()).toBe(1));
    await store.nextUnit();
    expect(store.currentLesson?.id).toBe('initials');
    await store.startLesson('sentences');
    for (const key of store.session.codes.join('')) store.pressKey(key);
    expect(store.nextLabel).toBe('再练本课');
    await vi.waitFor(async () => expect(await db.sessions.count()).toBe(2));
    await store.nextUnit();
    expect(store.currentLesson?.id).toBe('sentences');
  });

  it('目标设置随偏好保存、恢复，并拒绝无效分钟数', async () => {
    const store = usePracticeStore();
    await store.setDailyGoalMinutes(15);
    await store.setShowCharacterCodes(false);
    setActivePinia(createPinia());
    const restored = usePracticeStore();
    await restored.hydrateSettings();
    expect(restored.dailyGoalMinutes).toBe(15);
    expect(restored.showCharacterCodes).toBe(false);
    await expect(restored.setDailyGoalMinutes(0)).rejects.toThrow();
    await expect(restored.setDailyGoalMinutes(1.5)).rejects.toThrow();
    expect((await db.preferences.get('default'))?.dailyGoalMinutes).toBe(15);
  });

  it('按本地日期聚合七天，保留空白日期，兼容旧记录并排除窗口外数据', () => {
    const now = new Date(2026, 8, 16, 12).getTime();
    const make = (date: number, accuracy: number, wpm: number): PracticeSessionRecord => ({
      id: String(date), scheme: 'xiaohe', module: 'poem', createdAt: date,
      elapsedMs: 60000, accuracy, wpm, maxCombo: 10,
    });
    const days = weeklyProgress([
      make(new Date(2026, 8, 16, 0, 1).getTime(), 90, 20),
      make(new Date(2026, 8, 16, 10).getTime(), 100, 40),
      make(new Date(2026, 8, 15, 23, 59).getTime(), 80, 10),
      make(new Date(2026, 8, 9, 23).getTime(), 10, 1),
      make(now + 60000, 10, 1),
    ], now);
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ date: '2026-09-10', count: 0, accuracy: null, wpm: null });
    expect(days[5]).toMatchObject({ count: 1, accuracy: 80 });
    expect(days[6]).toMatchObject({ date: localDateKey(now), count: 2, accuracy: 95, wpm: 30, elapsedMs: 120000 });
  });
});
