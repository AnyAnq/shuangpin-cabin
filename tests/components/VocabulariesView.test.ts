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
      return Promise.resolve(notFoundResponse());
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
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          updatedAt: '2026-06-17T00:00:00.000Z',
          packages: [],
        }));
      }
      return Promise.resolve(notFoundResponse());
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
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          updatedAt: '2026-06-17T00:00:00.000Z',
          packages: [],
        }));
      }
      return Promise.resolve(notFoundResponse());
    }));
    const wrapper = mount(VocabulariesView, {
      global: { plugins: [routerForVocabulary()] },
    });
    await flush();

    expect(wrapper.find('[data-testid="import-vocabulary-input"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('导入词库');
  });

  it('付费标记的词库也直接提供安装按钮并可安装', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
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
      if (url.endsWith('/api/vocabularies/packages/it-tech@1.0.0.json')) {
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
      return Promise.resolve(notFoundResponse());
    }));

    const wrapper = mount(VocabulariesView, {
      global: { plugins: [routerForVocabulary()] },
    });

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="install-vocabulary-it-tech"]').exists()).toBe(true);
    });
    expect(wrapper.find('[data-testid="sponsor-vocabulary-it-tech"]').exists()).toBe(false);
    await wrapper.get('[data-testid="install-vocabulary-it-tech"]').trigger('click');
    await flush();

    expect(await db.vocabularyEntries.where('packageId').equals('it-tech').count()).toBe(1);
  });

  it('赞助弹窗只展示自愿赞助说明和二维码', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(jsonResponse({
          schemaVersion: 1,
          updatedAt: '2026-06-22T00:00:00.000Z',
          packages: [],
        }));
      }
      return Promise.resolve(notFoundResponse());
    }));

    const wrapper = mount(VocabulariesView, {
      global: { plugins: [routerForVocabulary()] },
    });
    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="open-sponsor-dialog"]').exists()).toBe(true);
    });

    await wrapper.get('[data-testid="open-sponsor-dialog"]').trigger('click');
    const dialog = wrapper.get('[data-testid="sponsor-dialog"]');

    expect(dialog.text()).toContain('微信赞助');
    expect(dialog.text()).toContain('支付宝赞助');
    expect(dialog.find('form').exists()).toBe(false);
    expect(dialog.find('input').exists()).toBe(false);
    expect(dialog.text()).not.toContain('兑换码');
    expect(dialog.text()).not.toContain('邮箱');
  });
});

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(payload),
  } as Response;
}

function notFoundResponse(): Response {
  return {
    ok: false,
    json: () => Promise.resolve({}),
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
