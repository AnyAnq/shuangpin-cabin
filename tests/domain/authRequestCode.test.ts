import { describe, expect, it, vi } from 'vitest';
import { handleRequestCode } from '../../functions/api/auth/request-code';

describe('邮箱验证码请求', () => {
  it('正式模式不会因为测试 SESSION_SECRET 泄露开发验证码', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))));

    const response = await handleRequestCode({
      request: jsonRequest({ email: 'reader@example.com' }),
      env: {
        DB: new MemoryD1(),
        AUTH_DEV_MODE: 'false',
        SESSION_SECRET: 'test-secret',
        RESEND_API_KEY: 'resend-key',
        AUTH_EMAIL_FROM: '双拼小筑 <login@example.com>',
      },
    });
    const payload = await response.json() as { devCode?: string };

    expect(response.status).toBe(200);
    expect(payload.devCode).toBeUndefined();
  });

  it('开发模式可以返回开发验证码用于本地测试', async () => {
    const response = await handleRequestCode({
      request: jsonRequest({ email: 'reader@example.com' }),
      env: {
        DB: new MemoryD1(),
        AUTH_DEV_MODE: 'true',
      },
    });
    const payload = await response.json() as { devCode?: string };

    expect(response.status).toBe(200);
    expect(payload.devCode).toMatch(/^\d{6}$/);
  });
});

function jsonRequest(payload: unknown) {
  return new Request('https://example.com/api/auth/request-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

class MemoryD1 {
  prepare(sql: string) {
    return {
      bind: vi.fn(() => ({
        run: vi.fn(async () => ({ success: true })),
        first: vi.fn(async () => null),
        all: vi.fn(async () => ({ results: [] })),
      })),
    };
  }
}
