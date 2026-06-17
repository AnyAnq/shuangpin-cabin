const GITEE_BASE = 'https://gitee.com/IQueue/shuangpin-vocabularies/raw/master';

interface VocabularyProxyContext {
  params: {
    path?: string | string[];
  };
}

export async function onRequestGet(context: VocabularyProxyContext): Promise<Response> {
  return proxyVocabularyRequest(context.params.path);
}

export async function proxyVocabularyRequest(pathParam?: string | string[], fetcher: typeof fetch = fetch): Promise<Response> {
  const path = normalizeVocabularyPath(pathParam);
  if (!path) {
    return new Response('Not found', { status: 404 });
  }

  const upstream = await fetcher(`${GITEE_BASE}/${path}`);
  if (!upstream.ok) {
    return new Response('Vocabulary file not found', { status: upstream.status });
  }

  return new Response(await upstream.text(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': path === 'registry.json'
        ? 'public, max-age=300'
        : 'public, max-age=86400',
    },
  });
}

export function normalizeVocabularyPath(pathParam?: string | string[]): string | null {
  const path = Array.isArray(pathParam) ? pathParam.join('/') : pathParam || 'registry.json';
  if (path === 'registry.json') {
    return path;
  }
  if (/^packages\/[a-z0-9-]+@\d+\.\d+\.\d+\.json$/.test(path)) {
    return path;
  }
  return null;
}
