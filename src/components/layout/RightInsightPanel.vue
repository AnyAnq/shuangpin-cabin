<template>
  <aside class="right-panel">
    <p class="panel-title">实时统计</p>
    <section class="stat-card"><strong>{{ accuracy }}%</strong><span>准确率</span></section>
    <section class="stat-card"><strong>{{ formattedElapsed }}</strong><span>用时</span></section>
    <section class="stat-card"><strong>{{ maxCombo }}</strong><span>最大连击</span></section>
    <section class="stat-card"><strong>{{ wpm }}</strong><span>WPM</span></section>
    <p class="panel-title">当前方案</p>
    <section class="stat-card"><strong>{{ schemeName }}</strong><span>声母 + 韵母键位提示随输入高亮</span></section>
    <section class="quote-card">
      <span>每日一言</span>
      <strong>心有猛虎，细嗅蔷薇。</strong>
      <em>- 萨松</em>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  accuracy: number;
  elapsedMs: number;
  maxCombo: number;
  wpm: number;
  schemeName: string;
}>();

const formattedElapsed = computed(() => {
  const seconds = Math.floor(props.elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
});
</script>
