<template>
  <section class="practice-stage">
    <p class="target-line" :class="{ 'is-wrong': wrong }">
      <span v-for="line in lines" :key="line.index" class="poem-line" data-poem-line>
        <span
          v-for="(char, index) in line.chars"
          :key="`${char}-${line.start + index}`"
          :class="{ 'is-active': line.start + index === activeIndex, 'is-complete': line.start + index < activeIndex }"
        >
          {{ char }}
        </span>
      </span>
    </p>
    <CodeHint :code="code" :completed-count="completedCodeCount" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CodeHint from './CodeHint.vue';

const props = defineProps<{
  text: string;
  activeIndex: number;
  code: string;
  completedCodeCount: number;
  wrong: boolean;
}>();

const lines = computed(() => {
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
</script>
