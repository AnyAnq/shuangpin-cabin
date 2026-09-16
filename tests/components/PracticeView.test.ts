import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PracticeView from '../../src/views/PracticeView.vue';

const practiceStore = vi.hoisted(() => ({
  lastStatus: 'ignored',
  hydratePreferences: vi.fn(),
  nextUnit: vi.fn(),
  pressKey: vi.fn(() => ({ status: 'ignored' })),
  clearWrongKey: vi.fn(),
}));

vi.mock('../../src/stores/practiceStore', () => ({
  usePracticeStore: () => practiceStore,
}));

describe('PracticeView', () => {
  beforeEach(() => {
    practiceStore.lastStatus = 'ignored';
    practiceStore.hydratePreferences.mockReset();
    practiceStore.nextUnit.mockReset();
    practiceStore.pressKey.mockReset();
    practiceStore.pressKey.mockReturnValue({ status: 'ignored' });
    practiceStore.clearWrongKey.mockReset();
  });

  it('按钮获得焦点后仍可输入字母，但表单输入和按钮 Enter 不进入练习', () => {
    const wrapper = mount(PracticeView, {
      attachTo: document.body,
      global: { stubs: { AppShell: { template: '<div><button>重练</button><input /></div>' } } },
    });
    const button = wrapper.get('button').element;
    button.focus();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    expect(practiceStore.pressKey).toHaveBeenCalledWith('b');
    practiceStore.pressKey.mockClear();
    wrapper.get('input').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    expect(practiceStore.pressKey).not.toHaveBeenCalled();
    practiceStore.lastStatus = 'complete';
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(practiceStore.nextUnit).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('完成弹窗打开时按 Enter 触发下一组而不是普通输入', () => {
    practiceStore.lastStatus = 'complete';
    const wrapper = mount(PracticeView, {
      global: {
        stubs: {
          AppShell: { template: '<div />' },
        },
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    window.dispatchEvent(event);

    expect(practiceStore.nextUnit).toHaveBeenCalledTimes(1);
    expect(practiceStore.pressKey).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);

    wrapper.unmount();
  });
});
