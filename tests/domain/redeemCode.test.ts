import { describe, expect, it, vi } from 'vitest';
import { handleRedeemCode } from '../../functions/api/redeem';
import { hasRedeemMembershipToken } from '../../functions/_shared/redeem';

describe('兑换码会员', () => {
  it('一次性兑换码兑换后返回当前浏览器使用的会员 token', async () => {
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
    expect(db.tables.redeem_codes[0].status).toBe('redeemed');
  });

  it('兑换码只能兑换一次', async () => {
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

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
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
  };

  async seedRedeemCode(code: string) {
    this.tables.redeem_codes.push({
      id: 'redeem_1',
      code_hash: await sha256Hex(normalizeRedeemCode(code)),
      token_hash: null,
      email_note: '',
      status: 'active',
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
    return null;
  }

  run(sql: string, values: unknown[]) {
    if (sql.startsWith('UPDATE redeem_codes')) {
      const row = this.tables.redeem_codes.find((item) => item.id === values[2]);
      if (row) {
        row.token_hash = values[0];
        row.redeemed_at = values[1];
        row.status = 'redeemed';
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
