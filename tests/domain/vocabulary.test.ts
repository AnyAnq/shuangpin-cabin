import { describe, expect, it } from 'vitest';
import {
  buildVocabularyPracticeUnits,
  createVocabularyExportFile,
  parseLocalVocabularyFile,
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

  it('从 TXT 词表生成本地词库并统计过滤和重复', () => {
    const report = parseLocalVocabularyFile('我的法律词库.txt', [
      '合同',
      '项目,80,工作',
      '练习,60,基础|输入',
      '项目,90,管理',
      'A计划',
      '超长超长超长超长超长超长超长',
      '',
    ].join('\n'), 1718697600000);

    expect(report.fileKind).toBe('plain');
    expect(report.packageFile.id).toBe('local-我的法律词库-1718697600000');
    expect(report.packageFile.name).toBe('我的法律词库');
    expect(report.packageFile.author).toBe('本地导入');
    expect(report.packageFile.pricingType).toBe('owned');
    expect(report.packageFile.tags).toEqual(['custom', 'local']);
    expect(report.validCount).toBe(3);
    expect(report.duplicateCount).toBe(1);
    expect(report.filteredCount).toBe(3);
    expect(report.filterReasons).toEqual({
      '含英文、数字或符号': 1,
      '超过 12 字': 1,
      '空行': 1,
    });
    expect(report.packageFile.entries).toEqual([
      { text: '合同', weight: 100, tags: undefined, source: undefined },
      { text: '项目', weight: 90, tags: ['工作', '管理'], source: undefined },
      { text: '练习', weight: 60, tags: ['基础', '输入'], source: undefined },
    ]);
    expect(report.previewEntries.map((entry) => entry.text)).toEqual(['合同', '项目', '练习']);
  });

  it('从 CSV 词表跳过 text weight tags 表头', () => {
    const report = parseLocalVocabularyFile('daily.csv', [
      'text,weight,tags',
      '今天,88,日常/基础',
      '事情,,日常、工作',
    ].join('\n'), 1718697600000);

    expect(report.packageFile.name).toBe('daily');
    expect(report.validCount).toBe(2);
    expect(report.packageFile.entries).toEqual([
      { text: '今天', weight: 88, tags: ['日常', '基础'], source: undefined },
      { text: '事情', weight: 99, tags: ['日常', '工作'], source: undefined },
    ]);
  });

  it('导入标准 JSON 包时复用现有校验并标记为 JSON 类型', () => {
    const report = parseLocalVocabularyFile('custom.json', JSON.stringify({
      schemaVersion: 1,
      id: 'custom-json',
      name: 'JSON 词库',
      version: '1.0.0',
      author: '用户',
      license: 'Personal',
      pricingType: 'owned',
      description: '用户制作',
      tags: ['custom'],
      entries: [{ text: '今天', weight: 100 }, { text: 'A计划' }],
    }), 1718697600000);

    expect(report.fileKind).toBe('json');
    expect(report.packageFile.id).toBe('custom-json');
    expect(report.validCount).toBe(1);
    expect(report.filteredCount).toBe(1);
    expect(report.previewEntries).toEqual([{ text: '今天', weight: 100, tags: undefined, source: undefined }]);
  });

  it('导入 JSON 包时允许省略本地元信息字段并补默认值', () => {
    const report = parseLocalVocabularyFile('minimal.json', JSON.stringify({
      schemaVersion: 1,
      id: 'minimal-json',
      name: '最小 JSON 词库',
      version: '1.0.0',
      author: '用户',
      entries: [{ text: '今天', weight: 100 }],
    }), 1718697600000);

    expect(report.packageFile.license).toBe('Personal');
    expect(report.packageFile.pricingType).toBe('owned');
    expect(report.packageFile.description).toBe('从本地文件导入的自定义词库');
    expect(report.packageFile.tags).toEqual(['custom', 'local']);
    expect(report.validCount).toBe(1);
  });

  it('导出文件能再次通过词库包校验', () => {
    const exported = createVocabularyExportFile({
      id: 'local-export',
      name: '导出词库',
      version: '1.0.0',
      author: '本地导入',
      license: 'Personal',
      pricingType: 'owned',
      description: '导出测试',
      tags: ['custom', 'local'],
    }, [
      { text: '今天', weight: 100, tags: ['日常'] },
      { text: '项目', weight: 90, tags: ['工作'] },
    ]);

    expect(validateVocabularyPackage(exported)).toEqual(exported);
  });
});
