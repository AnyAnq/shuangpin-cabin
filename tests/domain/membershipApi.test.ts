import { describe, expect, it, vi } from 'vitest';
import { handleApproveSponsorClaim, handleCreateSponsorClaim, handleThanksOnlySponsorClaim } from '../../functions/_shared/sponsor';
import { hasLifetimeMembership } from '../../functions/_shared/auth';

describe('赞助会员 API 规则', () => {
  it('未登录用户使用付款备注邮箱提交赞助记录后进入待审核状态', async () => {
    const env = createEnv();

    const response = await handleCreateSponsorClaim({
      request: jsonRequest('https://example.com/api/sponsor-claims', {
        email: 'reader@example.com',
        channel: 'wechat',
        amountCny: 10,
        sponsoredAt: '2026-06-22T10:00:00.000Z',
        note: '已备注邮箱',
      }),
      env,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ status: 'pending' });
    expect(env.DB.tables.sponsor_claims).toHaveLength(1);
    expect(env.DB.tables.sponsor_claims[0]).toMatchObject({
      email: 'reader@example.com',
      channel: 'wechat',
      status: 'pending',
    });
    expect(env.DB.tables.users[0]).toMatchObject({ email: 'reader@example.com' });
  });

  it('非管理员不能审核赞助记录', async () => {
    const env = createEnv();
    env.DB.tables.sponsor_claims.push(pendingClaim('claim_1', 'u_1', 'reader@example.com', 10));
    await seedSession(env, 'u_2', 'visitor@example.com', 'visitor-token');

    const response = await handleApproveSponsorClaim({
      request: jsonRequest('https://example.com/api/admin/sponsor-claims/claim_1/approve', {}, 'session=visitor-token'),
      env: { ...env, ADMIN_EMAILS: 'admin@example.com' },
      params: { id: 'claim_1' },
    });

    expect(response.status).toBe(403);
    expect(await hasLifetimeMembership(env.DB, 'u_1')).toBe(false);
  });

  it('管理员确认达标赞助后生成一次性兑换码且重复确认不重复生成', async () => {
    const env = createEnv();
    env.DB.tables.sponsor_claims.push(pendingClaim('claim_1', 'u_1', 'reader@example.com', 10));
    await seedSession(env, 'admin_1', 'admin@example.com', 'admin-token');

    const first = await handleApproveSponsorClaim({
      request: jsonRequest('https://example.com/api/admin/sponsor-claims/claim_1/approve', {}, 'session=admin-token'),
      env: { ...env, ADMIN_EMAILS: 'admin@example.com' },
      params: { id: 'claim_1' },
    });
    const firstPayload = await first.json() as { redeemCode?: string };
    const second = await handleApproveSponsorClaim({
      request: jsonRequest('https://example.com/api/admin/sponsor-claims/claim_1/approve', {}, 'session=admin-token'),
      env: { ...env, ADMIN_EMAILS: 'admin@example.com' },
      params: { id: 'claim_1' },
    });
    const secondPayload = await second.json() as { redeemCode?: string };

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstPayload.redeemCode).toMatch(/^SP-/);
    expect(secondPayload.redeemCode).toBeUndefined();
    expect(env.DB.tables.redeem_codes).toHaveLength(1);
    expect(await hasLifetimeMembership(env.DB, 'u_1')).toBe(false);
    expect(env.DB.tables.sponsor_claims[0].status).toBe('approved');
  });

  it('管理员标记普通赞助不会赠送会员', async () => {
    const env = createEnv();
    env.DB.tables.sponsor_claims.push(pendingClaim('claim_1', 'u_1', 'reader@example.com', 5));
    await seedSession(env, 'admin_1', 'admin@example.com', 'admin-token');

    const response = await handleThanksOnlySponsorClaim({
      request: jsonRequest('https://example.com/api/admin/sponsor-claims/claim_1/thanks-only', {}, 'session=admin-token'),
      env: { ...env, ADMIN_EMAILS: 'admin@example.com' },
      params: { id: 'claim_1' },
    });

    expect(response.status).toBe(200);
    expect(await hasLifetimeMembership(env.DB, 'u_1')).toBe(false);
    expect(env.DB.tables.sponsor_claims[0].status).toBe('thanks_only');
  });
});

type Row = Record<string, unknown>;

function createEnv() {
  return {
    DB: new MemoryD1(),
    MEMBERSHIP_SPONSOR_THRESHOLD_CNY: '10',
    SESSION_SECRET: 'test-secret',
  };
}

async function seedSession(env: ReturnType<typeof createEnv>, userId: string, email: string, token: string) {
  env.DB.tables.users.push({ id: userId, email, created_at: now(), updated_at: now() });
  env.DB.tables.sessions.push({
    id: `session_${userId}`,
    user_id: userId,
    token_hash: await sha256Hex(token),
    expires_at: '2099-01-01T00:00:00.000Z',
    created_at: now(),
  });
}

function pendingClaim(id: string, userId: string, email: string, amountCny: number) {
  return {
    id,
    user_id: userId,
    email,
    channel: 'wechat',
    amount_cny: amountCny,
    sponsored_at: '2026-06-22T10:00:00.000Z',
    note: '',
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    created_at: now(),
    updated_at: now(),
  };
}

function jsonRequest(url: string, payload: unknown, cookie = '') {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(payload),
  });
}

function now() {
  return '2026-06-22T00:00:00.000Z';
}

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

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
    if (sql.includes('FROM sessions') && sql.includes('token_hash')) {
      const session = this.tables.sessions.find((row) => row.token_hash === values[0] && String(row.expires_at) > now());
      if (!session) return null;
      const user = this.tables.users.find((row) => row.id === session.user_id);
      return user ? { id: user.id, email: user.email } : null;
    }
    if (sql.includes('FROM entitlements')) {
      return this.tables.entitlements.find((row) => row.user_id === values[0] && row.feature === values[1] && row.active === 1) ?? null;
    }
    if (sql.includes('FROM users') && sql.includes('WHERE email = ?')) {
      return this.tables.users.find((row) => row.email === values[0]) ?? null;
    }
    if (sql.includes('FROM sponsor_claims') && sql.includes('WHERE id = ?')) {
      return this.tables.sponsor_claims.find((row) => row.id === values[0]) ?? null;
    }
    return null;
  }

  all(sql: string, values: unknown[]) {
    if (sql.includes('FROM sponsor_claims')) {
      const status = values[0];
      return this.tables.sponsor_claims.filter((row) => !status || row.status === status);
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
    if (sql.startsWith('INSERT INTO sponsor_claims')) {
      this.tables.sponsor_claims.push({
        id: values[0],
        user_id: values[1],
        email: values[2],
        channel: values[3],
        amount_cny: values[4],
        sponsored_at: values[5],
        note: values[6],
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        created_at: values[7],
        updated_at: values[7],
      });
      return;
    }
    if (sql.startsWith('INSERT INTO redeem_codes')) {
      this.tables.redeem_codes.push({
        id: values[0],
        code_hash: values[1],
        token_hash: null,
        email_note: values[2],
        status: 'active',
        created_at: values[3],
        redeemed_at: null,
        revoked_at: null,
      });
      return;
    }
    if (sql.startsWith('UPDATE sponsor_claims SET status')) {
      const row = this.tables.sponsor_claims.find((claim) => claim.id === values[4]);
      if (row) {
        row.status = values[0];
        row.reviewed_by = values[1];
        row.reviewed_at = values[2];
        row.updated_at = values[3];
      }
      return;
    }
    if (sql.startsWith('INSERT INTO entitlements')) {
      const existing = this.tables.entitlements.find((row) => row.user_id === values[1] && row.feature === values[2] && row.active === 1);
      if (!existing) {
        this.tables.entitlements.push({
          id: values[0],
          user_id: values[1],
          feature: values[2],
          source: values[3],
          active: 1,
          granted_at: values[4],
          revoked_at: null,
        });
      }
      return;
    }
    if (sql.startsWith('INSERT INTO admin_audit_logs')) {
      this.tables.admin_audit_logs.push({
        id: values[0],
        admin_id: values[1],
        action: values[2],
        target_user_id: values[3],
        detail_json: values[4],
        created_at: values[5],
      });
    }
  }
}
