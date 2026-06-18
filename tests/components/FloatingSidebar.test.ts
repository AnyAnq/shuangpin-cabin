import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { describe, expect, it } from 'vitest';
import FloatingSidebar from '../../src/components/layout/FloatingSidebar.vue';

function createTestRouter(initialPath = '/') {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'practice', component: { template: '<div />' } },
      { path: '/records', name: 'records', component: { template: '<div />' } },
      { path: '/vocabularies', name: 'vocabularies', component: { template: '<div />' } },
    ],
  });
}

describe('FloatingSidebar', () => {
  it('渲染保留入口并根据当前路由高亮', async () => {
    const router = createTestRouter('/records');
    router.push('/records');
    await router.isReady();

    const wrapper = mount(FloatingSidebar, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.get('[aria-label="练习"]').attributes('href')).toBe('/');
    expect(wrapper.find('[aria-label="键位对照"]').exists()).toBe(false);
    expect(wrapper.get('[aria-label="记录"]').attributes('href')).toBe('/records');
    expect(wrapper.get('[aria-label="词库"]').attributes('href')).toBe('/vocabularies');
    expect(wrapper.get('[aria-label="设置"]').attributes('type')).toBe('button');
    expect(wrapper.get('[aria-label="记录"]').classes()).toContain('is-active');
  });
});
