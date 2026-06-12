<template>
  <div v-if="open" class="completion-modal" role="dialog" aria-modal="true">
    <section>
      <p>本轮完成</p>
      <strong>{{ accuracy }}%</strong>
      <span>准确率</span>
      <div class="completion-stats">
        <span>WPM {{ wpm }}</span>
        <span>最大连击 {{ maxCombo }}</span>
      </div>
      <div class="completion-actions">
        <button type="button" @click="$emit('restart')">重练本组</button>
        <button type="button" @click="$emit('next')">下一组</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean;
  accuracy: number;
  wpm: number;
  maxCombo: number;
}>();

defineEmits<{
  restart: [];
  next: [];
}>();
</script>
