import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import AppShell from '../../src/components/layout/AppShell.vue';

describe('AppShell', () => {
  it('渲染 V6 首页外壳的核心区域', () => {
    const wrapper = mount(AppShell, {
      global: {
        plugins: [createPinia()],
      },
    });

    expect(wrapper.text()).not.toContain('单字练习');
    expect(wrapper.text()).toContain('诗词句子');
    expect(wrapper.text()).toContain('绕口令');
    expect(wrapper.text()).not.toContain('文章打字');
    expect(wrapper.text()).toContain('小鹤双拼');
    expect(wrapper.text()).toContain('自然码');
    expect(wrapper.text()).toContain('易错练习');
    expect(wrapper.text()).toContain('实时统计');
    expect(wrapper.text()).toContain('某日一言');
    expect(wrapper.text()).not.toContain('每日一言');
    expect(wrapper.find('.quote-card em').exists()).toBe(false);
    expect(wrapper.find('[data-testid="floating-sidebar"]').exists()).toBe(true);
  });
});
