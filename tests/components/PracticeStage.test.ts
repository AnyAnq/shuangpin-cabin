import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PracticeStage from '../../src/components/practice/PracticeStage.vue';

describe('PracticeStage', () => {
  it('题注独立显示，句末分行，逗号作为可选换行点', () => {
    const wrapper = mount(PracticeStage, {
      props: {
        text: '一片春愁待酒浇。江上舟摇，楼上帘招。',
        title: '一剪梅·舟过吴江', author: '蒋捷',
        activeIndex: 0, code: 'yi', completedCodeCount: 0, wrong: false,
      },
    });
    expect(wrapper.get('.practice-heading').text()).toContain('《一剪梅 · 舟过吴江》');
    expect(wrapper.get('.practice-heading').text()).toContain('蒋捷');
    const lines = wrapper.findAll('[data-poem-line]');
    expect(lines.map(line => line.text())).toEqual(['一片春愁待酒浇。', '江上舟摇，楼上帘招。']);
    expect(lines[1].findAll('.practice-clause').map(clause => clause.text())).toEqual(['江上舟摇，', '楼上帘招。']);
    expect(wrapper.get('.target-line').text()).not.toContain('蒋捷');
  });

  it('连续标点跟随前字，开括号跟随后字，换行不改变正文索引', () => {
    const text = '他说：“好！？”\n（再练），继续。';
    const activeIndex = Array.from(text).indexOf('再');
    const indices = Array.from(text).flatMap((char, index) => /\p{Script=Han}/u.test(char) ? [index] : []);
    const wrapper = mount(PracticeStage, {
      props: { text, activeIndex, code: 'zd', completedCodeCount: 0, wrong: false,
        codes: ['ta', 'uo', 'hc', 'zd', 'lm', 'ji', 'xu'], textCharIndices: indices },
    });
    expect(wrapper.findAll('.text-group').map(group => group.findAll('.target-glyph').map(glyph => glyph.text()).join('')))
      .toEqual(['他', '说：', '“好！？”', '（再', '练），', '继', '续。']);
    expect(wrapper.get('.target-char.is-active .target-glyph').text()).toBe('再');
    expect(wrapper.get('[data-char-code="' + activeIndex + '"]').attributes('aria-label')).toBe('z d');
    expect(wrapper.find('.practice-heading').exists()).toBe(false);
  });

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

  it('逗号分句不强制另起一行', () => {
    const wrapper = mount(PracticeStage, {
      props: {
        text: '多情却被无情恼，今夜还如昨夜长。',
        activeIndex: 0,
        code: 'do',
        completedCodeCount: 0,
        wrong: false,
      },
    });

    expect(wrapper.findAll('[data-poem-line]')).toHaveLength(1);
    expect(wrapper.findAll('.practice-clause').map(clause => clause.text())).toEqual(['多情却被无情恼，', '今夜还如昨夜长。']);
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

  it('无标点的词库文本交给容器自适应换行', () => {
    const wrapper = mount(PracticeStage, {
      props: {
        text: '今天事情可以我们项目完成',
        activeIndex: 0,
        code: 'jb',
        completedCodeCount: 0,
        wrong: false,
      },
    });

    expect(wrapper.findAll('[data-poem-line]')).toHaveLength(1);
    expect(wrapper.get('[data-poem-line]').text()).toBe('今天事情可以我们项目完成');
  });
  it('按标点分句，下一分句编码索引保持正确', () => {
    const wrapper = mount(PracticeStage, {
      props: {
        text: '每天练习双拼，让输入更轻松。',
        activeIndex: 7,
        code: 'rh',
        completedCodeCount: 0,
        wrong: false,
        codes: ['mw', 'tm', 'lm', 'xi', 'ul', 'pb', 'rh', 'uu', 'ru', 'gg', 'qk', 'ss'],
        textCharIndices: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12],
        completedCharCount: 6,
      },
    });

    const lines = wrapper.findAll('.practice-clause');
    expect(lines.map(line => line.findAll('.target-glyph').map(glyph => glyph.text()).join('')))
      .toEqual(['每天练习双拼，', '让输入更轻松。']);
    expect(wrapper.get('.target-char.is-active .target-glyph').text()).toBe('让');
    expect(wrapper.get('[data-char-code="7"]').attributes('aria-label')).toBe('r h');
    expect(wrapper.find('[data-char-code="6"]').exists()).toBe(false);
  });

});
