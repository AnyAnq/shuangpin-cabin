import 'fake-indexeddb/auto';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsDrawer from '../../src/components/settings/SettingsDrawer.vue';
import { usePracticeStore } from '../../src/stores/practiceStore';
import { db } from '../../src/storage/db';

describe('SettingsDrawer', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.vocabularyPackages.clear();
    await db.vocabularyEntries.clear();
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

  it('在设置里导入本地 TXT 词库并发出刷新事件', async () => {
    const wrapper = mount(SettingsDrawer, {
      props: { open: true },
    });

    const input = wrapper.get('[data-testid="settings-import-vocabulary-input"]');
    Object.defineProperty(input.element as HTMLInputElement, 'files', {
      value: [textFile('我的设置词库.txt', '今天\n项目,80,工作\nA计划')],
      configurable: true,
    });
    await input.trigger('change');
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('有效词条 2');
    });

    expect(wrapper.text()).toContain('过滤 1');
    await wrapper.get('[data-testid="settings-confirm-vocabulary-import"]').trigger('click');
    await vi.waitFor(async () => {
      expect(await db.vocabularyPackages.where('sourceType').equals('local').count()).toBe(1);
    });

    expect(await db.vocabularyEntries.where('packageId').startsWith('local-我的设置词库').count()).toBe(2);
    expect(wrapper.emitted('vocabulary-imported')).toHaveLength(1);
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

function textFile(name: string, content: string, type = 'text/plain') {
  return new File([content], name, { type });
}
