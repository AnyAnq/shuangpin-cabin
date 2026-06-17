import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadVocabularyPackage } from '../../src/services/vocabularyRegistryService';

describe('词库下载服务', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('主下载地址失败后尝试备用地址', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === 'https://primary.example.com/daily.json') {
        return Promise.reject(new Error('主地址失败'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          schemaVersion: 1,
          id: 'daily-common',
          name: '日常常用词',
          version: '1.0.0',
          author: 'Shuangpin Cabin',
          license: 'MIT',
          pricingType: 'free',
          description: '适合日常输入热身。',
          tags: ['daily'],
          entries: [{ text: '今天' }],
        }),
      } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await downloadVocabularyPackage('https://primary.example.com/daily.json', ['https://mirror.example.com/daily.json']);

    expect(fetchMock).toHaveBeenCalledWith('https://primary.example.com/daily.json');
    expect(fetchMock).toHaveBeenCalledWith('https://mirror.example.com/daily.json');
    expect(result.sourceUrl).toBe('https://mirror.example.com/daily.json');
    expect(result.packageFile.name).toBe('日常常用词');
  });
});
