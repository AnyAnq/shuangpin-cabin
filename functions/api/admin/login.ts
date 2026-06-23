import { createId, ensureMembershipSchema, json, sha256Hex, type MembershipEnv } from '../../_shared/auth';

interface AdminLoginContext {
  request: Request;
  env: MembershipEnv;
}

interface UserRow {
  id: string;
  email: string;
}

export async function onRequestPost(context: AdminLoginContext): Promise<Response> {
  return handleAdminLogin(context);
}

export async function handleAdminLogin(context: AdminLoginContext): Promise<Response> {
  if (!context.env.DB) return json({ error: 'DB_UNAVAILABLE' }, 500);
  const adminEmail = firstAdminEmail(context.env.ADMIN_EMAILS);
  if (!adminEmail || !context.env.ADMIN_PASSWORD) {
    return json({ error: 'ADMIN_AUTH_UNCONFIGURED', message: '管理员密码未配置' }, 500);
  }

  const input = await readJson<{ password?: string }>(context.request);
  if (input.password !== context.env.ADMIN_PASSWORD) {
    return json({ error: 'INVALID_ADMIN_PASSWORD', message: '管理员密码不正确' }, 401);
  }

  await ensureMembershipSchema(context.env.DB);
  const now = new Date().toISOString();
  let user = await context.env.DB.prepare('SELECT id, email FROM users WHERE email = ? LIMIT 1').bind(adminEmail).first<UserRow>();
  if (!user) {
    user = { id: createId('user'), email: adminEmail };
    await context.env.DB.prepare(`
      INSERT INTO users (id, email, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).bind(user.id, user.email, now, now).run();
  }

  const token = createId('sessiontoken');
  await context.env.DB.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(createId('session'), user.id, await sha256Hex(token), oneYearFromNow(), now).run();

  return json({ ok: true, user: { email: user.email } }, 200, {
    'Set-Cookie': sessionCookie(context.request, token),
  });
}

function firstAdminEmail(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .find(Boolean) ?? '';
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    return {} as T;
  }
}

function oneYearFromNow() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}

function sessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `session=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=31536000`;
}
