import { describe, expect, it, vi } from 'vitest';
import { normalizeVocabularyPath, proxyVocabularyRequest } from '../../functions/api/vocabularies/[[path]]';

describe('Cloudflare 词库代理', () => {
  it('默认代理 registry.json', async () => {
    const fetcher = vi.fn(() => Promise.resolve(giteeContentResponse({
      schemaVersion: 1,
      updatedAt: '2026-06-17T00:00:00.000Z',
      packages: [{
        id: 'daily-common',
        name: '日常高频词',
        version: '1.0.0',
        description: '适合日常输入热身。',
        author: 'Shuangpin Cabin',
        pricingType: 'free',
        tags: ['daily'],
        entryCount: 1000,
        downloadUrl: 'https://your-gitee-pages-domain.example/packages/daily-common@1.0.0.json',
        mirrorUrls: ['https://your-gitee-pages-domain.example/packages/daily-common@1.0.0.json'],
      }],
    })));

    const response = await proxyVocabularyRequest(undefined, fetcher as unknown as typeof fetch);
    const registry = await response.json();

    expect(fetcher).toHaveBeenCalledWith('https://gitee.com/api/v5/repos/IQueue/shuangpin-vocabularies/contents/registry.json?ref=master', {
      headers: { Accept: 'application/json' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(registry.packages[0].downloadUrl).toBe('/api/vocabularies/packages/daily-common@1.0.0.json');
    expect(registry.packages[0].mirrorUrls).toEqual([]);
  });

  it('通过 Gitee contents API 代理版本化词库包', async () => {
    const fetcher = vi.fn(() => Promise.resolve(giteeContentResponse({
      schemaVersion: 1,
      id: 'daily-common',
      name: '日常高频词',
      version: '1.0.0',
      author: 'Shuangpin Cabin',
      license: 'MIT',
      pricingType: 'free',
      description: '适合日常输入热身。',
      tags: ['daily'],
      entries: [{ text: '今天' }],
    })));

    const response = await proxyVocabularyRequest(['packages', 'daily-common@1.0.0.json'], fetcher as unknown as typeof fetch);
    const packageFile = await response.json();

    expect(fetcher).toHaveBeenCalledWith('https://gitee.com/api/v5/repos/IQueue/shuangpin-vocabularies/contents/packages/daily-common%401.0.0.json?ref=master', {
      headers: { Accept: 'application/json' },
    });
    expect(packageFile.entries).toEqual([{ text: '今天' }]);
  });

  it('只允许 registry 和 packages 下的版本化 json 文件', () => {
    expect(normalizeVocabularyPath('registry.json')).toBe('registry.json');
    expect(normalizeVocabularyPath(['packages', 'daily-common@1.0.0.json'])).toBe('packages/daily-common@1.0.0.json');
    expect(normalizeVocabularyPath(['packages', '../secret.json'])).toBeNull();
    expect(normalizeVocabularyPath('README.md')).toBeNull();
    expect(normalizeVocabularyPath(['sources', 'VOCABULARY_SOURCES.md'])).toBeNull();
  });

  it('上游不存在时返回对应错误状态', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response('missing', { status: 404 })));

    const response = await proxyVocabularyRequest(['packages', 'missing@1.0.0.json'], fetcher as unknown as typeof fetch);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Vocabulary file not found');
  });
});

function giteeContentResponse(payload: unknown): Response {
  return jsonResponse({
    type: 'file',
    encoding: 'base64',
    content: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'),
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
