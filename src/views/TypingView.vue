<template>
  <div class="app-shell learning-shell">
    <FloatingSidebar @open-settings="settingsOpen = true" />
    <SettingsDrawer :open="settingsOpen" @close="settingsOpen = false" />
    <main ref="main" class="learning-main typing-main" tabindex="-1">
      <TypingResult v-if="typing.report" :report="typing.report" :busy="typing.saving" :save-error="typing.saveError" @restart="restart" @review="review" @change="prepare" @retry="typing.persistReport" />
      <template v-else>
        <header class="typing-heading">
          <div><h1>提速练习</h1><p>用熟悉的输入法，打完整篇再看报告。</p></div>
          <RouterLink :to="{ name: 'records', query: { mode: 'typing' } }">跟打记录</RouterLink>
        </header>
        <section v-if="!typing.article" class="typing-setup">
          <label for="typing-source">练习内容</label>
          <select id="typing-source" v-model="source" @change="setupError = ''">
            <option v-for="article in typingArticles" :key="article.id" :value="article.id">{{ article.title }}</option>
            <option value="custom">粘贴自己的文章</option>
          </select>
          <template v-if="source === 'custom'">
            <label for="typing-custom">自定义原文</label>
            <textarea id="typing-custom" v-model="customText" rows="10" placeholder="在这里粘贴练习内容，推荐每轮 300～600 字。" />
          </template>
          <p v-else class="typing-preview">{{ selectedArticle.text }}</p>
          <div class="typing-setup-bottom">
            <p>{{ selectedLength }} / {{ MAX_TYPING_CHARS }} 字 · 标点、数字和英文也参与练习</p>
            <button type="button" class="primary-action" @click="begin">开始跟打</button>
          </div>
          <p v-if="setupError" role="alert">{{ setupError }}</p>
          <p class="typing-note">保留中文输入法，可使用自己的简码、辅助码和选词习惯。练习内容与记录只保存在当前浏览器。</p>
        </section>
        <section v-else class="typing-workspace" aria-label="中文跟打">
          <div class="typing-toolbar">
            <div><h2>{{ typing.article.title }}</h2><small>{{ typing.kind === 'review' ? '错句复练' : '全文练习' }} · {{ progress }}%</small></div>
            <div class="typing-live-stats"><span>用时 {{ elapsedLabel }}</span><span>{{ liveCpm }} 字/分钟</span></div>
            <button type="button" class="ghost-action" @click="prepare">更换文章</button>
          </div>
          <progress :value="progress" max="100" aria-label="跟打进度" />
          <TypingComparison v-if="typing.alignment" :text="typing.article.text" :alignment="typing.alignment" :follow="followCursor" />
          <label for="typing-input">在这里输入</label>
          <textarea
            id="typing-input" ref="input" data-testid="typing-input" rows="5" spellcheck="false" autocomplete="off"
            aria-describedby="typing-help" placeholder="保持中文输入法，按自己的习惯输入。"
            @beforeinput="beforeInput" @input="onInput" @compositionstart="compositionStart" @compositionend="compositionEnd"
            @paste.prevent="blockedPaste" @drop.prevent="blockedPaste"
          />
          <div class="typing-footer">
            <p id="typing-help">{{ typing.composing ? '正在选词，确认后可交卷。' : '错字会轻量标记，可以继续输入或自行修改。打完后手动交卷。' }}</p>
            <button type="button" class="primary-action" :disabled="typing.composing || !typing.inputText.trim()" @click="typing.finish()">完成并评测</button>
          </div>
          <p v-if="inputNotice" class="typing-note" role="status">{{ inputNotice }}</p>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, RouterLink } from 'vue-router';
import FloatingSidebar from '../components/layout/FloatingSidebar.vue';
import SettingsDrawer from '../components/settings/SettingsDrawer.vue';
import TypingComparison from '../components/practice/TypingComparison.vue';
import TypingResult from '../components/practice/TypingResult.vue';
import { typingArticles } from '../content/typingArticles';
import { MAX_TYPING_CHARS, typingCharacters, type TypingArticle, type TypingKind } from '../domain/practice/typing';
import { useTypingStore } from '../stores/typingStore';

const typing = useTypingStore();
const settingsOpen = ref(false);
const source = ref(typingArticles[0].id);
const customText = ref('');
const setupError = ref('');
const inputNotice = ref('');
const input = ref<HTMLTextAreaElement | null>(null);
const main = ref<HTMLElement | null>(null);
const followCursor = ref(true);
const now = ref(Date.now());
const clock = window.setInterval(() => { now.value = Date.now(); }, 250);
const selectedArticle = computed<TypingArticle>(() => source.value === 'custom'
  ? { id: 'custom', title: '自定义文章', text: customText.value }
  : typingArticles.find(article => article.id === source.value) ?? typingArticles[0]);
const selectedLength = computed(() => typingCharacters(selectedArticle.value.text).length);
const targetLength = computed(() => typingCharacters(typing.article?.text ?? '').length);
const progress = computed(() => targetLength.value ? Math.round((typing.alignment?.consumed ?? 0) / targetLength.value * 100) : 0);
const elapsedMs = computed(() => typing.startedAt === null ? 0 : Math.max(0, now.value - typing.startedAt));
const elapsedLabel = computed(() => `${Math.floor(elapsedMs.value / 60000)}:${String(Math.floor(elapsedMs.value / 1000) % 60).padStart(2, '0')}`);
const liveCpm = computed(() => elapsedMs.value ? Math.round((typing.alignment?.matched ?? 0) / (elapsedMs.value / 60000)) : 0);

function allowChange() {
  return !typing.needsLeaveWarning || window.confirm(typing.saveError ? '本轮报告尚未保存，确定离开吗？' : '本轮练习尚未结束，确定放弃本轮吗？');
}
async function startArticle(article: TypingArticle, kind: TypingKind = 'full') {
  if (!allowChange()) return;
  try {
    typing.start(article, kind);
    setupError.value = '';
    inputNotice.value = '';
    followCursor.value = true;
    await nextTick();
    if (input.value) { input.value.value = ''; input.value.focus(); }
  } catch (error) { setupError.value = (error as Error).message; }
}
function begin() { return startArticle(selectedArticle.value); }
function prepare() { if (allowChange()) typing.prepare(); }
function restart() { if (typing.article) void startArticle(typing.article, typing.kind); }
function review() {
  const report = typing.report;
  if (report?.reviewTexts.length) void startArticle({ id: 'review-' + report.id, title: report.article.title + ' · 错句', text: report.reviewTexts.join('\n') }, 'review');
}
function blockedPaste() { inputNotice.value = '跟打区请直接输入；准备文章时可以使用粘贴。'; }
function beforeInput(event: InputEvent) {
  if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop') { event.preventDefault(); blockedPaste(); return; }
  typing.markStarted();
}
function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  followCursor.value = target.selectionStart === target.value.length;
  if (!typing.composing && !(event as InputEvent).isComposing) typing.commitText(target.value);
}
function compositionStart() { typing.composing = true; typing.markStarted(); }
function compositionEnd(event: CompositionEvent) {
  typing.composing = false;
  onInput(event);
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (typing.needsLeaveWarning) { event.preventDefault(); event.returnValue = ''; }
}
onBeforeRouteLeave(() => {
  if (!allowChange()) return false;
  if (typing.unfinished) typing.prepare();
});
watch(() => typing.report?.id, async id => {
  if (id) { await nextTick(); main.value?.focus(); }
});
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload);
  // The textarea is deliberately uncontrolled while typing so renders cannot interrupt IME composition.
  if (input.value) input.value.value = typing.inputText;
});
onBeforeUnmount(() => { window.clearInterval(clock); window.removeEventListener('beforeunload', beforeUnload); });
</script>
