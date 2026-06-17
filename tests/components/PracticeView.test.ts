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
