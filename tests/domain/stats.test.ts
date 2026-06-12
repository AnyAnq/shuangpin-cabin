import { describe, expect, it } from 'vitest';
import { calculateAccuracy, calculateWpm } from '../../src/domain/practice/stats';

describe('练习统计', () => {
  it('根据正确和错误按键计算准确率', () => {
    expect(calculateAccuracy(8, 2)).toBe(80);
  });

  it('根据已完成字数和用时计算 WPM', () => {
    expect(calculateWpm({ completedChars: 20, elapsedMs: 60_000 })).toBe(20);
  });
});
