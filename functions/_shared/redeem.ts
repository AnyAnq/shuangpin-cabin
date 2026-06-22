import { createId, ensureMembershipSchema, json, sha256Hex, type AuthContext, type D1DatabaseLike } from './auth';

interface RedeemCodeRow {
  id: string;
  status: 'active' | 'redeemed' | 'revoked';
}

export async function handleRedeemMembershipCode(context: AuthContext): Promise<Response> {
  if (!context.env.DB) return json({ error: 'DB_UNAVAILABLE' }, 500);
  await ensureMembershipSchema(context.env.DB);

  const input = await readJson<{ code?: string }>(context.request);
  const code = normalizeRedeemCode(input.code);
  if (!code) return json({ error: 'INVALID_CODE', message: '请填写兑换码' }, 400);

  const row = await context.env.DB.prepare(`
    SELECT id, status
    FROM redeem_codes
    WHERE code_hash = ?
    LIMIT 1
  `).bind(await sha256Hex(code)).first<RedeemCodeRow>();
  if (!row) return json({ error: 'INVALID_CODE', message: '兑换码不存在' }, 404);
  if (row.status !== 'active') return json({ error: 'CODE_USED', message: '兑换码已使用或已失效' }, 409);

  const token = createId('member');
  const now = new Date().toISOString();
  await context.env.DB.prepare(`
    UPDATE redeem_codes
    SET token_hash = ?, redeemed_at = ?, status = 'redeemed'
    WHERE id = ?
  `).bind(await sha256Hex(token), now, row.id).run();

  return json({ token });
}

export async function createRedeemMembershipCode(db: D1DatabaseLike, emailNote: string, now = new Date().toISOString()): Promise<{ id: string; code: string }> {
  await ensureMembershipSchema(db);
  const code = generateRedeemCode();
  const id = createId('redeem');
  await db.prepare(`
    INSERT INTO redeem_codes (id, code_hash, token_hash, email_note, status, created_at, redeemed_at, revoked_at)
    VALUES (?, ?, NULL, ?, 'active', ?, NULL, NULL)
  `).bind(id, await sha256Hex(normalizeRedeemCode(code)), emailNote.slice(0, 180), now).run();
  return { id, code };
}

export async function hasRedeemMembershipToken(db: D1DatabaseLike | undefined, token: string | null): Promise<boolean> {
  if (!db || !token) return false;
  await ensureMembershipSchema(db);
  const row = await db.prepare(`
    SELECT id
    FROM redeem_codes
    WHERE token_hash = ? AND status = 'redeemed' AND revoked_at IS NULL
    LIMIT 1
  `).bind(await sha256Hex(token)).first();
  return Boolean(row);
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
