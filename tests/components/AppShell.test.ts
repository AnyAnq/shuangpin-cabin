import 'fake-indexeddb/auto';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import AppShell from '../../src/components/layout/AppShell.vue';
import { usePracticeStore } from '../../src/stores/practiceStore';

async function mountAppShell() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'practice', component: { template: '<div />' } },
      { path: '/records', name: 'records', component: { template: '<div />' } },
      { path: '/vocabularies', name: 'vocabularies', component: { template: '<div />' } },
    ],
  });
  router.push('/');
  await router.isReady();

  const pinia = createPinia();
  const wrapper = mount(AppShell, {
    global: {
      plugins: [pinia, router],
    },
  });

  return { wrapper, pinia };
}

describe('AppShell', () => {
  it('渲染 V6 首页外壳的核心区域', async () => {
    const { wrapper } = await mountAppShell();

    expect(wrapper.text()).not.toContain('单字练习');
    expect(wrapper.text()).toContain('诗词句子');
    expect(wrapper.text()).toContain('绕口令');
    expect(wrapper.text()).toContain('词库练习');
    expect(wrapper.text()).not.toContain('文章打字');
    expect(wrapper.text()).toContain('小鹤双拼');
    expect(wrapper.text()).toContain('自然码');
    expect(wrapper.text()).toContain('易错练习');
    expect(wrapper.text()).toContain('实时统计');
    expect(wrapper.text()).toContain('某日一言');
    expect(wrapper.text()).not.toContain('每日一言');
    expect(wrapper.find('.quote-card em').exists()).toBe(false);
    expect(wrapper.find('[data-testid="floating-sidebar"]').exists()).toBe(true);
  });

  it('没有安装词库时展示词库安装引导而不是空白练习', async () => {
    const { wrapper, pinia } = await mountAppShell();
    const practice = usePracticeStore(pinia);

    await practice.setModule('vocabulary');
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('还没有安装词库');
    expect(wrapper.text()).toContain('按场景定制');
    expect(wrapper.text()).toContain('12 字连续练');
    expect(wrapper.text()).toContain('练习更稳定');
    expect(wrapper.text()).toContain('不反复请求词库源');
    expect(wrapper.text()).toContain('安装词库');
    expect(wrapper.find('.practice-stage').exists()).toBe(false);
  });

  it('切换取题时禁用主要切换按钮并显示轻量 loading', async () => {
    const { wrapper, pinia } = await mountAppShell();
    const practice = usePracticeStore(pinia);

    practice.isSwitching = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('取题中...');
    expect(wrapper.get('button.soft-pill').attributes('disabled')).toBeDefined();
    expect(wrapper.get('button.segment').attributes('disabled')).toBeDefined();
  });

  it('点击当前已选练习模块不会重新取题', async () => {
    const { wrapper, pinia } = await mountAppShell();
    const practice = usePracticeStore(pinia);
    const setModuleSpy = vi.spyOn(practice, 'setModule');

    await wrapper.get('button.segment.is-active').trigger('click');

    expect(setModuleSpy).not.toHaveBeenCalled();
  });

  it('易错练习时右侧展示错因分组信息', async () => {
    const { wrapper, pinia } = await mountAppShell();
    const practice = usePracticeStore(pinia);

    practice.module = 'mistake';
    practice.mistakeGroups = [{
      id: 'g1',
      title: '声母键误按',
      description: '重点修正 S 附近的声母误按。',
      target: '连续正确 3 次后降权',
      focusKeys: ['s'],
      total: 2,
      empty: false,
      reason: { type: 'initial-key', expectedKey: 'd', actualKey: 's' },
      mistakeIds: ['m1', 'm2'],
      priority: 10,
      unit: { id: 'g1', module: 'character', text: '多打', syllables: ['duo', 'da'], tags: ['易错'] },
    }];
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('错因复练');
    expect(wrapper.text()).toContain('声母键误按');
    expect(wrapper.text()).toContain('重点键 S');
    expect(wrapper.text()).toContain('0/2');
    expect(wrapper.text()).toContain('连续正确 3 次后降权');
  });

  it('易错练习没有错题时在主区域展示鼓励文案', async () => {
    const { wrapper, pinia } = await mountAppShell();
    const practice = usePracticeStore(pinia);

    practice.module = 'mistake';
    practice.mistakeGroups = [{
      id: 'empty',
      title: '太棒了，没有出过错误',
      description: '目前还没有发现需要复练的错题，说明你的输入状态很稳。',
      target: '继续保持，打出第一条错题后这里会自动生成复练组',
      focusKeys: [],
      total: 0,
      empty: true,
      reason: { type: 'sequence', expectedKey: '', actualKey: '' },
      mistakeIds: [],
      priority: -1,
      unit: { id: 'empty', module: 'character', text: '', syllables: [], tags: ['零错记录'] },
    }];
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.mistake-empty-stage').text()).toContain('太棒了，没有出过错误');
    expect(wrapper.find('.right-panel .mistake-card').exists()).toBe(false);
  });

  it('词库练习选择器最左侧展示更醒目的混合按钮', async () => {
    const { wrapper, pinia } = await mountAppShell();
    const practice = usePracticeStore(pinia);

    practice.module = 'vocabulary';
    practice.vocabularyPackages = [{
      id: 'local-only',
      name: '本地词库',
      version: '1.0.0',
      description: '本地词库。',
      author: '本地导入',
      license: 'Personal',
      pricingType: 'owned',
      tags: ['local'],
      entryCount: 3,
      installedAt: 1,
      updatedAt: 1,
      sourceUrl: 'local-file:local.json',
      sourceType: 'local',
    }];
    await wrapper.vm.$nextTick();

    const buttons = wrapper.findAll('.vocabulary-picker button');

    expect(buttons[0].text()).toBe('混合');
    expect(buttons[0].classes()).toContain('is-mixed');
    expect(wrapper.text()).toContain('本地词库');
  });
});
