// @vitest-environment node
import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import config from '../../vite.config';

const request = globalThis.fetch;
let vite: ViteDevServer;
let http: Server;
let base: string;

beforeAll(async () => {
  vite = await createServer({
    ...config, configFile: false, logLevel: 'silent',
    server: { ...config.server, middlewareMode: true, hmr: false, watch: null },
  });
  http = createHttpServer(vite.middlewares);
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + (http.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
  await vite.close();
});
afterEach(() => vi.unstubAllGlobals());

describe('本地词库 HTTP 接入', () => {
  it('无需 token，通过真实本地路由返回索引与词库包，而不是首页 HTML', async () => {
    const pack = { schemaVersion: 1, id: 'daily-common', entries: [{ text: '今天' }] };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(giteeResponse({
        schemaVersion: 1,
        packages: [{ id: 'daily-common', version: '1.0.0', downloadUrl: 'https://example.com/old.json' }],
      }))
      .mockResolvedValueOnce(giteeResponse(pack));
    vi.stubGlobal('fetch', fetcher);

    const response = await request(base + '/api/vocabularies/registry.json');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const registry = await response.json();
    expect(registry.packages[0].downloadUrl).toBe('/api/vocabularies/packages/daily-common@1.0.0.json');
    expect(fetcher.mock.calls[0][0]).toBe('https://gitee.com/api/v5/repos/IQueue/shuangpin-vocabularies/contents/registry.json?ref=master');

    const download = await request(base + registry.packages[0].downloadUrl.replace('@', '%40'));
    expect(download.status).toBe(200);
    expect(await download.json()).toEqual(pack);
    expect(download.headers.get('cache-control')).toContain('max-age=86400');
  });

  it.each([
    ['GET', '/api/vocabularies/README.md', 404],
    ['POST', '/api/vocabularies/registry.json', 405],
  ])('%s %s 拒绝无效请求，不访问上游', async (method, path, status) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect((await request(base + path, { method })).status).toBe(status);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('上游连接异常返回 502，不落入首页 HTML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    const response = await request(base + '/api/vocabularies/registry.json');
    expect(response.status).toBe(502);
    expect(await response.text()).toContain('词库源');
  });
});

function giteeResponse(payload: unknown): Response {
  return Response.json({
    encoding: 'base64',
    content: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'),
  });
}
