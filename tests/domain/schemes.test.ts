import { describe, expect, it } from 'vitest';
import { xiaoheScheme } from '../../src/domain/schemes/xiaohe';
import { ziranmaScheme } from '../../src/domain/schemes/ziranma';

describe('双拼方案', () => {
  it('编码小鹤双拼常见音节', () => {
    expect(xiaoheScheme.encodeSyllable('duo')).toBe('do');
    expect(xiaoheScheme.encodeSyllable('qing')).toBe('qk');
  });

  it('编码自然码常见音节', () => {
    expect(ziranmaScheme.encodeSyllable('duo')).toBe('do');
    expect(ziranmaScheme.encodeSyllable('qing')).toBe('qy');
  });

  it('遇到不支持的拼音时抛出明确错误', () => {
    expect(() => xiaoheScheme.encodeSyllable('not-a-syllable')).toThrow('Unsupported syllable');
  });
});
