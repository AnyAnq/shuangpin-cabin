import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PracticeStage from '../../src/components/practice/PracticeStage.vue';

describe('PracticeStage', () => {
  it('渲染当前字和编码键帽但不显示输入框', () => {
    const wrapper = mount(PracticeStage, {
      props: {
        text: '多情',
        activeIndex: 0,
        code: 'do',
        completedCodeCount: 1,
        wrong: false,
      },
    });

    expect(wrapper.text()).toContain('多');
    expect(wrapper.text()).toContain('情');
    expect(wrapper.find('input').exists()).toBe(false);
    expect(wrapper.findAll('[data-code-key]')).toHaveLength(2);
    expect(wrapper.find('[data-code-key].is-done').text()).toBe('d');
  });
});
