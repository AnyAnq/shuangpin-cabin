import { createId, ensureMembershipSchema, json, sha256Hex, type AuthContext, type D1DatabaseLike } from './auth';

interface RedeemCodeRow {
  id: string;
  status: 'active' | 'redeemed' | 'revoked';
  max_redemptions?: number | null;
  redemption_count?: number | null;
}

export async function handleRedeemMembershipCode(context: AuthContext): Promise<Response> {
  if (!context.env.DB) return json({ error: 'DB_UNAVAILABLE' }, 500);
  await ensureMembershipSchema(context.env.DB);

  const input = await readJson<{ code?: string }>(context.request);
  const code = normalizeRedeemCode(input.code);
  if (!code) return json({ error: 'INVALID_CODE', message: '请填写兑换码' }, 400);

  const row = await context.env.DB.prepare(`
    SELECT id, status, max_redemptions, redemption_count
    FROM redeem_codes
    WHERE code_hash = ?
    LIMIT 1
  `).bind(await sha256Hex(code)).first<RedeemCodeRow>();
  if (!row) return json({ error: 'INVALID_CODE', message: '兑换码不存在' }, 404);
  const maxRedemptions = Number(row.max_redemptions ?? 1);
  const redemptionCount = Number(row.redemption_count ?? (row.status === 'redeemed' ? 1 : 0));
  if (row.status === 'revoked') return json({ error: 'CODE_USED', message: '兑换码已失效' }, 409);
  if (row.status !== 'active' || redemptionCount >= maxRedemptions) {
    return json({ error: 'CODE_USED', message: '兑换码使用次数已满' }, 409);
  }

  const token = createId('member');
  const now = new Date().toISOString();
  const tokenHash = await sha256Hex(token);
  const nextCount = redemptionCount + 1;
  const nextStatus = nextCount >= maxRedemptions ? 'redeemed' : 'active';
  await context.env.DB.prepare(`
    INSERT INTO redeem_code_redemptions (id, redeem_code_id, token_hash, redeemed_at)
    VALUES (?, ?, ?, ?)
  `).bind(createId('redemption'), row.id, tokenHash, now).run();
  await context.env.DB.prepare(`
    UPDATE redeem_codes
    SET redemption_count = ?, status = ?, redeemed_at = ?
    WHERE id = ?
  `).bind(nextCount, nextStatus, now, row.id).run();

  return json({ token });
}

export async function createRedeemMembershipCode(db: D1DatabaseLike, emailNote: string, now = new Date().toISOString()): Promise<{ id: string; code: string }> {
  await ensureMembershipSchema(db);
  const code = generateRedeemCode();
  const normalizedCode = normalizeRedeemCode(code);
  const id = createId('redeem');
  await db.prepare(`
    INSERT INTO redeem_codes (
      id, code_hash, token_hash, email_note, status, created_at, redeemed_at, revoked_at,
      plain_code, max_redemptions, redemption_count
    )
    VALUES (?, ?, NULL, ?, 'active', ?, NULL, NULL, ?, 3, 0)
  `).bind(id, await sha256Hex(normalizedCode), emailNote.slice(0, 180), now, normalizedCode).run();
  return { id, code };
}

export async function hasRedeemMembershipToken(db: D1DatabaseLike | undefined, token: string | null): Promise<boolean> {
  if (!db || !token) return false;
  await ensureMembershipSchema(db);
  const row = await db.prepare(`
    SELECT redeem_code_redemptions.id
    FROM redeem_code_redemptions
    JOIN redeem_codes ON redeem_codes.id = redeem_code_redemptions.redeem_code_id
    WHERE redeem_code_redemptions.token_hash = ? AND redeem_codes.revoked_at IS NULL
    LIMIT 1
  `).bind(await sha256Hex(token)).first();
  if (row) return true;
  const legacyRow = await db.prepare(`
    SELECT id
    FROM redeem_codes
    WHERE token_hash = ? AND status = 'redeemed' AND revoked_at IS NULL
    LIMIT 1
  `).bind(await sha256Hex(token)).first();
  return Boolean(legacyRow);
}

export function readMembershipToken(request: Request): string | null {
  const header = request.headers.get('X-Membership-Token');
  return header && header.trim().length > 0 ? header.trim() : null;
}

export function normalizeRedeemCode(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toUpperCase().replace(/\s+/g, '')
    : '';
}

function generateRedeemCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `SP-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    return {} as T;
  }
}
