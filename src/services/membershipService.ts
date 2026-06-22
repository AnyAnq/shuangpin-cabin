export interface MembershipState {
  authenticated: boolean;
  user: {
    email: string;
  } | null;
  membership: {
    lifetime: boolean;
  };
  admin: boolean;
}

export interface SponsorClaimInput {
  channel: 'wechat' | 'alipay';
  amountCny: number;
  sponsoredAt: string;
  note: string;
}

export const defaultMembershipState: MembershipState = {
  authenticated: false,
  user: null,
  membership: { lifetime: false },
  admin: false,
};

export async function fetchMembershipState(): Promise<MembershipState> {
  const response = await fetch('/api/me', { credentials: 'include' });
  if (!response.ok) return defaultMembershipState;
  const payload = await response.json() as Partial<MembershipState>;
  return {
    authenticated: payload.authenticated === true,
    user: payload.user && typeof payload.user.email === 'string' ? { email: payload.user.email } : null,
    membership: { lifetime: payload.membership?.lifetime === true },
    admin: payload.admin === true,
  };
}

export async function submitSponsorClaim(input: SponsorClaimInput): Promise<void> {
  const response = await fetch('/api/sponsor-claims', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error('赞助记录提交失败');
  }
}

export async function requestLoginCode(email: string): Promise<{ devCode?: string }> {
  const response = await fetch('/api/auth/request-code', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error('验证码发送失败');
  return await response.json() as { devCode?: string };
}

export async function verifyLoginCode(email: string, code: string): Promise<void> {
  const response = await fetch('/api/auth/verify-code', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  if (!response.ok) throw new Error('登录失败');
}
