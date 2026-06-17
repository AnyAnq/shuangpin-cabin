<template>
  <div class="code-hint" aria-label="当前编码">
    <span
      v-for="(key, index) in code"
      :key="`${key}-${index}`"
      class="code-key"
      data-code-key
      :class="{ 'is-done': index < completedCount, 'is-current': index === completedCount, 'is-hooked-l': key === 'l' }"
    >
      {{ key }}
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  code: string;
  completedCount: number;
}>();
</script>
