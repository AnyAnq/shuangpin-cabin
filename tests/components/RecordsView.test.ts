import 'fake-indexeddb/auto';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecordsView from '../../src/views/RecordsView.vue';
import { usePracticeStore } from '../../src/stores/practiceStore';
import { db } from '../../src/storage/db';
import { upsertMistake } from '../../src/storage/repositories';
import type { MistakeRecord } from '../../src/domain/practice/mistakes';

describe('RecordsView', () => {
  beforeEach(async () => {
    await db.mistakes.clear();
    setActivePinia(createPinia());
  });

  it('没有错题时显示复盘空状态', async () => {
    const { wrapper } = await mountRecordsView();
    await flushPromises();

    expect(wrapper.text()).toContain('纠错教练');
    expect(wrapper.text()).toContain('还没有可复盘的错题');
    expect(wrapper.text()).toContain('开始练习');
  });

  it('展示纠错建议、错因分布和明细列表', async () => {
    await upsertMistake(makeMistake({ id: 'hot-1', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qk', expectedKey: 'q', actualKey: 'w', count: 8 }));
    await upsertMistake(makeMistake({ id: 'hot-2', targetChar: '晴', targetSyllable: 'qing', expectedCode: 'qk', expectedKey: 'q', actualKey: 'w', count: 4 }));
    await upsertMistake(makeMistake({ id: 'final', targetChar: '多', expectedKey: 'o', actualKey: 'p', errorType: 'final-key', count: 2 }));

    const { wrapper } = await mountRecordsView();
    await flushPromises();

    expect(wrapper.text()).toContain('今天先修这个');
    expect(wrapper.text()).toContain('声母键误按');
    expect(wrapper.text()).toContain('重点键 W');
    expect(wrapper.text()).toContain('情晴');
    expect(wrapper.text()).toContain('错因分布');
    expect(wrapper.text()).toContain('韵母键误按');
    expect(wrapper.text()).toContain('错题明细');
    expect(wrapper.text()).toContain('Q -> W');
    expect(wrapper.text()).toContain('8 次');
  });

  it('点击开始易错复练会切换到易错模块并回到练习页', async () => {
    await upsertMistake(makeMistake({ id: 'hot-1', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qk', expectedKey: 'q', actualKey: 'w', count: 8 }));
    const { wrapper, router, pinia } = await mountRecordsView();
    const practice = usePracticeStore(pinia);
    await flushPromises();

    await wrapper.get('[data-testid="start-mistake-practice"]').trigger('click');
    await vi.waitFor(() => {
      expect(router.currentRoute.value.path).toBe('/');
    });

    expect(practice.module).toBe('mistake');
  });

  it('只展示当前方案下的错题复盘', async () => {
    await upsertMistake(makeMistake({ id: 'xiaohe-duo', scheme: 'xiaohe', targetChar: '多', expectedKey: 'd', actualKey: 's', count: 3 }));
    await upsertMistake(makeMistake({ id: 'ziranma-qing', scheme: 'ziranma', targetChar: '情', expectedKey: 'q', actualKey: 'w', count: 9 }));

    const { wrapper, pinia } = await mountRecordsView('xiaohe');
    usePracticeStore(pinia).schemeId = 'xiaohe';
    await flushPromises();

    expect(wrapper.text()).toContain('多');
    expect(wrapper.text()).toContain('D -> S');
    expect(wrapper.text()).toContain('3 次');
    expect(wrapper.text()).not.toContain('情');
  });

  it('可以在复盘页右上角切换双拼方案并刷新错题', async () => {
    await upsertMistake(makeMistake({ id: 'xiaohe-duo', scheme: 'xiaohe', targetChar: '多', expectedKey: 'd', actualKey: 's', count: 3 }));
    await upsertMistake(makeMistake({ id: 'ziranma-qing', scheme: 'ziranma', targetChar: '情', targetSyllable: 'qing', expectedCode: 'qy', expectedKey: 'q', actualKey: 'w', count: 9 }));

    const { wrapper, pinia } = await mountRecordsView('xiaohe');
    const practice = usePracticeStore(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain('多');

    await wrapper.get('[data-testid="records-scheme-ziranma"]').trigger('click');
    await flushPromises();

    expect(practice.schemeId).toBe('ziranma');
    expect(wrapper.text()).toContain('情');
    expect(wrapper.text()).not.toContain('多');
  });
});

async function mountRecordsView(scheme: 'xiaohe' | 'ziranma' = 'xiaohe') {
  const pinia = createPinia();
  setActivePinia(pinia);
  usePracticeStore(pinia).schemeId = scheme;
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'practice', component: { template: '<div />' } },
      { path: '/records', name: 'records', component: { template: '<div />' } },
    ],
  });
  router.push('/records');
  await router.isReady();

  const wrapper = mount(RecordsView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          FloatingSidebar: { template: '<aside />' },
        },
      },
  });
  return { wrapper, router, pinia };
}

function makeMistake(overrides: Partial<MistakeRecord>): MistakeRecord {
  return {
    id: 'xiaohe-duo',
    scheme: 'xiaohe',
    module: 'poem',
    targetChar: '多',
    targetSyllable: 'duo',
    expectedCode: 'do',
    expectedKey: 'd',
    actualKey: 's',
    errorType: 'initial-key',
    contextText: '多情却被无情恼',
    count: 1,
    lastWrongAt: 1000,
    lastCorrectAt: null,
    correctStreak: 0,
    averageCorrectionMs: 0,
    ...overrides,
  };
}
