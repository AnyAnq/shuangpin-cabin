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

  it('每个可练字下方都显示双拼编码引导', () => {
    const wrapper = mount(PracticeStage, {
      props: {
        text: '多情',
        activeIndex: 1,
        code: 'qk',
        completedCodeCount: 0,
        wrong: false,
        codes: ['do', 'qk'],
        textCharIndices: [0, 1],
        completedCharCount: 1,
      },
    });

    expect(wrapper.find('[data-char-code="0"]').attributes('aria-label')).toBe('d o');
    expect(wrapper.find('[data-char-code="1"]').attributes('aria-label')).toBe('q k');
    expect(wrapper.find('[data-char-code="0"]').findAll('[data-char-code-key]').map((key) => key.text())).toEqual(['d', 'o']);
    expect(wrapper.find('[data-char-code="1"]').findAll('[data-char-code-key]').map((key) => key.text())).toEqual(['q', 'k']);
  });

  it('把每个字下方的双拼编码拆成键帽元素', () => {
    const wrapper = mount(PracticeStage, {
      props: {
        text: '多情',
        activeIndex: 0,
        code: 'do',
        completedCodeCount: 0,
        wrong: false,
        codes: ['do', 'qk'],
        textCharIndices: [0, 1],
        completedCharCount: 0,
      },
    });

    const firstCodeKeys = wrapper.find('[data-char-code="0"]').findAll('[data-char-code-key]');
    expect(firstCodeKeys).toHaveLength(2);
    expect(firstCodeKeys.map((key) => key.text())).toEqual(['d', 'o']);
  });

  it('关闭逐字编码后隐藏每个字下方的双拼引导', () => {
    const wrapper = mount(PracticeStage, {
      props: {
        text: '多情',
        activeIndex: 0,
        code: 'do',
        completedCodeCount: 0,
        wrong: false,
        codes: ['do', 'qk'],
        textCharIndices: [0, 1],
        completedCharCount: 0,
        showCharacterCodes: false,
      },
    });

    expect(wrapper.find('[data-char-code="0"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-code-key]')).toHaveLength(2);
  });

  it('标记当前字下方下一次要按的双拼键', () => {
    const wrapper = mount(PracticeStage, {
      props: {
        text: '多情',
        activeIndex: 1,
        code: 'qk',
        completedCodeCount: 1,
        wrong: false,
        codes: ['do', 'qk'],
        textCharIndices: [0, 1],
        completedCharCount: 1,
      },
    });

    const activeKeys = wrapper.find('[data-char-code="1"]').findAll('[data-char-code-key]');
    expect(activeKeys[0].classes()).toContain('is-done');
    expect(activeKeys[1].classes()).toContain('is-current');
  });

  it('按两行展示诗词内容', () => {
    const wrapper = mount(PracticeStage, {
      props: {
        text: '多情却被无情恼，今夜还如昨夜长。',
        activeIndex: 0,
        code: 'do',
        completedCodeCount: 0,
        wrong: false,
      },
    });

    expect(wrapper.findAll('[data-poem-line]')).toHaveLength(2);
    expect(wrapper.findAll('[data-poem-line]')[0].text()).toBe('多情却被无情恼，');
    expect(wrapper.findAll('[data-poem-line]')[1].text()).toBe('今夜还如昨夜长。');
  });

  it('不渲染目标文字上方的箭头', () => {
    const wrapper = mount(PracticeStage, {
      props: {
        text: '多情却被无情恼，今夜还如昨夜长。',
        activeIndex: 0,
        code: 'do',
        completedCodeCount: 0,
        wrong: false,
      },
    });

    expect(wrapper.find('.stage-caret').exists()).toBe(false);
  });

  it('词库练习按固定 6/6 分成两行', () => {
    const wrapper = mount(PracticeStage, {
      props: {
        text: '今天事情可以我们项目完成',
        activeIndex: 0,
        code: 'jb',
        completedCodeCount: 0,
        wrong: false,
        lineCharCount: 6,
      },
    });

    expect(wrapper.findAll('[data-poem-line]')).toHaveLength(2);
    expect(wrapper.findAll('[data-poem-line]')[0].text()).toBe('今天事情可以');
    expect(wrapper.findAll('[data-poem-line]')[1].text()).toBe('我们项目完成');
  });
});
