import { createId, ensureMembershipSchema, json, sha256Hex, type MembershipEnv } from '../../_shared/auth';

interface AuthRequestContext {
  request: Request;
  env: MembershipEnv;
}

export async function onRequestPost(context: AuthRequestContext): Promise<Response> {
  return handleRequestCode(context);
}

export async function handleRequestCode(context: AuthRequestContext): Promise<Response> {
  if (!context.env.DB) return json({ error: 'DB_UNAVAILABLE' }, 500);
  await ensureMembershipSchema(context.env.DB);
  const input = await readJson<{ email?: string }>(context.request);
  const email = normalizeEmail(input.email);
  if (!email) return json({ error: 'INVALID_EMAIL', message: '请填写有效邮箱' }, 400);

  const code = createCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  await context.env.DB.prepare(`
    INSERT INTO email_codes (id, email, code_hash, expires_at, consumed_at, created_at)
    VALUES (?, ?, ?, ?, NULL, ?)
  `).bind(createId('code'), email, await sha256Hex(code), expiresAt, now.toISOString()).run();

  const payload: Record<string, unknown> = { ok: true };
  if (context.env.RESEND_API_KEY && context.env.AUTH_EMAIL_FROM) {
    const sent = await sendCodeEmail(context.env.RESEND_API_KEY, context.env.AUTH_EMAIL_FROM, email, code);
    if (!sent) return json({ error: 'EMAIL_SEND_FAILED', message: '验证码发送失败' }, 502);
  } else if (context.env.AUTH_DEV_MODE !== 'true') {
    return json({ error: 'EMAIL_UNCONFIGURED', message: '邮件服务未配置' }, 500);
  }
  if (context.env.AUTH_DEV_MODE === 'true') {
    payload.devCode = code;
  }
  return json(payload);
}

async function sendCodeEmail(apiKey: string, from: string, to: string, code: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: '双拼小筑登录验证码',
      text: `你的双拼小筑登录验证码是：${code}。验证码 10 分钟内有效。`,
    }),
  });
  return response.ok;
}

function createCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
