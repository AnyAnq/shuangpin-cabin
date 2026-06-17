import 'fake-indexeddb/auto';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VocabulariesView from '../../src/views/VocabulariesView.vue';
import { db } from '../../src/storage/db';

describe('VocabulariesView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.vocabularyPackages.clear();
    await db.vocabularyEntries.clear();
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
      return Promise.reject(new Error('未模拟请求'));
    }));
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'practice', component: { template: '<div />' } },
        { path: '/records', name: 'records', component: { template: '<div />' } },
        { path: '/vocabularies', name: 'vocabularies', component: VocabulariesView },
      ],
    });
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
