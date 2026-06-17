import { describe, expect, it } from 'vitest';
import { buildMistakeReview } from '../../src/domain/practice/mistakeReview';
import type { MistakeRecord } from '../../src/domain/practice/mistakes';
import { xiaoheScheme } from '../../src/domain/schemes/xiaohe';

describe('错题复盘 view model', () => {
  it('优先把最高风险错因组作为今日修正建议', () => {
    const review = buildMistakeReview([
      makeMistake({ id: 'low', targetChar: '多', expectedKey: 'd', actualKey: 's', count: 1, lastWrongAt: 1_000 }),
      makeMistake({ id: 'hot', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qk', expectedKey: 'q', actualKey: 'w', count: 8, lastWrongAt: 9_000 }),
    ], xiaoheScheme, 10_000);

    expect(review.topGroup?.title).toBe('声母键误按');
    expect(review.topGroup?.focusKeys).toEqual(['w']);
    expect(review.topGroup?.chars).toBe('情');
    expect(review.primaryFocusKey).toBe('W');
  });

  it('声母错误和韵母错误会进入不同错因分布', () => {
    const review = buildMistakeReview([
      makeMistake({ id: 'initial', errorType: 'initial-key', expectedKey: 'd', actualKey: 's' }),
      makeMistake({ id: 'final', errorType: 'final-key', expectedKey: 'o', actualKey: 'p' }),
    ], xiaoheScheme, 10_000);

    expect(review.distributions.map((item) => item.title)).toEqual(['声母键误按', '韵母键误按']);
    expect(review.distributions[0].focusKeys).toEqual(['S']);
    expect(review.distributions[1].focusKeys).toEqual(['P']);
  });

  it('连续正确三次的错题会降权并不作为首要建议', () => {
    const review = buildMistakeReview([
      makeMistake({ id: 'graduated', targetChar: '多', count: 20, correctStreak: 3, lastWrongAt: 9_000 }),
      makeMistake({ id: 'active', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qk', expectedKey: 'q', actualKey: 'w', count: 2, correctStreak: 0, lastWrongAt: 8_000 }),
    ], xiaoheScheme, 10_000);

    expect(review.activeCount).toBe(1);
    expect(review.topGroup?.chars).toBe('情');
    expect(review.details.find((item) => item.id === 'graduated')?.graduated).toBe(true);
  });

  it('只统计当前方案下的错题', () => {
    const review = buildMistakeReview([
      makeMistake({ id: 'xiaohe', scheme: 'xiaohe', targetChar: '多' }),
      makeMistake({ id: 'ziranma', scheme: 'ziranma', targetChar: '情', count: 99 }),
    ], xiaoheScheme, 10_000);

    expect(review.totalCount).toBe(1);
    expect(review.details.map((item) => item.char)).toEqual(['多']);
  });
});

function makeMistake(overrides: Partial<MistakeRecord>): MistakeRecord {
  return {
    id: 'xiaohe-duo-d-s',
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
    lastWrongAt: 1_000,
    lastCorrectAt: null,
    correctStreak: 0,
    averageCorrectionMs: 0,
    ...overrides,
  };
}
