import 'fake-indexeddb/auto';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VocabulariesView from '../../src/views/VocabulariesView.vue';
import { db, type VocabularyPackageRecord } from '../../src/storage/db';

describe('VocabulariesView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.vocabularyPackages.clear();
    await db.vocabularyEntries.clear();
    localStorage.clear();
  });

  it('展示远程可安装词库并支持安装', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.endsWith('/api/me')) {
        return Promise.resolve(jsonResponse({
          authenticated: false,
          user: null,
          membership: { lifetime: false },
          admin: false,
        }));
      }
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          updatedAt: '2026-06-17T00:00:00.000Z',
          packages: [{
            id: 'daily-common',
            name: '日常常用词',
            version: '1.0.0',
            description: '适合日常输入热身。',
            author: 'Shuangpin Cabin',
            pricingType: 'free',
            tags: ['daily'],
            entryCount: 2,
            downloadUrl: 'https://example.com/daily-common.json',
          }],
        }));
      }
      if (url.endsWith('/daily-common.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          id: 'daily-common',
          name: '日常常用词',
          version: '1.0.0',
          author: 'Shuangpin Cabin',
          license: 'MIT',
          pricingType: 'free',
          description: '适合日常输入热身。',
          tags: ['daily'],
          entries: [{ text: '今天', weight: 99 }, { text: '事情', weight: 98 }],
        }));
      }
      return Promise.reject(new Error('未模拟请求'));
    }));
    const router = routerForVocabulary();
    router.push('/vocabularies');
    await router.isReady();

    const wrapper = mount(VocabulariesView, {
      global: { plugins: [router] },
    });
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="install-vocabulary-daily-common"]').exists()).toBe(true);
    });
    await wrapper.get('[data-testid="install-vocabulary-daily-common"]').trigger('click');
    await flush();

    expect(wrapper.text()).toContain('日常常用词');
    expect(wrapper.text()).toContain('已安装');
    expect(wrapper.get('.vocabulary-card').classes()).toContain('has-bottom-action');
    expect(await db.vocabularyEntries.where('packageId').equals('daily-common').count()).toBe(2);
  });

  it('分区展示本地词库、在线已安装词库和在线词库中心', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.endsWith('/api/me')) {
        return Promise.resolve(jsonResponse({
          authenticated: false,
          user: null,
          membership: { lifetime: false },
          admin: false,
        }));
      }
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          updatedAt: '2026-06-17T00:00:00.000Z',
          packages: [],
        }));
      }
      return Promise.reject(new Error('未模拟请求'));
    }));
    await installRecord({
      id: 'local-pack',
      name: '我的词库',
      version: '1.0.0',
      description: '本地导入',
      author: '本地导入',
      license: 'Personal',
      pricingType: 'owned',
      tags: ['custom', 'local'],
      entryCount: 2,
      installedAt: 1,
      updatedAt: 1,
      sourceUrl: 'local-file:mine.txt',
      sourceType: 'local',
      originalFileName: 'mine.txt',
    });
    await installRecord({
      id: 'remote-pack',
      name: '在线词库',
      version: '1.0.0',
      description: '在线安装',
      author: 'Shuangpin Cabin',
      license: 'MIT',
      pricingType: 'free',
      tags: ['daily'],
      entryCount: 2,
      installedAt: 2,
      updatedAt: 2,
      sourceUrl: 'https://example.com/remote.json',
      sourceType: 'remote',
    });

    const wrapper = mount(VocabulariesView, {
      global: { plugins: [routerForVocabulary()] },
    });

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="local-vocabulary-section"]').text()).toContain('我的词库');
    });
    expect(wrapper.get('[data-testid="online-installed-vocabulary-section"]').text()).toContain('在线词库');
    expect(wrapper.get('[data-testid="online-vocabulary-center-section"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="export-vocabulary-local-pack"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="export-vocabulary-remote-pack"]').exists()).toBe(false);
  });

  it('词库页不再展示本地导入入口', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.endsWith('/api/me')) {
        return Promise.resolve(jsonResponse({
          authenticated: false,
          user: null,
          membership: { lifetime: false },
          admin: false,
        }));
      }
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          updatedAt: '2026-06-17T00:00:00.000Z',
          packages: [],
        }));
      }
      return Promise.reject(new Error('未模拟请求'));
    }));
    const wrapper = mount(VocabulariesView, {
      global: { plugins: [routerForVocabulary()] },
    });
    await flush();

    expect(wrapper.find('[data-testid="import-vocabulary-input"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('导入词库');
  });

  it('付费词库对未兑换浏览器展示赞助入口', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.endsWith('/api/me')) {
        return Promise.resolve(jsonResponse({
          authenticated: false,
          user: null,
          membership: { lifetime: false },
          admin: false,
        }));
      }
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          updatedAt: '2026-06-22T00:00:00.000Z',
          packages: [{
            id: 'it-tech',
            name: '技术术语词库',
            version: '1.0.0',
            description: '适合技术场景输入。',
            author: 'Shuangpin Cabin',
            pricingType: 'paid',
            tags: ['it'],
            entryCount: 80,
            downloadUrl: '/api/vocabularies/packages/it-tech@1.0.0.json',
          }],
        }));
      }
      return Promise.reject(new Error(`未模拟请求：${url}`));
    }));

    const wrapper = mount(VocabulariesView, {
      global: { plugins: [routerForVocabulary()] },
    });

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('技术术语词库');
    });

    expect(wrapper.text()).toContain('赞助满 10 元');
    expect(wrapper.text()).toContain('可用兑换码解锁词库服务');
    expect(wrapper.get('[data-testid="sponsor-vocabulary-it-tech"]').text()).toContain('赞助支持');
  });

  it('赞助弹窗只收集邮箱和付款时间，不再收集渠道金额备注', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/me')) {
        return Promise.resolve(jsonResponse({
          authenticated: false,
          user: null,
          membership: { lifetime: false },
          admin: false,
        }));
      }
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          updatedAt: '2026-06-22T00:00:00.000Z',
          packages: [{
            id: 'it-tech',
            name: '技术术语词库',
            version: '1.0.0',
            description: '适合技术场景输入。',
            author: 'Shuangpin Cabin',
            pricingType: 'paid',
            tags: ['it'],
            entryCount: 80,
            downloadUrl: '/api/vocabularies/packages/it-tech@1.0.0.json',
          }],
        }));
      }
      if (url.endsWith('/api/sponsor-claims')) {
        return Promise.resolve(jsonResponse({ id: 'claim_1', status: 'pending' }));
      }
      return Promise.reject(new Error(`未模拟请求：${url} ${init?.method ?? 'GET'}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(VocabulariesView, {
      global: { plugins: [routerForVocabulary()] },
    });
    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="sponsor-vocabulary-it-tech"]').text()).toContain('赞助支持');
    });

    await wrapper.get('[data-testid="sponsor-vocabulary-it-tech"]').trigger('click');
    const dialog = wrapper.get('[data-testid="sponsor-dialog"]');

    expect(dialog.text()).toContain('备注邮箱');
    expect(dialog.find('form.sponsor-form').exists()).toBe(true);
    expect(dialog.find('input[type="email"]').exists()).toBe(true);
    expect(dialog.find('input[type="datetime-local"]').exists()).toBe(true);
    expect(dialog.find('select').exists()).toBe(false);
    expect(dialog.find('input[type="number"]').exists()).toBe(false);
    expect(dialog.find('textarea').exists()).toBe(false);
    expect(dialog.text()).not.toContain('付款备注邮箱');
    expect(dialog.text()).not.toContain('赞助渠道');
    expect(dialog.text()).not.toContain('赞助金额');
    expect(dialog.text()).not.toContain('赞助时间');
    expect(dialog.find('[data-testid="submit-sponsor-claim"]').exists()).toBe(true);
    expect(dialog.find('[data-testid="redeem-membership-code"]').exists()).toBe(true);

    await wrapper.get('input[type="email"]').setValue('reader@example.com');
    await wrapper.get('form.sponsor-form').trigger('submit');
    await flush();

    expect(fetchMock).toHaveBeenCalledWith('/api/sponsor-claims', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: expect.stringContaining('reader@example.com'),
    }));
    expect(wrapper.text()).toContain('已提交信息');
  });

  it('兑换码成功后当前浏览器显示会员并允许安装付费词库', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/me')) {
        return Promise.resolve(jsonResponse({
          authenticated: false,
          user: null,
          membership: { lifetime: false },
          admin: false,
        }));
      }
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          updatedAt: '2026-06-22T00:00:00.000Z',
          packages: [{
            id: 'it-tech',
            name: '技术术语词库',
            version: '1.0.0',
            description: '适合技术场景输入。',
            author: 'Shuangpin Cabin',
            pricingType: 'paid',
            tags: ['it'],
            entryCount: 1,
            downloadUrl: '/api/vocabularies/packages/it-tech@1.0.0.json',
          }],
        }));
      }
      if (url.endsWith('/api/redeem')) {
        return Promise.resolve(jsonResponse({ token: 'member-token-1' }));
      }
      if (url.endsWith('/api/vocabularies/packages/it-tech@1.0.0.json')) {
        expect((init?.headers as Record<string, string>)['X-Membership-Token']).toBe('member-token-1');
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          id: 'it-tech',
          name: '技术术语词库',
          version: '1.0.0',
          author: 'Shuangpin Cabin',
          license: 'MIT',
          pricingType: 'paid',
          description: '适合技术场景输入。',
          tags: ['it'],
          entries: [{ text: '字符串', weight: 1 }],
        }));
      }
      return Promise.reject(new Error(`未模拟请求：${url} ${init?.method ?? 'GET'}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(VocabulariesView, {
      global: { plugins: [routerForVocabulary()] },
    });
    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="sponsor-vocabulary-it-tech"]').exists()).toBe(true);
    });

    await wrapper.get('[data-testid="sponsor-vocabulary-it-tech"]').trigger('click');
    await wrapper.get('input[placeholder="输入管理员发给你的兑换码"]').setValue('SP-TEST-001');
    await wrapper.get('form.redeem-form').trigger('submit');
    await flush();

    expect(wrapper.text()).toContain('永久会员已开通');
    await wrapper.get('[data-testid="install-vocabulary-it-tech"]').trigger('click');
    await flush();

    expect(await db.vocabularyEntries.where('packageId').equals('it-tech').count()).toBe(1);
  });
});

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(payload),
  } as Response;
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function routerForVocabulary() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'practice', component: { template: '<div />' } },
      { path: '/records', name: 'records', component: { template: '<div />' } },
      { path: '/vocabularies', name: 'vocabularies', component: VocabulariesView },
    ],
  });
}

async function installRecord(record: VocabularyPackageRecord) {
  await db.vocabularyPackages.put(record);
}
