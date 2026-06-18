import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { DailyQuote } from '../content/quotes';
import type { MistakePracticeGroup, MistakeRecord } from '../domain/practice/mistakes';
import { groupMistakesForPractice, mistakeGroupToPracticeUnit } from '../domain/practice/mistakes';
import { createSession, getActiveTextIndex, handlePracticeKey } from '../domain/practice/sessionEngine';
import { calculateAccuracy, calculateWpm } from '../domain/practice/stats';
import type { PracticeModule, PracticeUnit } from '../domain/practice/types';
import { buildVocabularyPracticeUnits, createVocabularyPackageFromEntries, type VocabularyPracticeUnit } from '../domain/vocabulary';
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
  clearMistakes,
  clearSessions,
} from '../storage/repositories';
import {
  getInstalledVocabularyPackage,
  listInstalledVocabularyPackages,
  listVocabularyEntries,
  clearVocabularyPackages,
} from '../storage/vocabularyRepository';
import type { VocabularyPackageRecord } from '../storage/db';
import {
  fetchDailyQuote,
  fetchPoetryUnit,
  fetchTongueTwisterUnit,
  prefetchPoetryUnit,
  prefetchTongueTwisterUnit,
  consumeCachedPoetryUnit,
  consumeCachedTongueTwisterUnit,
} from '../services/contentApi';

const RECENT_UNIT_TEXT_LIMIT = 6;
const MIXED_VOCABULARY_PACKAGE_ID = '__mixed_vocabulary__';
const emptyPoemUnit = createEmptyUnit('poem');
const emptyArticleUnit = createEmptyUnit('article');
const emptyCharacterUnit = createEmptyUnit('character');
const emptyVocabularyUnit = createEmptyUnit('vocabulary');
const emptyQuote: DailyQuote = { text: '', source: '某日一言', tags: ['在线内容'] };

export const usePracticeStore = defineStore('practice', () => {
  const schemeId = ref<ShuangpinSchemeId>('xiaohe');
  const scheme = computed(() => (schemeId.value === 'xiaohe' ? xiaoheScheme : ziranmaScheme));
  const module = ref<PracticeModule>('poem');
  const defaultModule = ref<PracticeModule>('poem');
  const showCharacterCodes = ref(true);
  const unitIndex = ref(0);
  const pendingMistake = ref<MistakeRecord | null>(null);
  const mistakeUnits = ref<PracticeUnit[]>([]);
  const mistakeGroups = ref<MistakePracticeGroup[]>([]);
  const onlinePoemUnit = ref<PracticeUnit | null>(null);
  const onlineTongueTwisterUnit = ref<PracticeUnit | null>(null);
  const vocabularyPackages = ref<VocabularyPackageRecord[]>([]);
  const selectedVocabularyPackageId = ref<string | null>(null);
  const vocabularyUnits = ref<VocabularyPracticeUnit[]>([]);
  const recentUnitTexts = ref<Partial<Record<PracticeModule, string[]>>>({});
  const dailyQuote = ref(emptyQuote);
  const activeUnit = ref(emptyPoemUnit);
  const session = ref(createSession({ unit: activeUnit.value, scheme: scheme.value, now: Date.now() }));
  const wrongKey = ref<string | null>(null);
  const lastStatus = ref<'correct' | 'wrong' | 'ignored' | 'complete'>('ignored');
  const hasInteracted = ref(false);
  const isSwitching = ref(false);
  let prefetchQueue: Promise<void> = Promise.resolve();
  let mistakeSaveQueue: Promise<unknown> = Promise.resolve();
  let moduleSwitchSeq = 0;
  let preferenceHydrateSeq = 0;
  let hasManualPracticeSelection = false;

  const currentCode = computed(() => session.value.codes[session.value.cursor.charIndex] ?? '');
  const currentExpectedKey = computed(() => currentCode.value[session.value.cursor.codeIndex] ?? null);
  const activeTextIndex = computed(() => getActiveTextIndex(session.value));
  const moduleLabel = computed(() => {
    if (module.value === 'character') return '单字练习';
    if (module.value === 'article') return '绕口令';
    if (module.value === 'vocabulary') return '词库练习';
    if (module.value === 'mistake') return '易错练习';
    return '诗词句子';
  });
  const keyboardActiveKey = computed(() => (hasInteracted.value ? currentExpectedKey.value : null));
  const currentMistakeGroup = computed(() => (module.value === 'mistake' ? mistakeGroups.value[unitIndex.value] ?? null : null));
  const vocabularyNeedsInstall = computed(() => module.value === 'vocabulary' && vocabularyPackages.value.length === 0);
  const isMixedVocabularyMode = computed(() => selectedVocabularyPackageId.value === MIXED_VOCABULARY_PACKAGE_ID);
  const currentVocabularyPackage = computed(() => {
    if (isMixedVocabularyMode.value && vocabularyPackages.value.length > 0) {
      return createMixedVocabularyRecord(vocabularyPackages.value);
    }
    return vocabularyPackages.value.find((item) => item.id === selectedVocabularyPackageId.value) ?? vocabularyPackages.value[0] ?? null;
  });
  const mistakeGroupTitle = computed(() => currentMistakeGroup.value?.title ?? '');
  const mistakeGroupDescription = computed(() => currentMistakeGroup.value?.description ?? '');
  const mistakeGroupFocusKeys = computed(() => currentMistakeGroup.value?.focusKeys ?? []);
  const mistakeGroupEmpty = computed(() => currentMistakeGroup.value?.empty ?? false);
  const awaitingOnlineContent = computed(() => (module.value === 'poem' || module.value === 'article') && activeUnit.value.text.length === 0 && isSwitching.value);
  const mistakeGroupProgress = computed(() => ({
    completed: module.value === 'mistake' ? session.value.stats.completedChars : 0,
    total: currentMistakeGroup.value?.total ?? 0,
  }));
  const mistakeCompletion = computed(() => {
    const total = currentMistakeGroup.value?.total ?? 0;
    const practiced = lastStatus.value === 'complete' && module.value === 'mistake' && !currentMistakeGroup.value?.empty ? total : 0;
    return {
      practiced,
      streakGain: practiced > 0 ? 1 : 0,
    };
  });
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
    if (activeUnit.value.syllables.length === 0) {
      return {
        status: 'ignored' as const,
        currentCharIndex: session.value.cursor.charIndex,
        currentTextIndex: activeTextIndex.value,
        currentCodeIndex: session.value.cursor.codeIndex,
      };
    }

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
    hasManualPracticeSelection = true;
    preferenceHydrateSeq += 1;
    const switchSeq = ++moduleSwitchSeq;
    isSwitching.value = true;
    try {
      module.value = next;
      unitIndex.value = 0;
      resetSession(unitsForModule(next)[0], false);
      await refreshOnlineUnit(next);
      if (next === 'mistake') {
        await refreshMistakeUnits();
      }
      if (next === 'vocabulary') {
        await refreshVocabularyUnits();
      }
      if (switchSeq !== moduleSwitchSeq || module.value !== next) {
        return;
      }
      const units = unitsForModule(next);
      unitIndex.value = selectFreshUnitIndex(next, units, 0);
      resetSession(units[unitIndex.value]);
      await saveCurrentPreferences();
    } finally {
      if (switchSeq === moduleSwitchSeq) {
        isSwitching.value = false;
      }
    }
  }

  async function setDefaultModule(next: PracticeModule) {
    defaultModule.value = next;
    await saveCurrentPreferences();
  }

  async function setShowCharacterCodes(next: boolean) {
    showCharacterCodes.value = next;
    await saveCurrentPreferences();
  }

  async function clearMistakeRecords() {
    await clearMistakes();
    if (module.value === 'mistake') {
      await refreshMistakeUnits();
      unitIndex.value = 0;
      resetSession(unitsForModule('mistake')[0]);
    }
  }

  async function clearPracticeSessions() {
    await clearSessions();
  }

  async function clearInstalledVocabularies() {
    await clearVocabularyPackages();
    await refreshVocabularyPackages();
    if (module.value === 'vocabulary') {
      unitIndex.value = 0;
      resetSession(unitsForModule('vocabulary')[0]);
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
      
      // First attempt to consume cached unit (instant switch)
      if (targetModule === 'poem') {
        const cached = consumeCachedPoetryUnit();
        if (cached) {
          const units = unitsForModule(targetModule);
          unitIndex.value = selectFreshUnitIndex(targetModule, units, (unitIndex.value + 1) % units.length);
          resetSession(units[unitIndex.value]);
          if (switchSeq === moduleSwitchSeq) {
            isSwitching.value = false;
          }
          // Kick off background preload for next unit
          startBackgroundPrefetch();
          return;
        }
      } else if (targetModule === 'article') {
        const cached = consumeCachedTongueTwisterUnit();
        if (cached) {
          const units = unitsForModule(targetModule);
          unitIndex.value = selectFreshUnitIndex(targetModule, units, (unitIndex.value + 1) % units.length);
          resetSession(units[unitIndex.value]);
          if (switchSeq === moduleSwitchSeq) {
            isSwitching.value = false;
          }
          // Kick off background preload for next unit
          startBackgroundPrefetch();
          return;
        }
      }
      
      // Fallback: fetch fresh content if no cache available
      await refreshOnlineUnit(targetModule);
      if (targetModule === 'mistake') {
        await refreshMistakeUnits();
      }
      if (targetModule === 'vocabulary') {
        await refreshVocabularyUnits();
      }
      if (switchSeq !== moduleSwitchSeq || module.value !== targetModule) {
        return;
      }
      const units = unitsForModule(targetModule);
      unitIndex.value = selectFreshUnitIndex(targetModule, units, (unitIndex.value + 1) % units.length);
      resetSession(units[unitIndex.value]);
      
      // Kick off background preload for next unit
      startBackgroundPrefetch();
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
    if (hasManualPracticeSelection) {
      return;
    }
    const hydrateSeq = ++preferenceHydrateSeq;
    unitIndex.value = 0;
    isSwitching.value = true;
    try {
      const preference = await loadPreferences();
      let nextModule: PracticeModule = 'poem';
      if (preference) {
        schemeId.value = preference.scheme;
        selectedVocabularyPackageId.value = preference.lastVocabularyPackageId ?? null;
        defaultModule.value = preference.defaultModule ?? 'poem';
        showCharacterCodes.value = preference.showCharacterCodes ?? true;
        nextModule = preference.defaultModule ?? 'poem';
      }
      module.value = nextModule === 'character' ? 'poem' : nextModule;
      await refreshVocabularyPackages();
      if (module.value === 'mistake') {
        await refreshMistakeUnits();
      }
      if (module.value === 'vocabulary') {
        await refreshVocabularyUnits();
      }
      await Promise.all([
        refreshDailyQuote(),
        refreshOnlineUnit(module.value),
      ]);
      if (hydrateSeq !== preferenceHydrateSeq) {
        return;
      }
      resetSession(unitsForModule(module.value)[0]);
      startBackgroundPrefetch();
    } finally {
      if (hydrateSeq === preferenceHydrateSeq) {
        isSwitching.value = false;
      }
    }
  }

  function resetSession(unit: PracticeUnit, rememberRecent = true) {
    activeUnit.value = unit;
    session.value = createSession({ unit, scheme: scheme.value, now: Date.now() });
    wrongKey.value = null;
    pendingMistake.value = null;
    lastStatus.value = 'ignored';
    hasInteracted.value = false;
    if (rememberRecent) {
      rememberRecentUnitText(module.value, unit);
    }
  }

  function unitsForModule(targetModule: PracticeModule): PracticeUnit[] {
    if (targetModule === 'character') return [emptyCharacterUnit];
    if (targetModule === 'article') return [onlineTongueTwisterUnit.value ?? emptyArticleUnit];
    if (targetModule === 'vocabulary') return vocabularyUnits.value.length > 0 ? vocabularyUnits.value : [emptyVocabularyUnit];
    if (targetModule === 'mistake') return mistakeUnits.value.length > 0 ? mistakeUnits.value : [pendingMistakeToUnit() ?? emptyCharacterUnit];
    return [onlinePoemUnit.value ?? emptyPoemUnit];
  }

  function selectFreshUnitIndex(targetModule: PracticeModule, units: PracticeUnit[], startIndex: number) {
    if (units.length <= 1) return 0;

    const currentText = normalizeUnitText(activeUnit.value.text);
    const recentTexts = recentUnitTexts.value[targetModule] ?? [];
    const preferredIndex = findUnitIndex(units, startIndex, (unit) => {
      const text = normalizeUnitText(unit.text);
      return text !== currentText && !recentTexts.includes(text);
    });
    if (preferredIndex >= 0) return preferredIndex;

    const nonCurrentIndex = findUnitIndex(units, startIndex, (unit) => normalizeUnitText(unit.text) !== currentText);
    return nonCurrentIndex >= 0 ? nonCurrentIndex : startIndex;
  }

  function findUnitIndex(units: PracticeUnit[], startIndex: number, predicate: (unit: PracticeUnit) => boolean) {
    for (let offset = 0; offset < units.length; offset += 1) {
      const index = (startIndex + offset) % units.length;
      if (predicate(units[index])) {
        return index;
      }
    }
    return -1;
  }

  function rememberRecentUnitText(targetModule: PracticeModule, unit: PracticeUnit) {
    if (targetModule !== 'article' && targetModule !== 'poem' && targetModule !== 'vocabulary') {
      return;
    }
    const text = normalizeUnitText(unit.text);
    if (!text) {
      return;
    }
    const currentTexts = recentUnitTexts.value[targetModule] ?? [];
    recentUnitTexts.value = {
      ...recentUnitTexts.value,
      [targetModule]: [text, ...currentTexts.filter((item) => item !== text)].slice(0, RECENT_UNIT_TEXT_LIMIT),
    };
  }

  function normalizeUnitText(text: string) {
    return text.replace(/\s+/g, '');
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
      defaultModule: defaultModule.value,
      showCharacterCodes: showCharacterCodes.value,
      lastVocabularyPackageId: selectedVocabularyPackageId.value ?? undefined,
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
    if (module.value !== 'mistake') {
      return Promise.resolve();
    }
    const ids = currentMistakeGroup.value?.mistakeIds ?? [];
    if (ids.length === 0 && activeUnit.value.id.startsWith('mistake-')) {
      return markMistakeCorrect(activeUnit.value.id.replace(/^mistake-/, ''));
    }
    return Promise.all(ids.map((id) => markMistakeCorrect(id))).then(() => undefined);
  }

  async function refreshMistakeUnits() {
    const records = await listMistakesForPractice(schemeId.value);
    mistakeGroups.value = groupMistakesForPractice(records, scheme.value);
    mistakeUnits.value = mistakeGroups.value.map(mistakeGroupToPracticeUnit);
  }

  async function refreshVocabularyPackages() {
    vocabularyPackages.value = await listInstalledVocabularyPackages();
    if (vocabularyPackages.value.length === 0) {
      selectedVocabularyPackageId.value = null;
      vocabularyUnits.value = [];
      return;
    }
    if (selectedVocabularyPackageId.value === MIXED_VOCABULARY_PACKAGE_ID) {
      return;
    }
    if (!selectedVocabularyPackageId.value || !vocabularyPackages.value.some((item) => item.id === selectedVocabularyPackageId.value)) {
      selectedVocabularyPackageId.value = vocabularyPackages.value[0].id;
    }
  }

  async function refreshVocabularyUnits() {
    await refreshVocabularyPackages();
    if (!selectedVocabularyPackageId.value) {
      vocabularyUnits.value = [];
      return;
    }

    if (selectedVocabularyPackageId.value === MIXED_VOCABULARY_PACKAGE_ID) {
      const entries = (await Promise.all(vocabularyPackages.value.map((pack) => listVocabularyEntries(pack.id)))).flat();
      const packageFile = createVocabularyPackageFromEntries({
        id: MIXED_VOCABULARY_PACKAGE_ID,
        name: '混合词库',
        version: '1.0.0',
        author: 'Shuangpin Cabin',
        license: 'Personal',
        pricingType: 'owned',
        description: '全部已安装词库的混合练习。',
        tags: ['mixed', 'vocabulary'],
      }, entries);
      vocabularyUnits.value = buildVocabularyPracticeUnits(packageFile);
      return;
    }

    const packageRecord = await getInstalledVocabularyPackage(selectedVocabularyPackageId.value);
    if (!packageRecord) {
      vocabularyUnits.value = [];
      return;
    }
    const entries = await listVocabularyEntries(packageRecord.id);
    const packageFile = createVocabularyPackageFromEntries({
      id: packageRecord.id,
      name: packageRecord.name,
      version: packageRecord.version,
      author: packageRecord.author,
      license: packageRecord.license,
      pricingType: packageRecord.pricingType,
      description: packageRecord.description,
      tags: packageRecord.tags,
    }, entries);
    vocabularyUnits.value = buildVocabularyPracticeUnits(packageFile);
  }

  async function setVocabularyPackage(packageId: string) {
    hasManualPracticeSelection = true;
    preferenceHydrateSeq += 1;
    selectedVocabularyPackageId.value = packageId;
    unitIndex.value = 0;
    await refreshVocabularyUnits();
    if (module.value === 'vocabulary') {
      resetSession(unitsForModule('vocabulary')[0]);
    }
    await saveCurrentPreferences();
  }

  async function setMixedVocabularyPackage() {
    if (vocabularyPackages.value.length === 0) return;
    hasManualPracticeSelection = true;
    preferenceHydrateSeq += 1;
    selectedVocabularyPackageId.value = MIXED_VOCABULARY_PACKAGE_ID;
    unitIndex.value = 0;
    await refreshVocabularyUnits();
    if (module.value === 'vocabulary') {
      resetSession(unitsForModule('vocabulary')[0]);
    }
    await saveCurrentPreferences();
  }

  async function refreshOnlineUnit(targetModule: PracticeModule) {
    try {
      if (targetModule === 'article') {
        // First check if cached version exists from preload
        const cached = consumeCachedTongueTwisterUnit();
        if (cached) {
          onlineTongueTwisterUnit.value = cached;
        } else {
          onlineTongueTwisterUnit.value = await fetchTongueTwisterUnit();
        }
      }
      if (targetModule === 'poem') {
        // First check if cached version exists from preload
        const cached = consumeCachedPoetryUnit();
        if (cached) {
          onlinePoemUnit.value = cached;
        } else {
          onlinePoemUnit.value = await fetchPoetryUnit();
        }
      }
    } catch {
      // 内容完全依赖在线 API；失败时保留已有在线内容或空状态，等待用户重试。
    }
  }

  function startBackgroundPrefetch() {
    // Chain prefetch tasks sequentially to avoid concurrent requests
    prefetchQueue = prefetchQueue
      .then(() => {
        if (module.value === 'poem') return prefetchPoetryUnit();
        if (module.value === 'article') return prefetchTongueTwisterUnit();
        return Promise.resolve();
      })
      .then(() => {
        // After first prefetch, start second prefetch for continuous buffer
        if (module.value === 'poem') return prefetchPoetryUnit();
        if (module.value === 'article') return prefetchTongueTwisterUnit();
        return Promise.resolve();
      })
      .catch(() => {
        // Silently ignore prefetch errors
      });
  }

  async function refreshDailyQuote() {
    try {
      dailyQuote.value = await fetchDailyQuote();
    } catch {
      dailyQuote.value = emptyQuote;
    }
  }

  return {
    schemeId,
    scheme,
    module,
    defaultModule,
    showCharacterCodes,
    activeUnit,
    session,
    wrongKey,
    pendingMistake,
    mistakeGroups,
    lastStatus,
    isSwitching,
    currentCode,
    currentExpectedKey,
    activeTextIndex,
    dailyQuote,
    moduleLabel,
    keyboardActiveKey,
    currentMistakeGroup,
    vocabularyPackages,
    selectedVocabularyPackageId,
    isMixedVocabularyMode,
    vocabularyNeedsInstall,
    currentVocabularyPackage,
    mistakeGroupTitle,
    mistakeGroupDescription,
    mistakeGroupFocusKeys,
    mistakeGroupEmpty,
    awaitingOnlineContent,
    mistakeGroupProgress,
    mistakeCompletion,
    progressPercent,
    liveStats,
    pressKey,
    clearWrongKey,
    setScheme,
    setModule,
    setDefaultModule,
    setShowCharacterCodes,
    clearMistakeRecords,
    clearPracticeSessions,
    clearInstalledVocabularies,
    nextUnit,
    restartCurrent,
    closeCompletion,
    hydratePreferences,
    refreshVocabularyPackages,
    refreshVocabularyUnits,
    setVocabularyPackage,
    setMixedVocabularyPackage,
  };
});

function createEmptyUnit(module: PracticeUnit['module']): PracticeUnit {
  return {
    id: `empty-${module}`,
    module,
    text: '',
    syllables: [],
    source: '等待在线内容',
    tags: ['在线内容'],
  };
}

function createMixedVocabularyRecord(packages: VocabularyPackageRecord[]): VocabularyPackageRecord {
  const now = Date.now();
  return {
    id: MIXED_VOCABULARY_PACKAGE_ID,
    name: '混合词库',
    version: '1.0.0',
    description: '全部已安装词库的混合练习。',
    author: 'Shuangpin Cabin',
    license: 'Personal',
    pricingType: 'owned',
    tags: ['mixed', 'vocabulary'],
    entryCount: packages.reduce((sum, pack) => sum + pack.entryCount, 0),
    installedAt: Math.min(...packages.map((pack) => pack.installedAt), now),
    updatedAt: Math.max(...packages.map((pack) => pack.updatedAt), now),
    sourceUrl: 'mixed:installed-vocabularies',
    sourceType: 'local',
  };
}
