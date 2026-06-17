import { describe, expect, it, vi } from 'vitest';
import { normalizeProxyPath, proxyJsonRequest } from '../../functions/_shared/proxy';

describe('Cloudflare 内容 API 代理', () => {
  it('保留查询参数并代理到上游接口', async () => {
    const fetcher = vi.fn(() => Promise.resolve(jsonResponse({ code: 200, data: '诗词' })));

    const response = await proxyJsonRequest({
      request: new Request('https://example.com/poetry-api/yiyan?type=poetry'),
      params: { path: 'yiyan' },
    }, {
      baseUrl: 'https://v2.xxapi.cn/api',
      allowedPath: /^yiyan$/,
    }, fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith('https://v2.xxapi.cn/api/yiyan?type=poetry', expect.any(Object));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });

  it('拒绝未允许路径和目录穿越路径', async () => {
    expect(normalizeProxyPath(['..', 'secret'])).toBeNull();

    const response = await proxyJsonRequest({
      request: new Request('https://example.com/poetry-api/secret'),
      params: { path: 'secret' },
    }, {
      baseUrl: 'https://v2.xxapi.cn/api',
      allowedPath: /^yiyan$/,
    }, vi.fn() as unknown as typeof fetch);

    expect(response.status).toBe(404);
  });
});

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
