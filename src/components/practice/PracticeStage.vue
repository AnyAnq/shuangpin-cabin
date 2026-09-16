<template>
  <section class="practice-stage">
    <div class="practice-copy">
      <header v-if="title || author" class="practice-heading">
        <h1 v-if="title" class="practice-title">《{{ title.replace(/\s*·\s*/g, ' · ') }}》</h1>
        <span v-if="author" class="practice-author">{{ author }}</span>
      </header>
      <div class="target-line" :class="{ 'is-wrong': wrong }">
        <div v-for="(line, lineIndex) in lines" :key="lineIndex" class="poem-line" data-poem-line>
          <span v-for="(clause, clauseIndex) in line" :key="clauseIndex" class="practice-clause">
            <span v-for="group in clause" :key="group[0]!.index" class="text-group">
              <span
                v-for="glyph in group"
                :key="glyph.index"
                class="target-char"
                :class="{
                  'target-punctuation': !glyph.isHan,
                  'is-active': glyph.index === activeIndex,
                  'is-complete': glyph.index < activeIndex,
                }"
                :data-text-index="glyph.index"
              >
                <span class="target-glyph">{{ glyph.char }}</span>
                <span
                  v-if="showCharacterCodes && codeForTextIndex(glyph.index)"
                  class="char-code"
                  :class="{ 'is-complete': isCodeComplete(glyph.index), 'is-active': glyph.index === activeIndex }"
                  :data-char-code="glyph.index"
                  :aria-label="codeForTextIndex(glyph.index) ?? undefined"
                >
                  <span
                    v-for="(key, keyIndex) in codeKeysForTextIndex(glyph.index)"
                    :key="keyIndex"
                    class="char-code-key"
                    :class="{
                      'is-done': isCodeKeyDone(glyph.index, keyIndex),
                      'is-current': isCodeKeyCurrent(glyph.index, keyIndex),
                    }"
                    data-char-code-key
                  >{{ key }}</span>
                </span>
              </span>
            </span>
          </span>
        </div>
      </div>
    </div>
    <CodeHint :code="code" :completed-count="completedCodeCount" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CodeHint from './CodeHint.vue';

const props = withDefaults(defineProps<{
  text: string;
  activeIndex: number;
  code: string;
  completedCodeCount: number;
  wrong: boolean;
  codes?: string[];
  textCharIndices?: number[];
  completedCharCount?: number;
  title?: string;
  author?: string;
  showCharacterCodes?: boolean;
}>(), {
  showCharacterCodes: true,
});

const showCharacterCodes = computed(() => props.showCharacterCodes);

interface TextGlyph {
  char: string;
  index: number;
  isHan: boolean;
}

const OPENING_PUNCTUATION = /^[（(【\[《〈「『“‘{｛]$/u;
const TRAILING_PUNCTUATION = /^[，,。.!！?？;；:：、…—）)】\]》〉」』”’}｝]$/u;

const lines = computed(() => {
  const groups: TextGlyph[][] = [];
  // Keep original code-point indices so visual wrapping never changes the input cursor.
  Array.from(props.text).forEach((char, index) => {
    const glyph = { char, index, isHan: /\p{Script=Han}/u.test(char) };
    const previous = groups.at(-1);
    const lastChar = previous?.at(-1)?.char ?? '';
    if (previous && !/[\r\n]/.test(char + lastChar)
      && (TRAILING_PUNCTUATION.test(char) || OPENING_PUNCTUATION.test(lastChar))) {
      previous.push(glyph);
    } else {
      groups.push([glyph]);
    }
  });

  const result: TextGlyph[][][][] = [];
  let line: TextGlyph[][][] = [];
  let clause: TextGlyph[][] = [];
  const finishClause = () => {
    if (clause.length) line.push(clause);
    clause = [];
  };
  const finishLine = () => {
    finishClause();
    if (line.length) result.push(line);
    line = [];
  };

  for (const group of groups) {
    const text = group.map(glyph => glyph.char).join('');
    if (/[\r\n]/.test(text)) {
      finishLine();
      continue;
    }
    clause.push(group);
    if (/[。！？!?]/.test(text)) finishLine();
    else if (/[，,；;、：:]/.test(text)) finishClause();
  }
  finishLine();
  return result;
});

function codeForTextIndex(textIndex: number): string | null {
  const practiceIndex = props.textCharIndices?.indexOf(textIndex) ?? -1;
  if (practiceIndex < 0) return null;
  return props.codes?.[practiceIndex]?.split('').join(' ') ?? null;
}

function codeKeysForTextIndex(textIndex: number): string[] {
  const practiceIndex = props.textCharIndices?.indexOf(textIndex) ?? -1;
  if (practiceIndex < 0) return [];
  return props.codes?.[practiceIndex]?.split('') ?? [];
}

function isCodeComplete(textIndex: number): boolean {
  const practiceIndex = props.textCharIndices?.indexOf(textIndex) ?? -1;
  return practiceIndex >= 0 && practiceIndex < (props.completedCharCount ?? 0);
}

function isCodeKeyDone(textIndex: number, keyIndex: number): boolean {
  const practiceIndex = props.textCharIndices?.indexOf(textIndex) ?? -1;
  if (practiceIndex < 0) return false;
  if (practiceIndex < (props.completedCharCount ?? 0)) return true;
  return textIndex === props.activeIndex && keyIndex < props.completedCodeCount;
}

function isCodeKeyCurrent(textIndex: number, keyIndex: number): boolean {
  if (textIndex !== props.activeIndex) return false;
  return keyIndex === props.completedCodeCount;
}
</script>
