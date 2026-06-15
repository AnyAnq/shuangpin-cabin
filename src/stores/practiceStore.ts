import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { articleUnits } from '../content/articles';
import { characterUnits } from '../content/characters';
import { poemUnits } from '../content/poems';
import { dailyQuotes } from '../content/quotes';
import type { MistakeRecord } from '../domain/practice/mistakes';
import { createSession, getActiveTextIndex, handlePracticeKey } from '../domain/practice/sessionEngine';
import { calculateAccuracy, calculateWpm } from '../domain/practice/stats';
import type { PracticeModule, PracticeUnit } from '../domain/practice/types';
import { xiaoheScheme } from '../domain/schemes/xiaohe';
import { ziranmaScheme } from '../domain/schemes/ziranma';
import type { ShuangpinSchemeId } from '../domain/schemes/types';
import {
  listMistakesForPractice,
  loadPreferences,
  markMistakeCorrect,
  savePreferences,
  saveSession,
  upsertMistake,
} from '../storage/repositories';
import { fetchDailyQuote, fetchPoetryUnit, fetchTongueTwisterUnit } from '../services/contentApi';

export const usePracticeStore = defineStore('practice', () => {
  const schemeId = ref<ShuangpinSchemeId>('xiaohe');
  const scheme = computed(() => (schemeId.value === 'xiaohe' ? xiaoheScheme : ziranmaScheme));
  const module = ref<PracticeModule>('poem');
  const unitIndex = ref(0);
  const pendingMistake = ref<MistakeRecord | null>(null);
  const mistakeUnits = ref<PracticeUnit[]>([]);
  const onlinePoemUnit = ref<PracticeUnit | null>(null);
  const onlineTongueTwisterUnit = ref<PracticeUnit | null>(null);
  const dailyQuote = ref(dailyQuotes[0]);
  const activeUnit = ref(poemUnits[0]);
  const session = ref(createSession({ unit: activeUnit.value, scheme: scheme.value, now: Date.now() }));
  const wrongKey = ref<string | null>(null);
  const lastStatus = ref<'correct' | 'wrong' | 'ignored' | 'complete'>('ignored');
  const hasInteracted = ref(false);
  const isSwitching = ref(false);
  let mistakeSaveQueue: Promise<unknown> = Promise.resolve();
  let moduleSwitchSeq = 0;

  const currentCode = computed(() => session.value.codes[session.value.cursor.charIndex] ?? '');
  const currentExpectedKey = computed(() => currentCode.value[session.value.cursor.codeIndex] ?? null);
  const activeTextIndex = computed(() => getActiveTextIndex(session.value));
  const moduleLabel = computed(() => {
    if (module.value === 'character') return '单字练习';
    if (module.value === 'article') return '绕口令';
    if (module.value === 'mistake') return '易错练习';
    return '诗词句子';
  });
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
    if (result.status === 'wrong' && result.expectedKey && result.actualKey) {
      const record = createMistakeRecord(result.expectedKey, result.actualKey);
      pendingMistake.value = record;
      mistakeSaveQueue = mistakeSaveQueue.then(() => upsertMistake(record));
    }
    if (result.status === 'complete') {
      void saveCurrentSession();
      void markCurrentMistakeCorrect();
    }
    return result;
  }

  function clearWrongKey() {
    wrongKey.value = null;
  }

  function setScheme(next: ShuangpinSchemeId) {
    schemeId.value = next;
    resetSession(activeUnit.value);
    void saveCurrentPreferences();
  }

  async function setModule(next: PracticeModule) {
    const switchSeq = ++moduleSwitchSeq;
    isSwitching.value = true;
    try {
      module.value = next;
      unitIndex.value = 0;
      resetSession(unitsForModule(next)[0]);
      await refreshOnlineUnit(next);
      if (next === 'mistake') {
        await refreshMistakeUnits();
      }
      if (switchSeq !== moduleSwitchSeq || module.value !== next) {
        return;
      }
      resetSession(unitsForModule(next)[0]);
      void saveCurrentPreferences();
    } finally {
      if (switchSeq === moduleSwitchSeq) {
        isSwitching.value = false;
      }
    }
  }

  async function nextUnit() {
    if (isSwitching.value) {
      return;
    }
    closeCompletion();
    const switchSeq = ++moduleSwitchSeq;
    isSwitching.value = true;
    try {
      const targetModule = module.value;
      await refreshOnlineUnit(targetModule);
      if (targetModule === 'mistake') {
        await refreshMistakeUnits();
      }
      if (switchSeq !== moduleSwitchSeq || module.value !== targetModule) {
        return;
      }
      const units = unitsForModule(targetModule);
      unitIndex.value = (unitIndex.value + 1) % units.length;
      resetSession(units[unitIndex.value]);
    } finally {
      if (switchSeq === moduleSwitchSeq) {
        isSwitching.value = false;
      }
    }
  }

  function restartCurrent() {
    resetSession(activeUnit.value);
  }

  function closeCompletion() {
    if (lastStatus.value === 'complete') {
      lastStatus.value = 'ignored';
    }
  }

  async function hydratePreferences() {
    await refreshDailyQuote();
    const preference = await loadPreferences();
    if (!preference) return;

    schemeId.value = preference.scheme;
    module.value = 'poem';
    unitIndex.value = 0;
    resetSession(unitsForModule(module.value)[0]);
  }

  function resetSession(unit: PracticeUnit) {
    activeUnit.value = unit;
    session.value = createSession({ unit, scheme: scheme.value, now: Date.now() });
    wrongKey.value = null;
    pendingMistake.value = null;
    lastStatus.value = 'ignored';
    hasInteracted.value = false;
  }

  function unitsForModule(targetModule: PracticeModule): PracticeUnit[] {
    if (targetModule === 'character') return characterUnits;
    if (targetModule === 'article') return onlineTongueTwisterUnit.value ? [onlineTongueTwisterUnit.value, ...articleUnits] : articleUnits;
    if (targetModule === 'mistake') return mistakeUnits.value.length > 0 ? mistakeUnits.value : [pendingMistakeToUnit() ?? characterUnits[0]];
    return onlinePoemUnit.value ? [onlinePoemUnit.value, ...poemUnits] : poemUnits;
  }

  function pendingMistakeToUnit(): PracticeUnit | null {
    if (!pendingMistake.value) return null;
    return {
      id: `mistake-${pendingMistake.value.id}`,
      module: 'character',
      text: pendingMistake.value.targetChar,
      syllables: [pendingMistake.value.targetSyllable],
      tags: ['易错'],
    };
  }

  function createMistakeRecord(expectedKey: string, actualKey: string): MistakeRecord {
    const charIndex = session.value.cursor.charIndex;
    const targetChar = Array.from(activeUnit.value.text)[session.value.textCharIndices[charIndex] ?? charIndex] ?? '';
    const targetSyllable = activeUnit.value.syllables[charIndex] ?? '';
    const expectedCode = session.value.codes[charIndex] ?? '';
    const now = Date.now();

    return {
      id: `${schemeId.value}-${activeUnit.value.id}-${charIndex}-${expectedKey}-${actualKey}`,
      scheme: schemeId.value,
      module: module.value,
      targetChar,
      targetSyllable,
      expectedCode,
      expectedKey,
      actualKey,
      errorType: session.value.cursor.codeIndex === 0 ? 'initial-key' : 'final-key',
      contextText: activeUnit.value.text,
      count: 1,
      lastWrongAt: now,
      lastCorrectAt: null,
      correctStreak: 0,
      averageCorrectionMs: 0,
    };
  }

  function saveCurrentPreferences() {
    return savePreferences({
      id: 'default',
      scheme: schemeId.value,
      module: module.value,
      updatedAt: Date.now(),
    });
  }

  function saveCurrentSession() {
    return saveSession({
      id: `${Date.now()}-${activeUnit.value.id}-${schemeId.value}`,
      scheme: schemeId.value,
      module: module.value,
      accuracy: liveStats.value.accuracy,
      wpm: liveStats.value.wpm,
      maxCombo: liveStats.value.maxCombo,
      elapsedMs: liveStats.value.elapsedMs,
      createdAt: Date.now(),
    });
  }

  function markCurrentMistakeCorrect() {
    if (module.value !== 'mistake' || !activeUnit.value.id.startsWith('mistake-')) {
      return Promise.resolve();
    }
    return markMistakeCorrect(activeUnit.value.id.replace(/^mistake-/, ''));
  }

  async function refreshMistakeUnits() {
    const records = await listMistakesForPractice(schemeId.value);
    mistakeUnits.value = records.map(mistakeRecordToUnit);
  }

  async function refreshOnlineUnit(targetModule: PracticeModule) {
    try {
      if (targetModule === 'article') {
        onlineTongueTwisterUnit.value = await fetchTongueTwisterUnit();
      }
      if (targetModule === 'poem') {
        onlinePoemUnit.value = await fetchPoetryUnit();
      }
    } catch {
      // 免费内容 API 偶发失败时保留本地内容，避免打字练习被网络状态打断。
    }
  }

  async function refreshDailyQuote() {
    try {
      dailyQuote.value = await fetchDailyQuote();
    } catch {
      dailyQuote.value = dailyQuotes[0];
    }
  }

  function mistakeRecordToUnit(record: MistakeRecord): PracticeUnit {
    return {
      id: `mistake-${record.id}`,
      module: 'character',
      text: record.targetChar,
      syllables: [record.targetSyllable],
      tags: ['易错'],
    };
  }

  return {
    schemeId,
    scheme,
    module,
    activeUnit,
    session,
    wrongKey,
    pendingMistake,
    lastStatus,
    isSwitching,
    currentCode,
    currentExpectedKey,
    activeTextIndex,
    dailyQuote,
    moduleLabel,
    keyboardActiveKey,
    progressPercent,
    liveStats,
    pressKey,
    clearWrongKey,
    setScheme,
    setModule,
    nextUnit,
    restartCurrent,
    closeCompletion,
    hydratePreferences,
  };
});
