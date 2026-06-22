const GITEE_CONTENTS_BASE = 'https://gitee.com/api/v5/repos/IQueue/shuangpin-vocabularies/contents';
const GITEE_REF = 'master';

interface GiteeContentFile {
  encoding?: string;
  content?: string;
}

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

  const upstream = await fetcher(`${GITEE_CONTENTS_BASE}/${encodeGiteePath(path)}?ref=${GITEE_REF}`, {
    headers: { Accept: 'application/json' },
  });
  if (!upstream.ok) {
    return new Response('Vocabulary file not found', { status: upstream.status });
  }
  const payload = await upstream.json() as GiteeContentFile;
  const text = decodeGiteeContent(payload);
  if (!text) {
    return new Response('Vocabulary file not found', { status: 502 });
  }

  return new Response(path === 'registry.json' ? normalizeRegistry(text) : text, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': path === 'registry.json'
        ? 'public, max-age=300'
        : 'public, max-age=86400',
    },
  });
}

function encodeGiteePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function decodeGiteeContent(payload: GiteeContentFile): string | null {
  if (payload.encoding !== 'base64' || typeof payload.content !== 'string') {
    return null;
  }
  const binary = atob(payload.content.replace(/\s+/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeRegistry(text: string): string {
  const registry = JSON.parse(text) as {
    packages?: Array<{ id: string; version: string; downloadUrl?: string; mirrorUrls?: string[] }>;
  };
  registry.packages = (registry.packages ?? []).map((item) => ({
    ...item,
    downloadUrl: `/api/vocabularies/packages/${item.id}@${item.version}.json`,
    mirrorUrls: [],
  }));
  return JSON.stringify(registry);
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
