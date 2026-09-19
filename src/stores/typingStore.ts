import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import {
  alignTypingText, createTypingReport, differenceRanges, mergeRanges, normalizeTypingText, validateTypingArticle,
  type TextAlignment, type TextRange, type TypingArticle, type TypingKind, type TypingReport,
} from '../domain/practice/typing';
import { saveTypingSession } from '../storage/repositories';

export const useTypingStore = defineStore('typing', () => {
  const article = ref<TypingArticle | null>(null);
  const kind = ref<TypingKind>('full');
  const inputText = ref('');
  const startedAt = ref<number | null>(null);
  const composing = ref(false);
  const alignment = shallowRef<TextAlignment | null>(null);
  const observedRanges = shallowRef<TextRange[]>([]);
  const report = shallowRef<TypingReport | null>(null);
  const saving = ref(false);
  const saveError = ref('');
  const revision = ref(0);
  const unfinished = computed(() => startedAt.value !== null && !report.value);
  const needsLeaveWarning = computed(() => unfinished.value || !!saveError.value || saving.value);

  function start(next: TypingArticle, nextKind: TypingKind = 'full') {
    validateTypingArticle(next);
    article.value = { ...next };
    kind.value = nextKind;
    inputText.value = '';
    startedAt.value = null;
    composing.value = false;
    report.value = null;
    saveError.value = '';
    observedRanges.value = [];
    alignment.value = alignTypingText(next.text, '', true);
  }

  function markStarted(now = Date.now()) {
    if (article.value && !report.value && startedAt.value === null) startedAt.value = now;
  }

  function commitText(value: string, now = Date.now()) {
    if (!article.value || report.value || composing.value || inputText.value === value) return;
    markStarted(now);
    inputText.value = value;
    alignment.value = alignTypingText(article.value.text, value, true);
    observedRanges.value = mergeRanges([...observedRanges.value, ...differenceRanges(article.value.text, alignment.value)]);
  }

  async function persistReport() {
    if (!report.value || saving.value) return;
    const current = report.value;
    saving.value = true;
    saveError.value = '';
    try {
      await saveTypingSession(current);
      revision.value++;
    } catch {
      saveError.value = '本轮报告尚未保存，请保留此页并重试。';
    } finally {
      saving.value = false;
    }
  }

  async function finish(now = Date.now()) {
    if (!article.value || report.value || composing.value || startedAt.value === null || !normalizeTypingText(inputText.value)) return;
    report.value = createTypingReport({
      article: article.value, inputText: inputText.value, kind: kind.value,
      elapsedMs: now - startedAt.value, observedRanges: observedRanges.value, now,
    });
    await persistReport();
  }

  function showReport(saved: TypingReport) {
    article.value = { ...saved.article };
    kind.value = saved.kind;
    inputText.value = saved.inputText;
    report.value = saved;
    startedAt.value = null;
    composing.value = false;
    saveError.value = '';
  }

  function prepare() {
    article.value = null;
    report.value = null;
    inputText.value = '';
    startedAt.value = null;
    composing.value = false;
    saveError.value = '';
  }

  return {
    article, kind, inputText, startedAt, composing, alignment, report, saving, saveError, revision,
    unfinished, needsLeaveWarning, start, markStarted, commitText, finish, persistReport, showReport, prepare,
  };
});
