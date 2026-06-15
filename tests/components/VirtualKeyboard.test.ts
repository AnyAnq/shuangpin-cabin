import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import VirtualKeyboard from '../../src/components/practice/VirtualKeyboard.vue';
import { xiaoheScheme } from '../../src/domain/schemes/xiaohe';

describe('VirtualKeyboard', () => {
  it('默认没有高亮按键', () => {
    const wrapper = mount(VirtualKeyboard, {
      props: {
        scheme: xiaoheScheme,
        activeKey: null,
        wrongKey: null,
      },
    });

    expect(wrapper.find('.is-hot').exists()).toBe(false);
  });

  it('展示方案键位并标记当前键和错误键', () => {
    const wrapper = mount(VirtualKeyboard, {
      props: {
        scheme: xiaoheScheme,
        activeKey: 'd',
        wrongKey: 's',
      },
    });

    expect(wrapper.find('[data-key="q"]').text()).toContain('iu');
    expect(wrapper.find('[data-key="q"]').text()).not.toContain('q/iu');
    expect(wrapper.find('[data-key="w"]').text()).toContain('ei');
    expect(wrapper.find('[data-key="u"]').text()).toContain('u');
    expect(wrapper.find('[data-key="u"]').text()).not.toContain('sh/u');
    expect(wrapper.find('[data-key="t"]').text()).toContain('ue/üe');
    expect(wrapper.find('[data-key="v"]').text()).toContain('zh/ui/ü');
    expect(wrapper.find('[data-key="d"]').classes()).toContain('is-hot');
    expect(wrapper.find('[data-key="s"]').classes()).toContain('is-wrong');
  });
});
