import { describe, expect, it } from 'vitest';
import { groupMistakesForPractice, mistakeGroupToPracticeUnit, scoreMistake } from '../../src/domain/practice/mistakes';
import { xiaoheScheme } from '../../src/domain/schemes/xiaohe';

describe('易错评分', () => {
  it('优先处理高频且近期的错误', () => {
    const score = scoreMistake(
      {
        id: 'm1',
        scheme: 'xiaohe',
        module: 'poem',
        targetChar: '多',
        targetSyllable: 'duo',
        expectedCode: 'do',
        expectedKey: 'd',
        actualKey: 's',
        errorType: 'initial-key',
        contextText: '多情却被无情恼',
        count: 4,
        lastWrongAt: 1000,
        lastCorrectAt: null,
        correctStreak: 0,
        averageCorrectionMs: 900,
      },
      1000,
    );

    expect(score).toBeGreaterThan(12);
  });

  it('连续正确会降低复练优先级', () => {
    const score = scoreMistake(
      {
        id: 'm2',
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
        lastCorrectAt: 2000,
        correctStreak: 20,
        averageCorrectionMs: 200,
      },
      10_000,
    );

    expect(score).toBe(0);
  });
});

describe('易错分组复练', () => {
  it('高频且近期的同错因记录会优先组成第一组', () => {
    const groups = groupMistakesForPractice(
      [
        makeMistake({ id: 'old-low', targetChar: '云', targetSyllable: 'yun', expectedCode: 'yy', expectedKey: 'y', actualKey: 'u', count: 1, lastWrongAt: 1_000 }),
        makeMistake({ id: 'hot-1', targetChar: '多', targetSyllable: 'duo', expectedCode: 'do', expectedKey: 'd', actualKey: 's', count: 6, lastWrongAt: 20_000 }),
        makeMistake({ id: 'hot-2', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qk', expectedKey: 'q', actualKey: 's', count: 5, lastWrongAt: 19_000 }),
      ],
      xiaoheScheme,
      20_000,
    );

    expect(groups[0].title).toBe('声母键误按');
    expect(groups[0].focusKeys).toEqual(['s']);
    expect(groups[0].mistakeIds).toEqual(['hot-1', 'hot-2']);
    expect(groups[0].unit.text).toBe('多情');
  });

  it('声母错误和韵母错误会分到不同组', () => {
    const groups = groupMistakesForPractice(
      [
        makeMistake({ id: 'initial', errorType: 'initial-key', expectedKey: 'd', actualKey: 's' }),
        makeMistake({ id: 'final', errorType: 'final-key', expectedKey: 'o', actualKey: 'p' }),
      ],
      xiaoheScheme,
      20_000,
    );

    expect(groups.map((group) => group.reason.type)).toEqual(['initial-key', 'final-key']);
  });

  it('连续正确三次的错题会降权，不再抢占第一组', () => {
    const groups = groupMistakesForPractice(
      [
        makeMistake({ id: 'graduated', targetChar: '多', expectedKey: 'd', actualKey: 's', count: 10, correctStreak: 3 }),
        makeMistake({ id: 'active', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qk', expectedKey: 'q', actualKey: 'w', count: 2, correctStreak: 0 }),
      ],
      xiaoheScheme,
      20_000,
    );

    expect(groups[0].mistakeIds).toEqual(['active']);
    expect(groups.at(-1)?.mistakeIds).toEqual(['graduated']);
  });

  it('没有错题时返回冷启动练习组', () => {
    const [group] = groupMistakesForPractice([], xiaoheScheme, 20_000);

    expect(group.empty).toBe(true);
    expect(group.title).toBe('先积累错题');
    expect(group.unit.text).toBe('');
  });

  it('可以把错因组转换为练习单元', () => {
    const [group] = groupMistakesForPractice([makeMistake({ id: 'm1' })], xiaoheScheme, 20_000);
    const unit = mistakeGroupToPracticeUnit(group);

    expect(unit.id).toBe(group.unit.id);
    expect(unit.text).toBe(group.unit.text);
    expect(unit.syllables).toEqual(group.unit.syllables);
  });
});

function makeMistake(overrides: Partial<Parameters<typeof scoreMistake>[0]>): Parameters<typeof scoreMistake>[0] {
  return {
    id: 'm1',
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
    lastWrongAt: 10_000,
    lastCorrectAt: null,
    correctStreak: 0,
    averageCorrectionMs: 0,
    ...overrides,
  };
}
