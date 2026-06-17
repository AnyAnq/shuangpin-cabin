import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CompletionModal from '../../src/components/practice/CompletionModal.vue';

describe('CompletionModal', () => {
  it('提供关闭按钮并触发关闭事件', async () => {
    const wrapper = mount(CompletionModal, {
      props: {
        open: true,
        accuracy: 88,
        wpm: 24,
        maxCombo: 16,
        busy: false,
      },
    });

    const closeButton = wrapper.get('[aria-label="关闭完成弹窗"]');
    await closeButton.trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('展示易错分组本轮复练结果', () => {
    const wrapper = mount(CompletionModal, {
      props: {
        open: true,
        accuracy: 92,
        wpm: 20,
        maxCombo: 12,
        busy: false,
        practicedCount: 5,
        streakGain: 1,
      },
    });

    expect(wrapper.text()).toContain('本组复练 5');
    expect(wrapper.text()).toContain('连续正确 +1');
  });
});
