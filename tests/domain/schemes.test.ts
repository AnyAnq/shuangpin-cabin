import { describe, expect, it } from 'vitest';
import { xiaoheScheme } from '../../src/domain/schemes/xiaohe';
import { ziranmaScheme } from '../../src/domain/schemes/ziranma';

describe('双拼方案', () => {
  it('编码小鹤双拼常见音节', () => {
    expect(xiaoheScheme.encodeSyllable('duo')).toBe('do');
    expect(xiaoheScheme.encodeSyllable('qing')).toBe('qk');
  });

  it('零声母音节按完整拼音提示，避免把 an 编成 jj', () => {
    expect(xiaoheScheme.encodeSyllable('an')).toBe('an');
    expect(ziranmaScheme.encodeSyllable('an')).toBe('an');
  });

  it('韵母为 a 的音节编码正确', () => {
    const cases = [
      ['a', 'a'],
      ['ba', 'ba'],
      ['pa', 'pa'],
      ['ma', 'ma'],
      ['fa', 'fa'],
      ['da', 'da'],
      ['ta', 'ta'],
      ['na', 'na'],
      ['la', 'la'],
      ['ga', 'ga'],
      ['ka', 'ka'],
      ['ha', 'ha'],
      ['zha', 'va'],
      ['cha', 'ia'],
      ['sha', 'ua'],
      ['za', 'za'],
      ['ca', 'ca'],
      ['sa', 'sa'],
      ['ya', 'ya'],
      ['wa', 'wa'],
    ];

    for (const [syllable, code] of cases) {
      expect(xiaoheScheme.encodeSyllable(syllable)).toBe(code);
      expect(ziranmaScheme.encodeSyllable(syllable)).toBe(code);
    }
  });

  it('编码自然码常见音节', () => {
    expect(ziranmaScheme.encodeSyllable('duo')).toBe('do');
    expect(ziranmaScheme.encodeSyllable('qing')).toBe('qy');
  });

  it('遇到不支持的拼音时抛出明确错误', () => {
    expect(() => xiaoheScheme.encodeSyllable('not-a-syllable')).toThrow('Unsupported syllable');
  });
});
