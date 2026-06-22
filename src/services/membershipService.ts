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

const MEMBERSHIP_TOKEN_KEY = 'shuangpin-cabin-membership-token';

export interface SponsorClaimInput {
  channel: 'wechat' | 'alipay';
  amountCny: number;
  sponsoredAt: string;
  note: string;
  email: string;
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

export function getStoredMembershipToken(): string {
  return localStorage.getItem(MEMBERSHIP_TOKEN_KEY) ?? '';
}

export function hasStoredMembershipToken(): boolean {
  return getStoredMembershipToken().length > 0;
}

export async function redeemMembershipCode(code: string): Promise<void> {
  const response = await fetch('/api/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error('兑换失败');
  const payload = await response.json() as { token?: string };
  if (!payload.token) throw new Error('兑换失败');
  localStorage.setItem(MEMBERSHIP_TOKEN_KEY, payload.token);
}

export function membershipHeaders(): HeadersInit {
  const token = getStoredMembershipToken();
  return token ? { 'X-Membership-Token': token } : {};
}
