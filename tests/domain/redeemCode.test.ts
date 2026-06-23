import { describe, expect, it, vi } from 'vitest';
import { handleRedeemCode } from '../../functions/api/redeem';
import { hasRedeemMembershipToken } from '../../functions/_shared/redeem';

describe('兑换码会员', () => {
  it('兑换码兑换后返回当前浏览器使用的会员 token 并记录使用次数', async () => {
    const db = new MemoryD1();
    await db.seedRedeemCode('SP-TEST-001');

    const response = await handleRedeemCode({
      request: jsonRequest({ code: 'SP-TEST-001' }),
      env: { DB: db },
    });
    const payload = await response.json() as { token: string };

    expect(response.status).toBe(200);
    expect(payload.token).toMatch(/^member_/);
    expect(await hasRedeemMembershipToken(db, payload.token)).toBe(true);
    expect(db.tables.redeem_codes[0].status).toBe('active');
    expect(db.tables.redeem_codes[0].redemption_count).toBe(1);
    expect(db.tables.redeem_code_redemptions).toHaveLength(1);
  });

  it('兑换码最多可以兑换三次，第四次失效', async () => {
    const db = new MemoryD1();
    await db.seedRedeemCode('SP-TEST-001');

    const first = await handleRedeemCode({
      request: jsonRequest({ code: 'SP-TEST-001' }),
      env: { DB: db },
    });
    const second = await handleRedeemCode({
      request: jsonRequest({ code: 'SP-TEST-001' }),
      env: { DB: db },
    });
    const third = await handleRedeemCode({
      request: jsonRequest({ code: 'SP-TEST-001' }),
      env: { DB: db },
    });
    const fourth = await handleRedeemCode({
      request: jsonRequest({ code: 'SP-TEST-001' }),
      env: { DB: db },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    expect(fourth.status).toBe(409);
    expect(db.tables.redeem_codes[0].status).toBe('redeemed');
    expect(db.tables.redeem_codes[0].redemption_count).toBe(3);
    expect(db.tables.redeem_code_redemptions).toHaveLength(3);
  });
});

function jsonRequest(payload: unknown) {
  return new Request('https://example.com/api/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

type Row = Record<string, unknown>;

class MemoryD1 {
  tables: Record<string, Row[]> = {
    redeem_codes: [],
    redeem_code_redemptions: [],
  };

  async seedRedeemCode(code: string) {
    this.tables.redeem_codes.push({
      id: 'redeem_1',
      code_hash: await sha256Hex(normalizeRedeemCode(code)),
      token_hash: null,
      email_note: '',
      status: 'active',
      plain_code: normalizeRedeemCode(code),
      max_redemptions: 3,
      redemption_count: 0,
      created_at: now(),
      redeemed_at: null,
      revoked_at: null,
    });
  }

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const db = this;
    return {
      bind(...values: unknown[]) {
        return {
          first: vi.fn(async () => db.first(normalized, values)),
          all: vi.fn(async () => ({ results: [] })),
          run: vi.fn(async () => {
            db.run(normalized, values);
            return { success: true };
          }),
        };
      },
    };
  }

  first(sql: string, values: unknown[]) {
    if (sql.includes('FROM redeem_codes') && sql.includes('code_hash')) {
      return this.tables.redeem_codes.find((row) => row.code_hash === values[0]) ?? null;
    }
    if (sql.includes('FROM redeem_codes') && sql.includes('token_hash')) {
      return this.tables.redeem_codes.find((row) => row.token_hash === values[0] && row.status === 'redeemed') ?? null;
    }
    if (sql.includes('FROM redeem_code_redemptions')) {
      return this.tables.redeem_code_redemptions.find((row) => row.token_hash === values[0]) ?? null;
    }
    return null;
  }

  run(sql: string, values: unknown[]) {
    if (sql.startsWith('INSERT INTO redeem_code_redemptions')) {
      this.tables.redeem_code_redemptions.push({
        id: values[0],
        redeem_code_id: values[1],
        token_hash: values[2],
        redeemed_at: values[3],
      });
      return;
    }
    if (sql.startsWith('UPDATE redeem_codes')) {
      const row = this.tables.redeem_codes.find((item) => item.id === values[3]);
      if (row) {
        row.redemption_count = values[0];
        row.status = values[1];
        row.redeemed_at = values[2];
      }
    }
  }
}

function normalizeRedeemCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function now() {
  return '2026-06-22T00:00:00.000Z';
}
