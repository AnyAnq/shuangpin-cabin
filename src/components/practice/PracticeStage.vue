<template>
  <section class="practice-stage">
    <p class="target-line" :class="{ 'is-wrong': wrong }">
      <span v-for="line in lines" :key="line.index" class="poem-line" data-poem-line>
        <span
          v-for="(char, index) in line.chars"
          :key="`${char}-${line.start + index}`"
          class="target-char"
          :class="{ 'is-active': line.start + index === activeIndex, 'is-complete': line.start + index < activeIndex }"
        >
          <span class="target-glyph">{{ char }}</span>
          <span
            v-if="showCharacterCodes && codeForTextIndex(line.start + index)"
            class="char-code"
            :class="{ 'is-complete': isCodeComplete(line.start + index), 'is-active': line.start + index === activeIndex }"
            :data-char-code="line.start + index"
            :aria-label="codeForTextIndex(line.start + index) ?? undefined"
          >
            <span
              v-for="(key, keyIndex) in codeKeysForTextIndex(line.start + index)"
              :key="`${key}-${line.start + index}-${keyIndex}`"
              class="char-code-key"
              :class="{
                'is-done': isCodeKeyDone(line.start + index, keyIndex),
                'is-current': isCodeKeyCurrent(line.start + index, keyIndex),
              }"
              data-char-code-key
            >
              {{ key }}
            </span>
          </span>
        </span>
      </span>
    </p>
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
  lineCharCount?: number;
  showCharacterCodes?: boolean;
}>(), {
  showCharacterCodes: true,
});

const showCharacterCodes = computed(() => props.showCharacterCodes);

const lines = computed(() => {
  if (props.lineCharCount && props.lineCharCount > 0) {
    const chars = Array.from(props.text);
    const result = [];
    for (let start = 0; start < chars.length; start += props.lineCharCount) {
      result.push({ index: result.length, start, chars: chars.slice(start, start + props.lineCharCount) });
    }
    return result;
  }
  const breakIndex = props.text.search(/[，,]/);
  const rawLines = breakIndex === -1 ? [props.text] : [props.text.slice(0, breakIndex + 1), props.text.slice(breakIndex + 1)];
  let start = 0;
  return rawLines.map((line, index) => {
    const chars = Array.from(line);
    const result = { index, start, chars };
    start += chars.length;
    return result;
  });
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
