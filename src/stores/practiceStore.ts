import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { DailyQuote } from '../content/quotes';
import type { MistakePracticeGroup, MistakeRecord } from '../domain/practice/mistakes';
import { groupMistakesForPractice, mistakeGroupToPracticeUnit } from '../domain/practice/mistakes';
import { createSession, getActiveTextIndex, handlePracticeKey } from '../domain/practice/sessionEngine';
import { lessons, lessonUnit, LESSON_TARGET } from '../domain/practice/lessons';
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
  listInstalledVocabularyPackages,
  listVocabularyEntries,
  clearVocabularyPackages,
} from '../storage/vocabularyRepository';
import type { PreferenceRecord, VocabularyPackageRecord } from '../storage/db';
import {
  fetchDailyQuote,
  fetchPoetryUnit,
  fetchTongueTwisterUnit,
  consumeCachedPoetryUnit,
  consumeCachedTongueTwisterUnit,
  ensureContentCache,
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
  const dailyGoalMinutes = ref(10);
  const lessonId = ref<string>(lessons[0].id);
  const currentLesson = computed(() => module.value === 'lesson' ? lessons.find(item => item.id === lessonId.value) ?? null : null);
  const sessionRevision = ref(0);
  const sessionSaveError = ref('');
  const contentLoadError = ref('');
  const lessonPassed = computed(() => !!currentLesson.value && liveStats.value.accuracy >= LESSON_TARGET);
  const nextLesson = computed(() => lessons[lessons.findIndex(item => item.id === lessonId.value) + 1]);
  const nextLabel = computed(() => currentLesson.value
    ? lessonPassed.value && nextLesson.value ? '下一阶段' : '再练本课'
    : '下一组');
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
  let selectionSeq = 0;
  let hasManualPracticeSelection = false;

  const currentCode = computed(() => session.value.codes[session.value.cursor.charIndex] ?? '');
  const currentExpectedKey = computed(() => currentCode.value[session.value.cursor.codeIndex] ?? null);
  const activeTextIndex = computed(() => getActiveTextIndex(session.value));
  const moduleLabel = computed(() => {
    if (module.value === 'lesson') return '新手课程';
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
    if (isSwitching.value || session.value.cursor.charIndex >= session.value.codes.length) {
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
    if (result.status === 'wrong' && result.expectedKey && result.actualKey && result.errorType) {
      const record = createMistakeRecord(result.expectedKey, result.actualKey, result.errorType);
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
    hasManualPracticeSelection = true;
    schemeId.value = next;
    resetSession(activeUnit.value);
    if (isSwitching.value || module.value === 'mistake') {
      void selectPractice(module.value);
    } else {
      void saveCurrentPreferences();
    }
  }

  function setModule(next: PracticeModule) {
    return selectPractice(next);
  }

  async function selectPractice(
    next: PracticeModule,
    options: { restorePreferences?: boolean; packageId?: string; advance?: boolean; lessonId?: string } = {},
  ) {
    if (!options.restorePreferences) hasManualPracticeSelection = true;
    const requestSeq = ++selectionSeq;
    isSwitching.value = true;
    contentLoadError.value = '';
    try {
      if (options.restorePreferences) {
        const preference = await loadPreferences();
        if (requestSeq !== selectionSeq) return;
        if (preference) applyPreferences(preference);
        next = defaultModule.value === 'character' ? 'poem' : defaultModule.value;
      }

      if (options.lessonId) lessonId.value = options.lessonId;
      if (!options.advance) {
        module.value = next;
        unitIndex.value = 0;
        resetSession(unitsForModule(next)[0], false);
      }
      if (options.packageId !== undefined) selectedVocabularyPackageId.value = options.packageId;
      const quote = options.restorePreferences ? refreshDailyQuote() : Promise.resolve();
      let packages = vocabularyPackages.value;
      let packageId = options.packageId ?? selectedVocabularyPackageId.value;
      if (next === 'vocabulary' || options.restorePreferences) {
        packages = await listInstalledVocabularyPackages();
        if (requestSeq !== selectionSeq) return;
        if (packages.length === 0) {
          packageId = null;
        } else if (packageId !== MIXED_VOCABULARY_PACKAGE_ID && !packages.some(pack => pack.id === packageId)) {
          packageId = packages[0].id;
        }
        vocabularyPackages.value = packages;
        selectedVocabularyPackageId.value = packageId;
      }

      let nextVocabularyUnits = vocabularyUnits.value;
      let groups = mistakeGroups.value;
      let onlineUnit: PracticeUnit | null = null;
      if (next === 'vocabulary') {
        nextVocabularyUnits = await loadVocabularyUnits(packageId, packages);
      } else if (next === 'mistake') {
        const selectedScheme = scheme.value;
        groups = groupMistakesForPractice(await listMistakesForPractice(selectedScheme.id), selectedScheme);
      } else if (next !== 'lesson') {
        try {
          onlineUnit = await loadOnlineUnit(next, !options.restorePreferences);
        } catch {
          if (requestSeq === selectionSeq) contentLoadError.value = '新内容暂时加载失败，请稍后点击“换一组”重试。';
          return;
        }
      }
      await quote;

      // 只有最新选择可以提交异步结果，包括题目来源与会话。
      if (requestSeq !== selectionSeq) return;
      if (next === 'vocabulary') vocabularyUnits.value = nextVocabularyUnits;
      if (next === 'mistake') {
        mistakeGroups.value = groups;
        mistakeUnits.value = groups.map(mistakeGroupToPracticeUnit);
      }
      if (next === 'poem') onlinePoemUnit.value = onlineUnit;
      if (next === 'article') onlineTongueTwisterUnit.value = onlineUnit;
      const units = unitsForModule(next);
      const startIndex = options.advance ? (unitIndex.value + 1) % units.length : 0;
      unitIndex.value = selectFreshUnitIndex(next, units, startIndex);
      resetSession(units[unitIndex.value]);
      startBackgroundPrefetch(next);
      if (!options.restorePreferences && !options.advance) await saveCurrentPreferences();
    } finally {
      if (requestSeq === selectionSeq) isSwitching.value = false;
    }
  }

  function applyPreferences(preference: PreferenceRecord) {
    schemeId.value = preference.scheme;
    selectedVocabularyPackageId.value = preference.lastVocabularyPackageId ?? null;
    defaultModule.value = preference.defaultModule ?? 'poem';
    showCharacterCodes.value = preference.showCharacterCodes ?? true;
    dailyGoalMinutes.value = preference.dailyGoalMinutes ?? 10;
  }

  async function hydrateSettings() {
    if (hasManualPracticeSelection) return;
    const requestSeq = selectionSeq;
    const preference = await loadPreferences();
    if (preference && !hasManualPracticeSelection && requestSeq === selectionSeq) applyPreferences(preference);
  }

  async function setDailyGoalMinutes(minutes: number) {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) throw new Error('每日目标应为 1 至 60 分钟');
    hasManualPracticeSelection = true;
    dailyGoalMinutes.value = minutes;
    await saveCurrentPreferences();
  }

  function startLesson(id: string) {
    lessonUnit(id);
    return selectPractice('lesson', { lessonId: id });
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
    if (module.value === 'mistake') await setModule('mistake');
  }

  async function clearPracticeSessions() {
    await clearSessions();
    sessionRevision.value += 1;
  }

  async function clearInstalledVocabularies() {
    await clearVocabularyPackages();
    if (module.value === 'vocabulary') {
      await setModule('vocabulary');
    } else {
      await refreshVocabularyPackages();
    }
  }

  function nextUnit() {
    if (isSwitching.value) return Promise.resolve();
    if (currentLesson.value) {
      const id = lastStatus.value === 'complete' && lessonPassed.value && nextLesson.value ? nextLesson.value.id : lessonId.value;
      closeCompletion();
      return startLesson(id);
    }
    closeCompletion();
    return selectPractice(module.value, { advance: true });
  }

  function restartCurrent() {
    resetSession(activeUnit.value);
  }

  function closeCompletion() {
    if (lastStatus.value === 'complete') {
      lastStatus.value = 'ignored';
    }
  }

  function hydratePreferences() {
    if (hasManualPracticeSelection) return Promise.resolve();
    return selectPractice(defaultModule.value, { restorePreferences: true });
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
    if (targetModule === 'lesson') return [lessonUnit(lessonId.value)];
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

  function createMistakeRecord(expectedKey: string, actualKey: string, errorType: MistakeRecord['errorType']): MistakeRecord {
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
      errorType,
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
      dailyGoalMinutes: dailyGoalMinutes.value,
      lastVocabularyPackageId: selectedVocabularyPackageId.value ?? undefined,
      updatedAt: Date.now(),
    });
  }

  function saveCurrentSession() {
    sessionSaveError.value = '';
    return saveSession({
      id: `${Date.now()}-${activeUnit.value.id}-${schemeId.value}`,
      scheme: schemeId.value,
      module: module.value,
      lessonId: module.value === 'lesson' ? lessonId.value : undefined,
      accuracy: liveStats.value.accuracy,
      wpm: liveStats.value.wpm,
      maxCombo: liveStats.value.maxCombo,
      elapsedMs: liveStats.value.elapsedMs,
      createdAt: Date.now(),
    }).then(() => { sessionRevision.value += 1; }).catch(() => {
      sessionSaveError.value = '本轮记录保存失败，请检查浏览器存储空间后重练。';
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

  async function refreshVocabularyPackages() {
    const requestSeq = selectionSeq;
    const packages = await listInstalledVocabularyPackages();
    if (requestSeq !== selectionSeq) return;
    vocabularyPackages.value = packages;
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

  async function loadVocabularyUnits(packageId: string | null, packages: VocabularyPackageRecord[]) {
    if (!packageId || packages.length === 0) return [];
    const mixed = packageId === MIXED_VOCABULARY_PACKAGE_ID;
    const record = mixed ? createMixedVocabularyRecord(packages) : packages.find(pack => pack.id === packageId);
    if (!record) return [];
    const entries = mixed
      ? (await Promise.all(packages.map(pack => listVocabularyEntries(pack.id)))).flat()
      : await listVocabularyEntries(record.id);
    return buildVocabularyPracticeUnits(createVocabularyPackageFromEntries(record, entries));
  }

  function setVocabularyPackage(packageId: string) {
    return selectPractice('vocabulary', { packageId });
  }

  function setMixedVocabularyPackage() {
    if (vocabularyPackages.value.length === 0) return Promise.resolve();
    return setVocabularyPackage(MIXED_VOCABULARY_PACKAGE_ID);
  }

  async function loadOnlineUnit(targetModule: PracticeModule, useCache: boolean): Promise<PracticeUnit | null> {
    if (targetModule === 'article') {
      return (useCache ? consumeCachedTongueTwisterUnit() : null) ?? await fetchTongueTwisterUnit();
    }
    if (targetModule === 'poem') {
      return (useCache ? consumeCachedPoetryUnit() : null) ?? await fetchPoetryUnit();
    }
    return null;
  }

  function startBackgroundPrefetch(targetModule: PracticeModule) {
    const excludedTexts = getPrefetchExcludedTexts(targetModule);
    prefetchQueue = prefetchQueue
      .then(() => {
        if (targetModule === 'poem') return ensureContentCache('poem', 3, excludedTexts);
        if (targetModule === 'article') return ensureContentCache('article', 3, excludedTexts);
        return Promise.resolve();
      })
      .catch(() => {
        // Silently ignore prefetch errors
      });
  }

  function getPrefetchExcludedTexts(targetModule: PracticeModule) {
    if (targetModule !== 'poem' && targetModule !== 'article') {
      return [];
    }
    const currentTexts = unitsForModule(targetModule).map((unit) => unit.text);
    const recentTexts = recentUnitTexts.value[targetModule] ?? [];
    return [...currentTexts, ...recentTexts];
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
    dailyGoalMinutes,
    currentLesson,
    lessonPassed,
    nextLesson,
    nextLabel,
    sessionRevision,
    sessionSaveError,
    contentLoadError,
    startLesson,
    hydrateSettings,
    setDailyGoalMinutes,
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
    tags: ['mixed', 'vocabulary'],
    entryCount: packages.reduce((sum, pack) => sum + pack.entryCount, 0),
    installedAt: Math.min(...packages.map((pack) => pack.installedAt), now),
    updatedAt: Math.max(...packages.map((pack) => pack.updatedAt), now),
    sourceUrl: 'mixed:installed-vocabularies',
    sourceType: 'local',
  };
}
