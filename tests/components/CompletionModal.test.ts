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
});
