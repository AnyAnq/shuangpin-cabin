import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { poemUnits } from '../content/poems';
import { createSession, handlePracticeKey } from '../domain/practice/sessionEngine';
import { calculateAccuracy, calculateWpm } from '../domain/practice/stats';
import { xiaoheScheme } from '../domain/schemes/xiaohe';
import { ziranmaScheme } from '../domain/schemes/ziranma';
import type { ShuangpinSchemeId } from '../domain/schemes/types';

export const usePracticeStore = defineStore('practice', () => {
  const schemeId = ref<ShuangpinSchemeId>('xiaohe');
  const scheme = computed(() => (schemeId.value === 'xiaohe' ? xiaoheScheme : ziranmaScheme));
  const activeUnit = ref(poemUnits[0]);
  const session = ref(createSession({ unit: activeUnit.value, scheme: scheme.value, now: Date.now() }));
  const wrongKey = ref<string | null>(null);
  const lastStatus = ref<'correct' | 'wrong' | 'ignored' | 'complete'>('ignored');
  const hasInteracted = ref(false);

  const currentCode = computed(() => session.value.codes[session.value.cursor.charIndex] ?? '');
  const currentExpectedKey = computed(() => currentCode.value[session.value.cursor.codeIndex] ?? null);
  const keyboardActiveKey = computed(() => (hasInteracted.value ? currentExpectedKey.value : null));
  const progressPercent = computed(() => {
    const totalCodeUnits = session.value.codes.reduce((sum, code) => sum + code.length, 0);
    if (totalCodeUnits === 0) return 0;
    return Math.round((session.value.stats.correctKeystrokes / totalCodeUnits) * 100);
  });
  const liveStats = computed(() => {
    const totalKeystrokes = session.value.stats.correctKeystrokes + session.value.stats.wrongKeystrokes;
    return {
      accuracy: totalKeystrokes === 0 ? 0 : calculateAccuracy(session.value.stats.correctKeystrokes, session.value.stats.wrongKeystrokes),
      elapsedMs: session.value.stats.elapsedMs,
      maxCombo: session.value.stats.maxCombo,
      wpm: session.value.stats.completedChars === 0 ? 0 : calculateWpm({
        completedChars: session.value.stats.completedChars,
        elapsedMs: Math.max(session.value.stats.elapsedMs, 1),
      }),
    };
  });

  function pressKey(key: string) {
    const result = handlePracticeKey(session.value, key, Date.now());
    lastStatus.value = result.status;
    if (result.status !== 'ignored') {
      hasInteracted.value = true;
    }
    wrongKey.value = result.status === 'wrong' ? result.actualKey ?? null : null;
    return result;
  }

  function clearWrongKey() {
    wrongKey.value = null;
  }

  function setScheme(next: ShuangpinSchemeId) {
    schemeId.value = next;
    session.value = createSession({ unit: activeUnit.value, scheme: scheme.value, now: Date.now() });
    wrongKey.value = null;
    lastStatus.value = 'ignored';
    hasInteracted.value = false;
  }

  return {
    schemeId,
    scheme,
    activeUnit,
    session,
    wrongKey,
    lastStatus,
    currentCode,
    currentExpectedKey,
    keyboardActiveKey,
    progressPercent,
    liveStats,
    pressKey,
    clearWrongKey,
    setScheme,
  };
});
