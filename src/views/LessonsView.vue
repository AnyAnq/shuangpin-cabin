<template>
  <div class="app-shell learning-shell">
    <FloatingSidebar @open-settings="settingsOpen = true" />
    <SettingsDrawer :open="settingsOpen" @close="settingsOpen = false" />
    <main class="learning-main lessons-main">
      <header class="learning-header">
        <div>
          <h1>从第一键开始</h1>
          <p>四个阶段，建立双拼输入的手感。每课准确率达到 {{ LESSON_TARGET }}% 即为达标。</p>
        </div>
        <SchemeSwitch />
      </header>
      <p class="lesson-summary" aria-live="polite">{{ practice.scheme.name }} · 已达标 {{ completedCount }} / {{ lessons.length }} 课</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="loading" role="status">正在读取课程进度…</p>
      <ol class="lesson-list" aria-label="新手分阶段课程">
        <li v-for="(lesson, index) in lessons" :key="lesson.id" :class="{ 'lesson-passed': bestAccuracy(lesson.id) >= LESSON_TARGET }" :data-testid="'lesson-' + lesson.id">
          <span class="lesson-number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
          <div class="lesson-content">
            <h2>{{ lesson.title }}</h2>
            <strong>{{ lesson.focus }}</strong>
            <p>{{ lesson.description }}</p>
            <span class="lesson-preview">{{ lesson.text }}</span>
          </div>
          <div class="lesson-action">
            <span v-if="bestAccuracy(lesson.id) >= 0">最高 {{ bestAccuracy(lesson.id) }}% · {{ bestAccuracy(lesson.id) >= LESSON_TARGET ? '已达标' : '继续巩固' }}</span>
            <span v-else>尚未练习</span>
            <button type="button" class="primary-action" :disabled="loading || practice.isSwitching" @click="start(lesson.id)">
              {{ bestAccuracy(lesson.id) >= 0 ? '再练一次' : '开始练习' }}
            </button>
          </div>
        </li>
      </ol>
      <p class="lesson-footnote">建议按顺序练习，也可以直接选择薄弱阶段。课程内容无需联网；清空练习记录会同时重置达标进度。</p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import FloatingSidebar from '../components/layout/FloatingSidebar.vue';
import SettingsDrawer from '../components/settings/SettingsDrawer.vue';
import SchemeSwitch from '../components/controls/SchemeSwitch.vue';
import { lessons, LESSON_TARGET } from '../domain/practice/lessons';
import { usePracticeStore } from '../stores/practiceStore';
import { listSessionsByScheme } from '../storage/repositories';
import type { PracticeSessionRecord } from '../storage/db';

const practice = usePracticeStore();
const router = useRouter();
const settingsOpen = ref(false);
const sessions = ref<PracticeSessionRecord[]>([]);
const error = ref('');
const loading = ref(true);
let loadSeq = 0;
const completedCount = computed(() => lessons.filter(lesson => bestAccuracy(lesson.id) >= LESSON_TARGET).length);

function bestAccuracy(id: string) {
  return sessions.value.reduce((best, record) => record.module === 'lesson' && record.lessonId === id ? Math.max(best, record.accuracy) : best, -1);
}

watch(() => [practice.schemeId, practice.sessionRevision], loadProgress, { immediate: true });
onMounted(async () => {
  try { await practice.hydrateSettings(); }
  catch { error.value = '设置读取失败，请刷新页面重试。'; }
});

async function loadProgress() {
  const request = ++loadSeq;
  loading.value = true;
  sessions.value = [];
  try {
    const records = await listSessionsByScheme(practice.schemeId);
    if (request === loadSeq) { sessions.value = records; error.value = ''; }
  } catch {
    if (request === loadSeq) error.value = '课程进度读取失败，请刷新页面重试。';
  } finally {
    if (request === loadSeq) loading.value = false;
  }
}

async function start(id: string) {
  try {
    await practice.startLesson(id);
    await router.push({ name: 'practice' });
  } catch { error.value = '课程未能开始，请重试。'; }
}
</script>
