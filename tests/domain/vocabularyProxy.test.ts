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

  it('未登录时拒绝代理版本化词库包', async () => {
    const response = await proxyVocabularyRequest(['packages', 'daily-common@1.0.0.json'], vi.fn() as unknown as typeof fetch, {
      request: new Request('https://example.com/api/vocabularies/packages/daily-common@1.0.0.json'),
      env: { DB: new MemoryD1() },
    });

    expect(response.status).toBe(401);
  });

  it('登录但非会员时拒绝代理版本化词库包', async () => {
    const db = new MemoryD1();
    await db.seedSession('u_1', 'reader@example.com', 'token-1');

    const response = await proxyVocabularyRequest(['packages', 'daily-common@1.0.0.json'], vi.fn() as unknown as typeof fetch, {
      request: new Request('https://example.com/api/vocabularies/packages/daily-common@1.0.0.json', {
        headers: { Cookie: 'session=token-1' },
      }),
      env: { DB: db },
    });

    expect(response.status).toBe(403);
  });

  it('带有效兑换会员 token 时可以代理版本化词库包', async () => {
    const fetcher = vi.fn(() => Promise.resolve(giteeContentResponse({
      schemaVersion: 1,
      id: 'work-study',
      name: '工作学习',
      version: '1.0.0',
      author: 'Shuangpin Cabin',
      license: 'MIT',
      pricingType: 'paid',
      description: '适合工作学习场景。',
      tags: ['work'],
      entries: [{ text: '项目' }],
    })));
    const db = new MemoryD1();
    await db.seedRedeemToken('member-token-1');

    const response = await proxyVocabularyRequest(['packages', 'work-study@1.0.0.json'], fetcher as unknown as typeof fetch, {
      request: new Request('https://example.com/api/vocabularies/packages/work-study@1.0.0.json', {
        headers: { 'X-Membership-Token': 'member-token-1' },
      }),
      env: { DB: db },
    });
    const packageFile = await response.json();

    expect(response.status).toBe(200);
    expect(packageFile.entries).toEqual([{ text: '项目' }]);
  });

  it('管理员即使未开通会员也可以代理版本化词库包用于测试审核', async () => {
    const fetcher = vi.fn(() => Promise.resolve(giteeContentResponse({
      schemaVersion: 1,
      id: 'work-study',
      name: '工作学习',
      version: '1.0.0',
      author: 'Shuangpin Cabin',
      license: 'MIT',
      pricingType: 'paid',
      description: '适合工作学习场景。',
      tags: ['work'],
      entries: [{ text: '项目' }],
    })));
    const db = new MemoryD1();
    await db.seedSession('admin_1', 'admin@example.com', 'admin-token');

    const response = await proxyVocabularyRequest(['packages', 'work-study@1.0.0.json'], fetcher as unknown as typeof fetch, {
      request: new Request('https://example.com/api/vocabularies/packages/work-study@1.0.0.json', {
        headers: { Cookie: 'session=admin-token' },
      }),
      env: { DB: db, ADMIN_EMAILS: 'admin@example.com' },
    });
    const packageFile = await response.json();

    expect(response.status).toBe(200);
    expect(packageFile.entries).toEqual([{ text: '项目' }]);
  });

  it('永久会员通过 Gitee contents API 代理版本化词库包', async () => {
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
    const db = new MemoryD1();
    await db.seedSession('u_1', 'reader@example.com', 'token-1');
    db.tables.entitlements.push({
      id: 'entitlement_1',
      user_id: 'u_1',
      feature: 'online-vocabulary-lifetime',
      source: 'sponsor',
      active: 1,
      granted_at: '2026-06-22T00:00:00.000Z',
      revoked_at: null,
    });

    const response = await proxyVocabularyRequest(['packages', 'daily-common@1.0.0.json'], fetcher as unknown as typeof fetch, {
      request: new Request('https://example.com/api/vocabularies/packages/daily-common@1.0.0.json', {
        headers: { Cookie: 'session=token-1' },
      }),
      env: { DB: db },
    });
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
    const db = new MemoryD1();
    await db.seedSession('u_1', 'reader@example.com', 'token-1');
    db.tables.entitlements.push({
      id: 'entitlement_1',
      user_id: 'u_1',
      feature: 'online-vocabulary-lifetime',
      source: 'sponsor',
      active: 1,
      granted_at: '2026-06-22T00:00:00.000Z',
      revoked_at: null,
    });

    const response = await proxyVocabularyRequest(['packages', 'missing@1.0.0.json'], fetcher as unknown as typeof fetch, {
      request: new Request('https://example.com/api/vocabularies/packages/missing@1.0.0.json', {
        headers: { Cookie: 'session=token-1' },
      }),
      env: { DB: db },
    });

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

type Row = Record<string, unknown>;

class MemoryD1 {
  tables: Record<string, Row[]> = {
    users: [],
    sessions: [],
    entitlements: [],
    redeem_codes: [],
  };

  async seedSession(userId: string, email: string, token: string) {
    this.tables.users.push({ id: userId, email, created_at: now(), updated_at: now() });
    this.tables.sessions.push({
      id: `session_${userId}`,
      user_id: userId,
      token_hash: await sha256Hex(token),
      expires_at: '2099-01-01T00:00:00.000Z',
      created_at: now(),
    });
  }

  async seedRedeemToken(token: string) {
    this.tables.redeem_codes.push({
      id: 'redeem_1',
      code_hash: 'unused',
      token_hash: await sha256Hex(token),
      status: 'redeemed',
      created_at: now(),
      redeemed_at: now(),
      revoked_at: null,
    });
  }

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const db = this;
    return {
      bind(...values: unknown[]) {
        return {
          first: async () => db.first(normalized, values),
          run: async () => ({ success: true }),
          all: async () => ({ results: [] }),
        };
      },
    };
  }

  first(sql: string, values: unknown[]) {
    if (sql.includes('FROM sessions') && sql.includes('token_hash')) {
      const session = this.tables.sessions.find((row) => row.token_hash === values[0] && String(row.expires_at) > now());
      if (!session) return null;
      const user = this.tables.users.find((row) => row.id === session.user_id);
      return user ? { id: user.id, email: user.email } : null;
    }
    if (sql.includes('FROM entitlements')) {
      return this.tables.entitlements.find((row) => row.user_id === values[0] && row.feature === values[1] && row.active === 1) ?? null;
    }
    if (sql.includes('FROM redeem_codes') && sql.includes('token_hash')) {
      return this.tables.redeem_codes.find((row) => row.token_hash === values[0] && row.status === 'redeemed') ?? null;
    }
    return null;
  }
}

function now() {
  return '2026-06-22T00:00:00.000Z';
}

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
