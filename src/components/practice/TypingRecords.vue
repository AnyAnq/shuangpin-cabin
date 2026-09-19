<template>
  <section class="records-panel" aria-label="中文跟打记录">
    <div class="records-panel-head"><div><h2>跟打记录</h2><p>全文练习与错句复练分别标记，点击即可查看当时的报告。</p></div></div>
    <p v-if="error" role="alert">{{ error }} <button type="button" class="ghost-action" @click="load">重试</button></p>
    <p v-else-if="loading" role="status">正在读取跟打记录…</p>
    <p v-else-if="!records.length" class="empty-state">还没有跟打记录。<RouterLink :to="{ name: 'typing' }">开始第一篇</RouterLink></p>
    <ol v-else class="typing-record-list">
      <li v-for="record in records" :key="record.id">
        <div><strong>{{ record.article.title }}</strong><small>{{ formatDate(record.createdAt) }} · {{ record.kind === 'review' ? '错句复练' : '全文练习' }}</small></div>
        <span>{{ record.cpm }} 字/分钟 · {{ record.accuracy }}%</span>
        <button type="button" class="ghost-action" @click="open(record)">查看报告</button>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import type { TypingReport } from '../../domain/practice/typing';
import { listTypingSessions } from '../../storage/repositories';
import { usePracticeStore } from '../../stores/practiceStore';
import { useTypingStore } from '../../stores/typingStore';

const router = useRouter();
const practice = usePracticeStore();
const typing = useTypingStore();
const records = ref<TypingReport[]>([]);
const loading = ref(true);
const error = ref('');
let loadSeq = 0;
async function load() {
  const request = ++loadSeq;
  loading.value = true;
  error.value = '';
  try {
    const result = await listTypingSessions();
    if (request === loadSeq) records.value = result;
  } catch { if (request === loadSeq) error.value = '跟打记录读取失败，请重试。'; }
  finally { if (request === loadSeq) loading.value = false; }
}
function open(record: TypingReport) { typing.showReport(record); void router.push({ name: 'typing' }); }
function formatDate(timestamp: number) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(timestamp); }
watch(() => [typing.revision, practice.sessionRevision], load, { immediate: true });
</script>
