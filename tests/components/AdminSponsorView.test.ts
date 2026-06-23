import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import AdminSponsorView from '../../src/views/AdminSponsorView.vue';

describe('AdminSponsorView', () => {
  it('未授权时显示密码登录，登录成功后加载赞助记录', async () => {
    let authenticated = false;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.toString().includes('/api/admin/sponsor-claims')) {
        if (!authenticated) {
          return Promise.resolve(jsonResponse({ error: 'ADMIN_REQUIRED' }, 403));
        }
        return Promise.resolve(jsonResponse({
          claims: [{
            id: 'claim_1',
            email: 'reader@example.com',
            channel: 'wechat',
            amount_cny: 10,
            sponsored_at: '2026-06-23T10:00:00.000Z',
            note: '用户仅提交邮箱和付款时间',
            status: 'pending',
            created_at: '2026-06-23T10:00:00.000Z',
          }, {
            id: 'claim_2',
            email: 'approved@example.com',
            channel: 'alipay',
            amount_cny: 10,
            sponsored_at: '2026-06-23T11:00:00.000Z',
            note: '',
            status: 'approved',
            created_at: '2026-06-23T11:00:00.000Z',
            redeem_code: 'SP-TEST-001',
            redeem_status: 'active',
            redemption_count: 2,
            max_redemptions: 3,
          }],
        }));
      }
      if (url === '/api/admin/login') {
        authenticated = true;
        return Promise.resolve(jsonResponse({ ok: true }));
      }
      return Promise.reject(new Error(`未模拟请求：${url} ${init?.method ?? 'GET'}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(AdminSponsorView, {
      global: {
        stubs: {
          FloatingSidebar: { template: '<aside />' },
        },
      },
    });
    await flush();

    expect(wrapper.text()).toContain('管理员密码');
    await wrapper.get('[data-testid="admin-password-input"]').setValue('secret-pass');
    await wrapper.get('form.admin-login-form').trigger('submit');
    await flush();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ password: 'secret-pass' }),
    }));
    expect(wrapper.text()).toContain('reader@example.com');
    expect(wrapper.text()).toContain('approved@example.com');
    expect(wrapper.text()).toContain('SP-TEST-001');
    expect(wrapper.text()).toContain('已使用 2 / 3 次');
    expect(wrapper.text()).not.toContain('无法加载赞助记录');
  });
});

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  } as Response;
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
