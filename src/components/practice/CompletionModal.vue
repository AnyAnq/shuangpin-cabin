<template>
  <div v-if="open" ref="dialog" class="completion-modal" role="dialog" aria-modal="true" aria-label="练习完成">
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
      <div v-if="hasMistakeResult" class="completion-stats completion-mistakes">
        <span>本组复练 {{ practicedCount }}</span>
        <span>连续正确 +{{ streakGain }}</span>
      </div>
      <p v-if="message" class="completion-message">{{ message }}</p>
      <div class="completion-actions">
        <button type="button" :disabled="busy" @click="$emit('restart')">重练本组</button>
        <button ref="nextButton" type="button" :disabled="busy" class="is-primary" @click="$emit('next')">
          {{ busy ? '取题中...' : nextLabel }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { X } from '@lucide/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  open: boolean;
  nextLabel?: string;
  message?: string;
  accuracy: number;
  wpm: number;
  maxCombo: number;
  busy: boolean;
  practicedCount?: number | null;
  streakGain?: number | null;
}>(), {
  busy: false,
  nextLabel: '下一组',
  message: '',
  practicedCount: null,
  streakGain: null,
});

const emit = defineEmits<{
  restart: [];
  next: [];
  close: [];
}>();

const dialog = ref<HTMLElement | null>(null);
const nextButton = ref<HTMLButtonElement | null>(null);
let previousFocus: HTMLElement | null = null;
watch(() => props.open, async open => {
  if (open) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    if (props.open) nextButton.value?.focus();
  } else if (previousFocus?.isConnected) {
    previousFocus.focus();
  }
}, { immediate: true });

const hasMistakeResult = computed(() => typeof props.practicedCount === 'number' && typeof props.streakGain === 'number');

function handleWindowKeydown(event: KeyboardEvent) {
  if (!props.open || event.defaultPrevented) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
    return;
  }
  if (event.key === 'Tab') {
    const buttons = dialog.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    const target = event.shiftKey ? buttons?.[buttons.length - 1] : buttons?.[0];
    const boundary = event.shiftKey ? buttons?.[0] : buttons?.[buttons.length - 1];
    if (target && document.activeElement === boundary) { event.preventDefault(); target.focus(); }
    return;
  }
  if (props.busy) return;
  if (event.target instanceof HTMLElement && event.target.closest('button, a, input, select, textarea, [contenteditable="true"]')) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  emit('next');
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown);
});
</script>
