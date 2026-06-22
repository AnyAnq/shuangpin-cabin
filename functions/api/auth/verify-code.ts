import { createId, ensureMembershipSchema, json, sha256Hex, type MembershipEnv } from '../../_shared/auth';

interface AuthVerifyContext {
  request: Request;
  env: MembershipEnv;
}

interface CodeRow {
  id: string;
  email: string;
}

interface UserRow {
  id: string;
  email: string;
}

export async function onRequestPost(context: AuthVerifyContext): Promise<Response> {
  return handleVerifyCode(context);
}

export async function handleVerifyCode(context: AuthVerifyContext): Promise<Response> {
  if (!context.env.DB) return json({ error: 'DB_UNAVAILABLE' }, 500);
  await ensureMembershipSchema(context.env.DB);
  const input = await readJson<{ email?: string; code?: string }>(context.request);
  const email = normalizeEmail(input.email);
  const code = typeof input.code === 'string' ? input.code.trim() : '';
  if (!email || !/^\d{6}$/.test(code)) return json({ error: 'INVALID_CODE', message: '验证码不正确' }, 400);

  const codeHash = await sha256Hex(code);
  const codeRow = await context.env.DB.prepare(`
    SELECT id, email
    FROM email_codes
    WHERE email = ? AND code_hash = ? AND consumed_at IS NULL AND expires_at > datetime('now')
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(email, codeHash).first<CodeRow>();
  if (!codeRow) return json({ error: 'INVALID_CODE', message: '验证码不正确或已过期' }, 400);

  const now = new Date().toISOString();
  let user = await context.env.DB.prepare('SELECT id, email FROM users WHERE email = ? LIMIT 1').bind(email).first<UserRow>();
  if (!user) {
    user = { id: createId('user'), email };
    await context.env.DB.prepare(`
      INSERT INTO users (id, email, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).bind(user.id, email, now, now).run();
  }
  await context.env.DB.prepare('UPDATE email_codes SET consumed_at = ? WHERE id = ?').bind(now, codeRow.id).run();

  const token = createId('sessiontoken');
  await context.env.DB.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(createId('session'), user.id, await sha256Hex(token), oneYearFromNow(), now).run();

  return json({ ok: true, user: { email: user.email } }, 200, {
    'Set-Cookie': `session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
  });
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    return {} as T;
  }
}

function normalizeEmail(email: unknown) {
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : '';
}

function oneYearFromNow() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}
