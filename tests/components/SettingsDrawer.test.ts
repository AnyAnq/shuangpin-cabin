import 'fake-indexeddb/auto';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsDrawer from '../../src/components/settings/SettingsDrawer.vue';
import { usePracticeStore } from '../../src/stores/practiceStore';

describe('SettingsDrawer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('展示轻量设置项和 GitHub 项目入口', () => {
    const wrapper = mount(SettingsDrawer, {
      props: { open: true },
    });

    expect(wrapper.text()).toContain('练习偏好');
    expect(wrapper.text()).toContain('默认双拼方案');
    expect(wrapper.text()).toContain('默认练习模块');
    expect(wrapper.text()).toContain('显示逐字编码');
    expect(wrapper.text()).toContain('本地数据');
    expect(wrapper.text()).toContain('GitHub');
    expect(wrapper.html()).toContain('https://github.com/AnyAnq/shuangpin-cabin');
    expect(wrapper.text()).not.toContain('虚拟键盘');
    expect(wrapper.html()).not.toContain('gitee.com/IQueue/shuangpin-vocabularies');
  });

  it('点击关闭按钮发出 close 事件', async () => {
    const wrapper = mount(SettingsDrawer, {
      props: { open: true },
    });

    await wrapper.get('[aria-label="关闭设置"]').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('切换逐字编码会写入 store 偏好', async () => {
    const store = usePracticeStore();
    const spy = vi.spyOn(store, 'setShowCharacterCodes');
    const wrapper = mount(SettingsDrawer, {
      props: { open: true },
    });

    await wrapper.get('[data-testid="toggle-character-codes"]').trigger('click');

    expect(spy).toHaveBeenCalledWith(false);
  });
});
