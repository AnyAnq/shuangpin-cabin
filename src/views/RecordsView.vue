<template>
  <div class="app-shell learning-shell">
    <FloatingSidebar />
    <main class="learning-main">
      <section class="learning-header">
        <div>
          <p class="panel-title">错因复盘</p>
          <h1>纠错教练</h1>
          <p>{{ review.activeCount > 0 ? `先修 ${review.primaryReason}，重点盯住 ${review.primaryFocusKey} 键。` : '先完成一组练习，我会把错因整理成复练路线。' }}</p>
        </div>
        <div class="coach-metrics" aria-label="复盘摘要">
          <span><strong>{{ review.activeCount }}</strong> 待修正</span>
          <span><strong>{{ review.primaryFocusKey }}</strong> 重点键</span>
          <div class="records-scheme-switch" aria-label="复盘方案切换">
            <button
              type="button"
              :class="{ 'is-active': practice.schemeId === 'xiaohe' }"
              data-testid="records-scheme-xiaohe"
              @click="practice.setScheme('xiaohe')"
            >
              小鹤双拼
            </button>
            <button
              type="button"
              :class="{ 'is-active': practice.schemeId === 'ziranma' }"
              data-testid="records-scheme-ziranma"
              @click="practice.setScheme('ziranma')"
            >
              自然码
            </button>
          </div>
        </div>
      </section>

      <section v-if="review.topGroup" class="coach-card">
        <div>
          <span class="coach-kicker">今天先修这个</span>
          <h2>{{ review.topGroup.title }}</h2>
          <p>{{ review.topGroup.description }}</p>
          <div class="coach-focus">
            <span>重点键 {{ review.topGroup.focusKeys.map((key) => key.toUpperCase()).join(' / ') }}</span>
            <span>{{ review.topGroup.total }} 个字</span>
            <span>{{ review.topGroup.riskLabel }}</span>
          </div>
        </div>
        <div class="coach-target">
          <strong>{{ review.topGroup.chars }}</strong>
          <span>{{ review.topGroup.target }}</span>
          <button type="button" data-testid="start-mistake-practice" @click="startReviewPractice">开始易错复练</button>
        </div>
      </section>

      <section v-else class="coach-card coach-empty">
        <div>
          <span class="coach-kicker">复盘路线</span>
          <h2>还没有可复盘的错题</h2>
          <p>先完成诗词句子或绕口令练习，按错的键会自动沉淀到这里。</p>
        </div>
        <div class="coach-target">
          <strong>0</strong>
          <span>当前方案错题</span>
          <button type="button" data-testid="start-mistake-practice" @click="startReviewPractice">开始练习</button>
        </div>
      </section>

      <section v-if="review.distributions.length > 0" class="records-panel">
        <div class="records-panel-head">
          <div>
            <p class="panel-title">错因分布</p>
            <h2>错误肌肉记忆集中在哪里</h2>
          </div>
        </div>
        <div class="records-grid">
          <article v-for="item in review.distributions" :key="item.type" class="reason-card">
            <span>{{ item.riskLabel }}</span>
            <strong>{{ item.title }}</strong>
            <p>重点键 {{ item.focusKeys.join(' / ') }}</p>
            <em>{{ item.count }} 个错题</em>
          </article>
        </div>
      </section>

      <section class="records-panel">
        <div class="records-panel-head">
          <div>
            <p class="panel-title">错题明细</p>
            <h2>{{ review.totalCount }} 个当前方案错题</h2>
          </div>
          <span>{{ review.activeCount }} 个仍需复练</span>
        </div>
        <div v-if="review.details.length > 0" class="mistake-list">
          <article v-for="mistake in review.details" :key="mistake.id" class="mistake-row" :class="{ 'is-graduated': mistake.graduated }">
            <div>
              <strong>{{ mistake.char }}</strong>
              <span>{{ mistake.reasonLabel }} · {{ mistake.expectedCode }}</span>
            </div>
            <div class="mistake-meta">
              <span>{{ mistake.keyPath }}</span>
              <span>{{ mistake.count }} 次</span>
              <span>连续正确 {{ mistake.correctStreak }}</span>
              <span v-if="mistake.graduated">已降权</span>
              <span>{{ formatDate(mistake.lastWrongAt) }}</span>
            </div>
          </article>
        </div>
        <p v-else class="empty-state">完成练习后会自动生成错题复盘。</p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import FloatingSidebar from '../components/layout/FloatingSidebar.vue';
import type { MistakeRecord } from '../domain/practice/mistakes';
import { buildMistakeReview } from '../domain/practice/mistakeReview';
import { usePracticeStore } from '../stores/practiceStore';
import { listMistakesByScheme } from '../storage/repositories';

const practice = usePracticeStore();
const router = useRouter();
const mistakes = ref<MistakeRecord[]>([]);
const review = computed(() => buildMistakeReview(mistakes.value, practice.scheme));

onMounted(loadMistakes);
watch(() => practice.schemeId, loadMistakes);

async function loadMistakes() {
  mistakes.value = await listMistakesByScheme(practice.schemeId);
}

async function startReviewPractice() {
  await practice.setModule(review.value.topGroup ? 'mistake' : 'poem');
  await router.push({ name: 'practice' });
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}
</script>
