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

    expect(wrapper.text()).toContain('Q');
    expect(wrapper.text()).toContain('iu');
    expect(wrapper.find('[data-key="d"]').classes()).toContain('is-hot');
    expect(wrapper.find('[data-key="s"]').classes()).toContain('is-wrong');
  });
});
