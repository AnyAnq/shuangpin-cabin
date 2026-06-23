import { describe, expect, it, vi } from 'vitest';
import { handleAdminLogin } from '../../functions/api/admin/login';
import { handleListSponsorClaims } from '../../functions/_shared/sponsor';

describe('管理员密码登录', () => {
  it('密码正确后创建管理员会话并可读取赞助记录', async () => {
    const env = {
      DB: new MemoryD1(),
      ADMIN_EMAILS: 'admin@example.com',
      ADMIN_PASSWORD: 'secret-pass',
    };
    env.DB.tables.sponsor_claims.push({
      id: 'claim_1',
      user_id: 'u_1',
      email: 'reader@example.com',
      channel: 'wechat',
      amount_cny: 10,
      sponsored_at: now(),
      note: '',
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      created_at: now(),
      updated_at: now(),
    });

    const login = await handleAdminLogin({
      request: jsonRequest('https://example.com/api/admin/login', { password: 'secret-pass' }),
      env,
    });
    const cookie = login.headers.get('Set-Cookie') ?? '';
    const session = cookie.match(/session=([^;]+)/)?.[1] ?? '';
    const list = await handleListSponsorClaims({
      request: new Request('https://example.com/api/admin/sponsor-claims?status=pending', {
        headers: { Cookie: `session=${session}` },
      }),
      env,
    });
    const payload = await list.json() as { claims: Array<{ id: string }> };

    expect(login.status).toBe(200);
    expect(cookie).toContain('HttpOnly');
    expect(session).not.toBe('');
    expect(list.status).toBe(200);
    expect(payload.claims).toEqual([{ id: 'claim_1' }]);
  });

  it('密码错误时拒绝登录', async () => {
    const response = await handleAdminLogin({
      request: jsonRequest('https://example.com/api/admin/login', { password: 'wrong' }),
      env: {
        DB: new MemoryD1(),
        ADMIN_EMAILS: 'admin@example.com',
        ADMIN_PASSWORD: 'secret-pass',
      },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });
});

function jsonRequest(url: string, payload: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

type Row = Record<string, unknown>;

class MemoryD1 {
  tables: Record<string, Row[]> = {
    users: [],
    sessions: [],
    entitlements: [],
    sponsor_claims: [],
    admin_audit_logs: [],
    redeem_codes: [],
  };

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const db = this;
    return {
      bind(...values: unknown[]) {
        return {
          first: vi.fn(async () => db.first(normalized, values)),
          all: vi.fn(async () => ({ results: db.all(normalized, values) })),
          run: vi.fn(async () => {
            db.run(normalized, values);
            return { success: true };
          }),
        };
      },
    };
  }

  first(sql: string, values: unknown[]) {
    if (sql.includes('FROM users') && sql.includes('WHERE email = ?')) {
      return this.tables.users.find((row) => row.email === values[0]) ?? null;
    }
    if (sql.includes('FROM sessions') && sql.includes('token_hash')) {
      const session = this.tables.sessions.find((row) => row.token_hash === values[0] && String(row.expires_at) > now());
      if (!session) return null;
      const user = this.tables.users.find((row) => row.id === session.user_id);
      return user ? { id: user.id, email: user.email } : null;
    }
    return null;
  }

  all(sql: string, values: unknown[]) {
    if (sql.includes('FROM sponsor_claims')) {
      const status = values[0];
      return this.tables.sponsor_claims
        .filter((row) => !status || row.status === status)
        .map((row) => ({ id: row.id }));
    }
    return [];
  }

  run(sql: string, values: unknown[]) {
    if (sql.startsWith('INSERT INTO users')) {
      this.tables.users.push({
        id: values[0],
        email: values[1],
        created_at: values[2],
        updated_at: values[3],
      });
      return;
    }
    if (sql.startsWith('INSERT INTO sessions')) {
      this.tables.sessions.push({
        id: values[0],
        user_id: values[1],
        token_hash: values[2],
        expires_at: values[3],
        created_at: values[4],
      });
    }
  }
}

function now() {
  return '2026-06-23T00:00:00.000Z';
}
