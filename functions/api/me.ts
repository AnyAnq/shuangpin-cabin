import { getCurrentUser, hasLifetimeMembership, isAdmin, json, type MembershipEnv } from '../_shared/auth';

interface MeContext {
  request: Request;
  env: MembershipEnv;
}

export async function onRequestGet(context: MeContext): Promise<Response> {
  return handleMe(context);
}

export async function handleMe(context: MeContext): Promise<Response> {
  const user = await getCurrentUser(context.request, context.env.DB);
  const lifetime = user ? await hasLifetimeMembership(context.env.DB, user.id) : false;
  return json({
    authenticated: Boolean(user),
    user: user ? { email: user.email } : null,
    membership: { lifetime },
    admin: isAdmin(user, context.env),
  });
}
