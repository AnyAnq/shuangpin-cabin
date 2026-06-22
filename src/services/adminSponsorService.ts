export interface SponsorClaimRecord {
  id: string;
  email: string;
  channel: 'wechat' | 'alipay';
  amount_cny: number;
  sponsored_at: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected' | 'thanks_only';
  created_at: string;
}

export async function fetchSponsorClaims(status = 'pending'): Promise<SponsorClaimRecord[]> {
  const response = await fetch(`/api/admin/sponsor-claims?status=${encodeURIComponent(status)}`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('赞助记录加载失败');
  const payload = await response.json() as { claims?: SponsorClaimRecord[] };
  return payload.claims ?? [];
}

export interface SponsorReviewResult {
  id: string;
  status: SponsorClaimRecord['status'];
  redeemCode?: string;
}

export async function reviewSponsorClaim(id: string, action: 'approve' | 'thanks-only' | 'reject'): Promise<SponsorReviewResult> {
  const response = await fetch(`/api/admin/sponsor-claims/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('审核失败');
  return response.json() as Promise<SponsorReviewResult>;
}
