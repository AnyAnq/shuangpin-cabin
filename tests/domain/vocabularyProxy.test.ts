import { describe, expect, it, vi } from 'vitest';
import { normalizeVocabularyPath, proxyVocabularyRequest } from '../../functions/api/vocabularies/[[path]]';

describe('Cloudflare 词库代理', () => {
  it('默认代理 registry.json', async () => {
    const fetcher = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));

    const response = await proxyVocabularyRequest(undefined, fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith('https://raw.githubusercontent.com/AnyAnq/shuangpin-cabin/master/vocabulary-gitee/registry.json');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
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

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
