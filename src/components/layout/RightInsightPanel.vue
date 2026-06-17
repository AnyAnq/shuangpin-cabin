<template>
  <aside class="right-panel">
    <p class="panel-title">实时统计</p>
    <section class="stat-card"><strong>{{ accuracy }}%</strong><span>准确率</span></section>
    <section class="stat-card"><strong>{{ formattedElapsed }}</strong><span>用时</span></section>
    <section class="stat-card"><strong>{{ maxCombo }}</strong><span>最大连击</span></section>
    <section class="stat-card"><strong>{{ wpm }}</strong><span>WPM</span></section>
    <template v-if="mistakeMode">
      <p class="panel-title">错因复练</p>
      <section class="stat-card mistake-card">
        <strong>{{ mistakeTitle }}</strong>
        <span>{{ mistakeDescription }}</span>
        <span>重点键 {{ focusKeyText }}</span>
        <span>{{ mistakeCompleted }}/{{ mistakeTotal }} · {{ mistakeTarget }}</span>
      </section>
    </template>
    <template v-else>
      <p class="panel-title">当前方案</p>
      <section class="stat-card"><strong>{{ schemeName }}</strong><span>声母 + 韵母键位提示随输入高亮</span></section>
    </template>
    <section class="quote-card">
      <span>某日一言</span>
      <strong>{{ quote.text }}</strong>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DailyQuote } from '../../content/quotes';

const props = defineProps<{
  accuracy: number;
  elapsedMs: number;
  maxCombo: number;
  wpm: number;
  schemeName: string;
  quote: DailyQuote;
  mistakeMode?: boolean;
  mistakeTitle?: string;
  mistakeDescription?: string;
  mistakeFocusKeys?: string[];
  mistakeCompleted?: number;
  mistakeTotal?: number;
  mistakeTarget?: string;
}>();

const formattedElapsed = computed(() => {
  const seconds = Math.floor(props.elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
});

const focusKeyText = computed(() => {
  if (!props.mistakeFocusKeys || props.mistakeFocusKeys.length === 0) return '待积累';
  return props.mistakeFocusKeys.map((key) => key.toUpperCase()).join(' / ');
});
</script>
