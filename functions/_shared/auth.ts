export const LIFETIME_FEATURE = 'online-vocabulary-lifetime';

export interface D1DatabaseLike {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
  };
}

export interface MembershipEnv {
  DB?: D1DatabaseLike;
  ADMIN_EMAILS?: string;
  MEMBERSHIP_SPONSOR_THRESHOLD_CNY?: string;
  SESSION_SECRET?: string;
  AUTH_DEV_MODE?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
}

export interface AuthContext {
  request: Request;
  env: MembershipEnv;
}

export interface AuthUser {
  id: string;
  email: string;
}

export async function getCurrentUser(request: Request, db?: D1DatabaseLike): Promise<AuthUser | null> {
  if (!db) return null;
  await ensureMembershipSchema(db);
  const token = readCookie(request, 'session');
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  return db.prepare(`
    SELECT users.id, users.email
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now')
    LIMIT 1
  `).bind(tokenHash).first<AuthUser>();
}

export async function hasLifetimeMembership(db: D1DatabaseLike | undefined, userId: string): Promise<boolean> {
  if (!db) return false;
  await ensureMembershipSchema(db);
  const row = await db.prepare(`
    SELECT id
    FROM entitlements
    WHERE user_id = ? AND feature = ? AND active = 1
    LIMIT 1
  `).bind(userId, LIFETIME_FEATURE).first();
  return Boolean(row);
}

export async function grantLifetimeMembership(db: D1DatabaseLike, userId: string, source: string, now = new Date().toISOString()) {
  await ensureMembershipSchema(db);
  if (await hasLifetimeMembership(db, userId)) return;
  await db.prepare(`
    INSERT INTO entitlements (id, user_id, feature, source, active, granted_at, revoked_at)
    VALUES (?, ?, ?, ?, 1, ?, NULL)
  `).bind(createId('entitlement'), userId, LIFETIME_FEATURE, source, now).run();
}

export async function ensureMembershipSchema(db: D1DatabaseLike): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).bind().run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS email_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    )
  `).bind().run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_email_codes_email_created ON email_codes (email, created_at)').bind().run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).bind().run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash)').bind().run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS entitlements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      feature TEXT NOT NULL,
      source TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      granted_at TEXT NOT NULL,
      revoked_at TEXT
    )
  `).bind().run();
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlements_active_feature ON entitlements (user_id, feature) WHERE active = 1').bind().run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS sponsor_claims (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      channel TEXT NOT NULL,
      amount_cny REAL NOT NULL,
      sponsored_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).bind().run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_sponsor_claims_status_created ON sponsor_claims (status, created_at)').bind().run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      detail_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).bind().run();
}

export function isAdmin(user: AuthUser | null, env: Pick<MembershipEnv, 'ADMIN_EMAILS'>): boolean {
  if (!user) return false;
  return (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
    .includes(user.email.toLowerCase());
}

export async function requireUser(context: AuthContext): Promise<AuthUser | Response> {
  const user = await getCurrentUser(context.request, context.env.DB);
  if (!user) {
    return json({ error: 'AUTH_REQUIRED', message: '请先登录' }, 401);
  }
  return user;
}

export async function requireAdmin(context: AuthContext): Promise<AuthUser | Response> {
  const user = await getCurrentUser(context.request, context.env.DB);
  if (!isAdmin(user, context.env)) {
    return json({ error: 'ADMIN_REQUIRED', message: '需要管理员权限' }, 403);
  }
  return user;
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createId(prefix: string) {
  const random = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}_${random.replace(/-/g, '')}`;
}

export function json(payload: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

export function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('Cookie') ?? '';
  const target = `${name}=`;
  const part = cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(target));
  return part ? decodeURIComponent(part.slice(target.length)) : null;
}
