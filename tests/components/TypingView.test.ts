import 'fake-indexeddb/auto';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TypingView from '../../src/views/TypingView.vue';
import { useTypingStore } from '../../src/stores/typingStore';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function setup() {
  const pinia = createPinia();
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/typing', name: 'typing', component: TypingView },
    { path: '/records', name: 'records', component: { template: '<div />' } },
  ] });
  await router.push('/typing');
  const wrapper = mount(RouterView, { attachTo: document.body, global: { plugins: [pinia, router], stubs: { FloatingSidebar: true, SettingsDrawer: true } } });
  await flushPromises();
  await wrapper.get('button.primary-action').trigger('click');
  return { wrapper, router, store: useTypingStore(pinia) };
}

describe('中文输入界面', () => {
  it('组词和计时刷新不覆盖输入框，确认上屏后才判定，中间编辑保留光标', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { wrapper, store } = await setup();
    try {
      const input = wrapper.get<HTMLTextAreaElement>('#typing-input');
      await input.trigger('compositionstart');
      input.element.value = 'nihao';
      await input.trigger('input', { isComposing: true });
      await vi.advanceTimersByTimeAsync(2000);
      expect(input.element.value).toBe('nihao');
      expect(store.inputText).toBe('');
      expect(store.startedAt).not.toBeNull();
      expect(wrapper.get('.typing-footer button').attributes('disabled')).toBeDefined();
      input.element.value = '你好';
      await input.trigger('compositionend');
      await input.trigger('input');
      expect(store.inputText).toBe('你好');
      expect(wrapper.get('.typing-footer button').attributes('disabled')).toBeUndefined();
      input.element.value = '你们好';
      input.element.setSelectionRange(2, 2);
      await input.trigger('input');
      await vi.advanceTimersByTimeAsync(1000);
      expect(input.element.selectionStart).toBe(2);
      expect(input.element.value).toBe('你们好');
      expect(document.activeElement).toBe(input.element);
      expect(store.report).toBeNull();
    } finally { wrapper.unmount(); }
  });

  it('粘贴与拖入被阻止，放弃未完成的练习需要确认', async () => {
    const { wrapper, router, store } = await setup();
    try {
      const input = wrapper.get<HTMLTextAreaElement>('#typing-input');
      for (const type of ['paste', 'drop']) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        input.element.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
      await input.setValue('测试');
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      await router.push('/records');
      expect(router.currentRoute.value.path).toBe('/typing');
      expect(store.inputText).toBe('测试');
      confirm.mockReturnValue(true);
      await router.push('/records');
      expect(router.currentRoute.value.path).toBe('/records');
      expect(store.article).toBeNull();
    } finally { wrapper.unmount(); }
  });
});
