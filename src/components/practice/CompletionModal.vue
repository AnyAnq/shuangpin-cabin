<template>
  <div v-if="open" class="completion-modal" role="dialog" aria-modal="true">
    <section>
      <button type="button" class="completion-close" aria-label="关闭完成弹窗" @click="$emit('close')">
        <X :size="16" stroke-width="2.4" />
      </button>
      <p>本轮完成</p>
      <strong>{{ accuracy }}%</strong>
      <span>准确率</span>
      <div class="completion-stats">
        <span>WPM {{ wpm }}</span>
        <span>最大连击 {{ maxCombo }}</span>
      </div>
      <div class="completion-actions">
        <button type="button" :disabled="busy" @click="$emit('restart')">重练本组</button>
        <button type="button" :disabled="busy" class="is-primary" @click="$emit('next')">
          {{ busy ? '取题中...' : '下一组' }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { X } from '@lucide/vue';

withDefaults(defineProps<{
  open: boolean;
  accuracy: number;
  wpm: number;
  maxCombo: number;
  busy: boolean;
}>(), {
  busy: false,
});

defineEmits<{
  restart: [];
  next: [];
  close: [];
}>();
</script>
