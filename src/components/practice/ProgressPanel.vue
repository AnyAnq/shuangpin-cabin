<template>
  <section class="records-panel progress-panel" aria-labelledby="progress-title">
    <div class="records-panel-head">
      <div>
        <h2 id="progress-title">看见每一天的进步</h2>
        <p>{{ mode === 'typing' ? '中文跟打 · 最近 7 天 · 仅统计全文练习，错句复练单独记录' : practice.scheme.name + ' · 最近 7 天 · 仅统计已完成的练习' }}</p>
      </div>
      <label class="daily-goal-label">每日目标
        <select :value="practice.dailyGoalMinutes" :disabled="!settingsReady || savingGoal" @change="changeGoal">
          <option v-for="minutes in goalOptions" :key="minutes" :value="minutes">{{ minutes }} 分钟</option>
        </select>
      </label>
    </div>
    <p v-if="error || goalError" role="alert">{{ error || goalError }}</p>
    <p v-if="loading" role="status">正在读取练习记录…</p>
    <template v-else-if="!error">
      <div class="daily-goal">
        <div><strong>今日 {{ (todayTotalMs / 60000).toFixed(1) }} / {{ practice.dailyGoalMinutes }} 分钟</strong><span>{{ goalPercent >= 100 ? '今日目标已完成' : '键位练习、中文跟打和错句复练共同计入每日目标' }}</span></div>
        <progress :value="goalPercent" max="100" aria-label="今日练习目标" />
      </div>
      <div class="progress-summary">
        <span><strong>{{ totalCount }}</strong> 组练习</span>
        <span><strong>{{ (totalMs / 60000).toFixed(1) }}</strong> 分钟</span>
        <span><strong>{{ activeDays }}</strong> 天有练习</span>
      </div>
      <p v-if="totalCount === 0" class="empty-state">这 7 天还没有完成记录。完成一组练习后，速度和准确率会出现在这里。</p>
      <template v-else>
        <div class="trend-charts">
          <div v-for="metric in metrics" :key="metric.key" class="trend-chart">
            <h3>{{ metric.title }}</h3>
            <div class="trend-bars" role="img" :aria-label="chartLabel(metric.key)">
              <div v-for="day in days" :key="day.date" class="trend-day">
                <span>{{ day[metric.key] === null ? '—' : day[metric.key] + metric.suffix }}</span>
                <div class="trend-track"><div v-if="day.count" class="trend-bar" :class="metric.key" :style="{ height: barHeight(day[metric.key], metric.key) + '%' }" /></div>
                <small>{{ day.label }}</small>
              </div>
            </div>
          </div>
        </div>
        <details class="progress-details">
          <summary>查看每日明细</summary>
          <div class="progress-table-scroll">
            <table>
              <caption>每日练习汇总</caption>
              <thead><tr><th scope="col">日期</th><th scope="col">组数</th><th scope="col">分钟</th><th scope="col">准确率</th><th scope="col">字 / 分钟</th></tr></thead>
              <tbody><tr v-for="day in days" :key="day.date"><th scope="row">{{ day.date }}</th><td>{{ day.count }}</td><td>{{ (day.elapsedMs / 60000).toFixed(1) }}</td><td>{{ day.accuracy === null ? '—' : day.accuracy + '%' }}</td><td>{{ day.wpm ?? '—' }}</td></tr></tbody>
            </table>
          </div>
        </details>
      </template>
      <p class="progress-note">速度和准确率为当天各组的平均值；新记录从首次按键计时，包含中途停顿，旧记录沿用原始计时。不同练习内容会影响速度。</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { weeklyProgress } from '../../domain/practice/progress';
import { listSessionsByScheme, listTypingSessions, totalPracticeTimeToday } from '../../storage/repositories';
import type { PracticeSessionRecord } from '../../storage/db';
import { usePracticeStore } from '../../stores/practiceStore';
import { useTypingStore } from '../../stores/typingStore';

const props = withDefaults(defineProps<{ mode?: 'keys' | 'typing' }>(), { mode: 'keys' });
const practice = usePracticeStore();
const typing = useTypingStore();
const now = ref(Date.now());
const clock = window.setInterval(() => { now.value = Date.now(); }, 60000);
onBeforeUnmount(() => window.clearInterval(clock));
const records = ref<Pick<PracticeSessionRecord, 'createdAt' | 'elapsedMs' | 'accuracy' | 'wpm'>[]>([]);
const todayTotalMs = ref(0);
const loading = ref(true);
const error = ref('');
const goalError = ref('');
const settingsReady = ref(false);
const savingGoal = ref(false);
let loadSeq = 0;
const days = computed(() => weeklyProgress(records.value, now.value));
const totalCount = computed(() => days.value.reduce((sum, day) => sum + day.count, 0));
const totalMs = computed(() => days.value.reduce((sum, day) => sum + day.elapsedMs, 0));
const activeDays = computed(() => days.value.filter(day => day.count > 0).length);
const goalPercent = computed(() => Math.min(100, todayTotalMs.value / (practice.dailyGoalMinutes * 600)));
const goalOptions = computed(() => [...new Set([5, 10, 15, 20, practice.dailyGoalMinutes])].sort((a, b) => a - b));
const metrics = [
  { key: 'accuracy', title: '准确率', suffix: '%' },
  { key: 'wpm', title: '输入速度 · 字 / 分钟', suffix: '' },
] as const;

function barHeight(value: number | null, metric: 'accuracy' | 'wpm') {
  const max = metric === 'accuracy' ? 100 : Math.max(1, ...days.value.map(day => day.wpm ?? 0));
  return (value ?? 0) / max * 100;
}
function chartLabel(metric: 'accuracy' | 'wpm') {
  return days.value.map(day => day.label + '：' + (day[metric] === null ? '无练习' : day[metric] + (metric === 'accuracy' ? '%' : ' 字/分钟'))).join('；');
}

watch(() => [practice.schemeId, practice.sessionRevision, typing.revision, props.mode, now.value], loadRecords, { immediate: true });
onMounted(async () => {
  try { await practice.hydrateSettings(); settingsReady.value = true; }
  catch { goalError.value = '目标设置读取失败，请刷新页面重试。'; }
});

async function loadRecords() {
  const request = ++loadSeq;
  loading.value = true;
  try {
    const [result, total] = await Promise.all([
      props.mode === 'typing'
        ? listTypingSessions().then(items => items.filter(item => item.kind === 'full').map(item => ({ ...item, wpm: item.cpm })))
        : listSessionsByScheme(practice.schemeId),
      totalPracticeTimeToday(now.value),
    ]);
    if (request === loadSeq) { records.value = result; todayTotalMs.value = total; error.value = ''; }
  } catch {
    if (request === loadSeq) error.value = '练习记录读取失败，请刷新页面重试。';
  } finally {
    if (request === loadSeq) loading.value = false;
  }
}

async function changeGoal(event: Event) {
  const previous = practice.dailyGoalMinutes;
  savingGoal.value = true;
  goalError.value = '';
  try { await practice.setDailyGoalMinutes(Number((event.target as HTMLSelectElement).value)); }
  catch { practice.dailyGoalMinutes = previous; goalError.value = '每日目标保存失败，请重试。'; }
  finally { savingGoal.value = false; }
}
</script>
