export interface ProxyContext {
  request: Request;
  params: {
    path?: string | string[];
  };
}

export interface ProxyOptions {
  baseUrl: string;
  allowedPath: RegExp;
  defaultPath?: string;
}

export async function proxyJsonRequest(context: ProxyContext, options: ProxyOptions, fetcher: typeof fetch = fetch): Promise<Response> {
  const path = normalizeProxyPath(context.params.path, options.defaultPath);
  if (!path || !options.allowedPath.test(path)) {
    return new Response('Not found', { status: 404 });
  }

  const sourceUrl = new URL(context.request.url);
  const upstreamUrl = `${options.baseUrl}/${path}${sourceUrl.search}`;
  const upstream = await fetcher(upstreamUrl, {
    headers: {
      'Accept': 'application/json,text/plain,*/*',
      'User-Agent': 'shuangpin-cabin-cloudflare-pages',
    },
  });

  if (!upstream.ok) {
    return new Response('Upstream request failed', { status: upstream.status });
  }

  return new Response(await upstream.text(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=5, s-maxage=5',
    },
  });
}

export function normalizeProxyPath(pathParam?: string | string[], defaultPath = ''): string | null {
  const path = Array.isArray(pathParam) ? pathParam.join('/') : pathParam || defaultPath;
  if (!path || path.includes('..') || path.startsWith('/')) {
    return null;
  }
  return path;
}
