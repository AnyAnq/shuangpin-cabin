import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePracticeStore } from '../../src/stores/practiceStore';

describe('练习状态', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('按错键时记录错误键且不推进', () => {
    const store = usePracticeStore();

    const result = store.pressKey('s');

    expect(result.status).toBe('wrong');
    expect(store.wrongKey).toBe('s');
    expect(store.session.cursor.charIndex).toBe(0);
    expect(store.session.cursor.codeIndex).toBe(0);
  });

  it('切换自然码后刷新当前编码', () => {
    const store = usePracticeStore();

    store.setScheme('ziranma');

    expect(store.scheme.id).toBe('ziranma');
    expect(store.currentCode).toBe('do');
  });
});
