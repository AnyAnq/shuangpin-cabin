<template>
  <section class="practice-stage">
    <div class="stage-caret">↓</div>
    <p class="target-line" :class="{ 'is-wrong': wrong }">
      <span
        v-for="(char, index) in chars"
        :key="`${char}-${index}`"
        :class="{ 'is-active': index === activeIndex, 'is-complete': index < activeIndex }"
      >
        {{ char }}
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

const chars = computed(() => Array.from(props.text));
</script>
