import { describe, expect, it } from 'vitest';
import {
  buildVocabularyPracticeUnits,
  validateVocabularyPackage,
  validateVocabularyRegistry,
} from '../../src/domain/vocabulary';

describe('外置词库领域规则', () => {
  it('校验 registry 必填字段', () => {
    expect(() => validateVocabularyRegistry({
      schemaVersion: 1,
      updatedAt: '2026-06-17T00:00:00.000Z',
      packages: [{
        id: 'daily-common',
        name: '日常常用词',
        version: '1.0.0',
        description: '适合日常输入热身。',
        author: 'Shuangpin Cabin',
        pricingType: 'free',
        tags: ['daily'],
        entryCount: 2,
        downloadUrl: 'https://example.com/daily-common.json',
      }],
    })).not.toThrow();

    expect(() => validateVocabularyRegistry({
      schemaVersion: 1,
      updatedAt: '2026-06-17T00:00:00.000Z',
      packages: [{ id: 'broken' }],
    })).toThrow('词库索引格式不完整');
  });

  it('安装包只保留纯中文词条并过滤空词和符号词', () => {
    const packageFile = validateVocabularyPackage({
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
        { text: '项目', weight: 80 },
        { text: '' },
        { text: 'A计划' },
        { text: '你好！' },
      ],
    });

    expect(packageFile.entries.map((entry) => entry.text)).toEqual(['今天', '项目']);
  });

  it('按权重生成 12 字练习组并提供 6/6 分行信息', () => {
    const packageFile = validateVocabularyPackage({
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
        { text: '低频', weight: 1 },
      ],
    });

    const units = buildVocabularyPracticeUnits(packageFile);

    expect(units[0].text).toBe('今天事情可以我们项目完成');
    expect(units[0].lineCharCount).toBe(6);
    expect(units[0].syllables).toHaveLength(12);
  });
});
