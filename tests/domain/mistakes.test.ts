import { describe, expect, it } from 'vitest';
import { scoreMistake } from '../../src/domain/practice/mistakes';

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
