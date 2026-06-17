import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CodeHint from '../../src/components/practice/CodeHint.vue';

describe('CodeHint', () => {
  it('为小写 l 添加带勾字形类，降低和 i 的混淆', () => {
    const wrapper = mount(CodeHint, {
      props: {
        code: 'lj',
        completedCount: 0,
      },
    });

    const keys = wrapper.findAll('[data-code-key]');
    expect(keys[0].text()).toBe('l');
    expect(keys[0].classes()).toContain('is-hooked-l');
    expect(keys[1].classes()).not.toContain('is-hooked-l');
  });
});
