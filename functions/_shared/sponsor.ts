import { ensureMembershipSchema, grantLifetimeMembership, json, requireAdmin, type AuthContext, type MembershipEnv } from './auth';
import { createRedeemMembershipCode } from './redeem';

type SponsorChannel = 'wechat' | 'alipay';
type SponsorStatus = 'pending' | 'approved' | 'rejected' | 'thanks_only';

interface SponsorClaimInput {
  channel?: SponsorChannel;
  amountCny?: number;
  sponsoredAt?: string;
  note?: string;
  email?: string;
}

interface SponsorRouteContext extends AuthContext {
  params?: {
    id?: string;
  };
}

interface SponsorClaimRow {
  id: string;
  user_id: string;
  email: string;
  amount_cny: number;
  status: SponsorStatus;
}

interface SponsorRedeemCodeRow {
  plain_code?: string | null;
  status?: string | null;
  redemption_count?: number | null;
  max_redemptions?: number | null;
}

export async function handleCreateSponsorClaim(context: AuthContext): Promise<Response> {
  const input = await readJson<SponsorClaimInput>(context.request);
  const email = normalizeEmail(input.email);
  const channel = input.channel;
  const amountCny = Number(input.amountCny);
  const sponsoredAt = typeof input.sponsoredAt === 'string' && input.sponsoredAt ? input.sponsoredAt : new Date().toISOString();
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) : '';

  if (!email) {
    return json({ error: 'INVALID_EMAIL', message: '请填写付款备注邮箱' }, 400);
  }
  if (channel !== 'wechat' && channel !== 'alipay') {
    return json({ error: 'INVALID_CHANNEL', message: '请选择微信或支付宝' }, 400);
  }
  if (!Number.isFinite(amountCny) || amountCny <= 0) {
    return json({ error: 'INVALID_AMOUNT', message: '请填写有效赞助金额' }, 400);
  }
  if (!context.env.DB) {
    return json({ error: 'DB_UNAVAILABLE', message: '数据库未配置' }, 500);
  }
  await ensureMembershipSchema(context.env.DB);

  const now = new Date().toISOString();
  const userId = await ensureSponsorUser(context.env.DB, email, now);
  const id = createSponsorClaimId();
  await context.env.DB.prepare(`
    INSERT INTO sponsor_claims (
      id, user_id, email, channel, amount_cny, sponsored_at, note, status,
      reviewed_by, reviewed_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)
  `).bind(id, userId, email, channel, amountCny, sponsoredAt, note, now, now).run();

  return json({ id, status: 'pending' }, 201);
}

async function ensureSponsorUser(db: NonNullable<MembershipEnv['DB']>, email: string, now: string): Promise<string> {
  const existing = await db.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first<{ id: string }>();
  if (existing) return existing.id;
  const id = createSponsorClaimId();
  await db.prepare(`
    INSERT INTO users (id, email, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).bind(id, email, now, now).run();
  return id;
}

export async function handleListSponsorClaims(context: AuthContext): Promise<Response> {
  const admin = await requireAdmin(context);
  if (admin instanceof Response) return admin;
  if (!context.env.DB) return json({ error: 'DB_UNAVAILABLE' }, 500);
  await ensureMembershipSchema(context.env.DB);
  const url = new URL(context.request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const result = await context.env.DB.prepare(`
    SELECT
      sponsor_claims.id,
      sponsor_claims.user_id,
      sponsor_claims.email,
      sponsor_claims.channel,
      sponsor_claims.amount_cny,
      sponsor_claims.sponsored_at,
      sponsor_claims.note,
      sponsor_claims.status,
      sponsor_claims.reviewed_by,
      sponsor_claims.reviewed_at,
      sponsor_claims.created_at,
      sponsor_claims.updated_at,
      redeem_codes.plain_code AS redeem_code,
      redeem_codes.status AS redeem_status,
      redeem_codes.redemption_count,
      redeem_codes.max_redemptions
    FROM sponsor_claims
    LEFT JOIN redeem_codes
      ON redeem_codes.email_note LIKE ('claim:' || sponsor_claims.id || ';%')
    WHERE (? = '' OR sponsor_claims.status = ?)
    ORDER BY sponsor_claims.created_at DESC
  `).bind(status, status).all();
  return json({ claims: result.results });
}

export async function handleApproveSponsorClaim(context: SponsorRouteContext): Promise<Response> {
  return reviewSponsorClaim(context, 'approved');
}

export async function handleThanksOnlySponsorClaim(context: SponsorRouteContext): Promise<Response> {
  return reviewSponsorClaim(context, 'thanks_only');
}

export async function handleRejectSponsorClaim(context: SponsorRouteContext): Promise<Response> {
  return reviewSponsorClaim(context, 'rejected');
}

export async function handleGrantMemberByEmail(context: AuthContext): Promise<Response> {
  const admin = await requireAdmin(context);
  if (admin instanceof Response) return admin;
  if (!context.env.DB) return json({ error: 'DB_UNAVAILABLE' }, 500);

  const input = await readJson<{ email?: string }>(context.request);
  const email = normalizeEmail(input.email);
  if (!email) return json({ error: 'INVALID_EMAIL', message: '请填写邮箱' }, 400);

  const user = await context.env.DB.prepare('SELECT id, email FROM users WHERE email = ? LIMIT 1').bind(email).first<{ id: string; email: string }>();
  if (!user) return json({ error: 'USER_NOT_FOUND', message: '用户不存在，请先登录一次' }, 404);

  const now = new Date().toISOString();
  await grantLifetimeMembership(context.env.DB, user.id, 'admin-grant', now);
  await writeAdminLog(context.env, admin.id, 'grant_lifetime_membership', user.id, { email }, now);
  return json({ ok: true });
}

async function reviewSponsorClaim(context: SponsorRouteContext, status: SponsorStatus): Promise<Response> {
  const admin = await requireAdmin(context);
  if (admin instanceof Response) return admin;
  if (!context.env.DB) return json({ error: 'DB_UNAVAILABLE' }, 500);

  const id = context.params?.id;
  if (!id) return json({ error: 'NOT_FOUND' }, 404);

  const claim = await context.env.DB.prepare(`
    SELECT id, user_id, email, amount_cny, status
    FROM sponsor_claims
    WHERE id = ?
    LIMIT 1
  `).bind(id).first<SponsorClaimRow>();
  if (!claim) return json({ error: 'NOT_FOUND' }, 404);
  if (claim.status !== 'pending') {
    const existingRedeem = await findRedeemCodeForClaim(context.env.DB, claim.id);
    return json({
      id,
      status: claim.status,
      redeemCode: existingRedeem?.plain_code ?? undefined,
      redemptionCount: existingRedeem?.redemption_count ?? undefined,
      maxRedemptions: existingRedeem?.max_redemptions ?? undefined,
    });
  }

  const now = new Date().toISOString();
  let redeemCode: string | undefined;
  if (status === 'approved') {
    const redeem = await createRedeemMembershipCode(context.env.DB, `claim:${claim.id};email:${claim.email}`, now);
    redeemCode = redeem.code;
  }

  await context.env.DB.prepare(`
    UPDATE sponsor_claims
    SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(status, admin.id, now, now, id).run();

  await writeAdminLog(context.env, admin.id, `sponsor_claim_${status}`, claim.user_id, { claimId: claim.id, email: claim.email }, now);
  return json({ id, status, redeemCode });
}

async function findRedeemCodeForClaim(db: NonNullable<MembershipEnv['DB']>, claimId: string): Promise<SponsorRedeemCodeRow | null> {
  return db.prepare(`
    SELECT plain_code, status, redemption_count, max_redemptions
    FROM redeem_codes
    WHERE email_note LIKE ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(`claim:${claimId};%`).first<SponsorRedeemCodeRow>();
}

async function writeAdminLog(env: MembershipEnv, adminId: string, action: string, targetUserId: string, detail: unknown, now: string) {
  if (!env.DB) return;
  await env.DB.prepare(`
    INSERT INTO admin_audit_logs (id, admin_id, action, target_user_id, detail_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(createSponsorClaimId(), adminId, action, targetUserId, JSON.stringify(detail), now).run();
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

function createSponsorClaimId() {
  const random = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `claim_${random.replace(/-/g, '')}`;
}
