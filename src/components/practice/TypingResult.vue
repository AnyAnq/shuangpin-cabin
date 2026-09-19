<template>
  <section class="typing-result" aria-label="跟打报告">
    <div class="typing-heading">
      <div><h1>本次跟打报告</h1><p>{{ report.article.title }} · {{ report.kind === 'review' ? '错句复练' : '全文练习' }}</p></div>
      <RouterLink :to="{ name: 'records', query: { mode: 'typing' } }">查看跟打记录</RouterLink>
    </div>
    <dl class="typing-metrics">
      <div><dt>有效字速</dt><dd>{{ report.cpm }}<small> 字/分钟</small></dd></div>
      <div><dt>交卷准确率</dt><dd>{{ report.accuracy }}<small>%</small></dd></div>
      <div><dt>用时</dt><dd>{{ duration }}</dd></div>
    </dl>
    <p class="typing-evaluation">{{ evaluation }}</p>
    <p v-if="previous" class="typing-previous">与上次同文练习相比：字速 {{ signed(report.cpm - previous.cpm) }} 字/分钟，准确率 {{ signed(Number((report.accuracy - previous.accuracy).toFixed(1))) }} 个百分点。</p>
    <div class="typing-counts" role="group" aria-label="错误统计">
      <span>正确 {{ report.matched }}</span><span>错字 {{ report.substitutions }}</span><span>漏字 {{ report.omissions }}</span><span>多字 {{ report.insertions }}</span>
    </div>
    <p class="typing-note">有效字速＝正确字符数 ÷ 用时（分钟）；准确率＝正确字符数 ÷（原文字符数＋多字数）。标点、数字和英文也计数，忽略排版换行和行首尾空白。下划线标错字，删除线标漏字，＋标多字。</p>
    <TypingComparison :text="report.article.text" :alignment="alignment" complete />
    <details class="typing-submitted"><summary>查看交卷文本</summary><p>{{ report.inputText }}</p></details>
    <section v-if="report.reviewTexts.length" class="typing-review" aria-label="本次错句">
      <h2>下一轮，练这几句</h2>
      <p>优先保留交卷时仍有错误的句子，也包含过程中曾出错、后来改好的句子。</p>
      <ul><li v-for="(text, index) in report.reviewTexts" :key="index">{{ text }}</li></ul>
    </section>
    <p v-if="saveError" role="alert">{{ saveError }} <button type="button" class="ghost-action" :disabled="busy" @click="$emit('retry')">重试保存</button></p>
    <p v-else-if="busy" role="status">正在保存本轮报告…</p>
    <div class="typing-actions">
      <button v-if="report.reviewTexts.length" type="button" class="primary-action" :disabled="busy" @click="$emit('review')">复练本次错句</button>
      <button type="button" class="ghost-action" :disabled="busy" @click="$emit('restart')">{{ report.kind === 'review' ? '重练本组' : '重练全文' }}</button>
      <button type="button" :class="report.reviewTexts.length ? 'ghost-action' : 'primary-action'" :disabled="busy" @click="$emit('change')">换一篇</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { alignTypingText, normalizeTypingText, type TypingReport } from '../../domain/practice/typing';
import { listTypingSessions } from '../../storage/repositories';
import TypingComparison from './TypingComparison.vue';

const props = defineProps<{ report: TypingReport; busy: boolean; saveError: string }>();
defineEmits<{ restart: []; review: []; change: []; retry: [] }>();
const previous = ref<TypingReport | null>(null);
const alignment = computed(() => alignTypingText(props.report.article.text, props.report.inputText));
const duration = computed(() => {
  const seconds = Math.floor(props.report.elapsedMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
});
const evaluation = computed(() => {
  const r = props.report;
  if (r.substitutions + r.omissions + r.insertions) return '这次先把标记的句子练顺，再回到全文保持连续输入。错误已经记录，不必为纠正一个字反复重来。';
  return r.reviewTexts.length ? '交卷文本全部正确。过程中有几句曾出现差异，可以短练一次，减少下次回改的时间。' : '交卷文本全部正确。可以换一篇继续练，或重练全文，比较自己的输入节奏。';
});
function signed(value: number) { return (value > 0 ? '+' : '') + value; }
watch(() => props.report.id, async id => {
  previous.value = null;
  if (props.report.kind !== 'full') return;
  try {
    const records = await listTypingSessions();
    if (props.report.id !== id) return;
    previous.value = records.find(record => record.id !== id && record.kind === 'full' && record.createdAt <= props.report.createdAt && normalizeTypingText(record.article.text) === normalizeTypingText(props.report.article.text)) ?? null;
  } catch { /* The current report remains usable when history cannot be read. */ }
}, { immediate: true });
</script>
