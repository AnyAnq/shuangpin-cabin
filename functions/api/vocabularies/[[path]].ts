import { getCurrentUser, hasLifetimeMembership, isAdmin, json, type MembershipEnv } from '../../_shared/auth';
import { hasRedeemMembershipToken, readMembershipToken } from '../../_shared/redeem';

const GITEE_CONTENTS_BASE = 'https://gitee.com/api/v5/repos/IQueue/shuangpin-vocabularies/contents';
const GITEE_REF = 'master';

interface GiteeContentFile {
  encoding?: string;
  content?: string;
}

interface VocabularyProxyContext {
  request?: Request;
  env?: MembershipEnv & {
    GITEE_ACCESS_TOKEN?: string;
  };
  params: {
    path?: string | string[];
  };
}

export async function onRequestGet(context: VocabularyProxyContext): Promise<Response> {
  return proxyVocabularyRequest(context.params.path, fetch, context);
}

export async function proxyVocabularyRequest(pathParam?: string | string[], fetcher: typeof fetch = fetch, context?: Omit<VocabularyProxyContext, 'params'>): Promise<Response> {
  const path = normalizeVocabularyPath(pathParam);
  if (!path) {
    return new Response('Not found', { status: 404 });
  }
  if (path.startsWith('packages/')) {
    const access = await canDownloadVocabularyPackage(context);
    if (access instanceof Response) return access;
  }

  const upstream = await fetcher(buildGiteeContentsUrl(path, context?.env?.GITEE_ACCESS_TOKEN), {
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

async function canDownloadVocabularyPackage(context?: Omit<VocabularyProxyContext, 'params'>): Promise<true | Response> {
  const request = context?.request;
  const db = context?.env?.DB;
  if (!request || !db) {
    return json({ error: 'MEMBERSHIP_TOKEN_REQUIRED', message: '请先兑换永久会员' }, 401);
  }
  if (await hasRedeemMembershipToken(db, readMembershipToken(request))) {
    return true;
  }
  const user = await getCurrentUser(request, db);
  if (!user) {
    return json({ error: 'MEMBERSHIP_TOKEN_REQUIRED', message: '请先兑换永久会员' }, 401);
  }
  if (isAdmin(user, context.env ?? {})) {
    return true;
  }
  if (!await hasLifetimeMembership(db, user.id)) {
    return json({ error: 'MEMBERSHIP_REQUIRED', message: '赞助满 10 元可获赠永久会员后安装官方在线词库' }, 403);
  }
  return true;
}

function buildGiteeContentsUrl(path: string, accessToken?: string): string {
  const url = new URL(`${GITEE_CONTENTS_BASE}/${encodeGiteePath(path)}`);
  url.searchParams.set('ref', GITEE_REF);
  if (accessToken) url.searchParams.set('access_token', accessToken);
  return url.toString();
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
