<template>
  <div class="app-shell">
    <FloatingSidebar />
    <main class="practice-main">
      <div class="practice-topbar">
        <ModuleTabs />
        <SchemeSwitch />
      </div>
      <div v-if="practice.isSwitching" class="practice-loading" role="status" aria-live="polite">
        <div class="practice-loading-card">
          <span />
          取题中...
        </div>
      </div>
      <section class="session-strip">
        <div>
          <p>今日练习 · {{ practice.moduleLabel }} · {{ practice.activeUnit.source ?? practice.activeUnit.tags[0] }}</p>
          <div class="session-progress"><span :style="{ width: `${practice.progressPercent}%` }" /></div>
        </div>
        <button type="button" class="soft-pill" :disabled="practice.isSwitching" @click="practice.nextUnit">
          {{ practice.isSwitching ? '取题中...' : '换一组' }}
        </button>
      </section>
      <section v-if="practice.vocabularyNeedsInstall" class="vocabulary-empty-state">
        <span>词库练习</span>
        <h1>还没有安装词库</h1>
        <p>安装你想练的词库，把练习内容换成真正常用、常错、常输入的场景词。</p>
        <div class="vocabulary-benefits" aria-label="词库练习优势">
          <div>
            <strong>按场景定制</strong>
            <small>日常交流、工作学习、易混音专项，各练各的重点。</small>
          </div>
          <div>
            <strong>12 字连续练</strong>
            <small>常用词汇练习，一组一结算，不打断手感。</small>
          </div>
          <div>
            <strong>练习更稳定</strong>
            <small>词库安装到浏览器缓存，练习时不反复请求词库源。</small>
          </div>
        </div>
        <div class="vocabulary-empty-actions">
          <RouterLink class="primary-action" :to="{ name: 'vocabularies' }">安装词库</RouterLink>
          <button type="button" class="ghost-action" @click="practice.setModule('poem')">先练诗词句子</button>
        </div>
      </section>
      <template v-else>
        <div v-if="practice.module === 'vocabulary' && practice.vocabularyPackages.length > 0" class="vocabulary-picker" aria-label="已安装词库">
          <button
            v-for="pack in practice.vocabularyPackages"
            :key="pack.id"
            type="button"
            :class="{ 'is-active': pack.id === practice.selectedVocabularyPackageId }"
            :disabled="practice.isSwitching"
            @click="practice.setVocabularyPackage(pack.id)"
          >
            {{ pack.name }}
          </button>
          <RouterLink :to="{ name: 'vocabularies' }">管理</RouterLink>
        </div>
        <PracticeStage
          :text="practice.activeUnit.text"
          :active-index="practice.activeTextIndex"
          :code="practice.currentCode"
          :completed-code-count="practice.session.cursor.codeIndex"
          :codes="practice.session.codes"
          :text-char-indices="practice.session.textCharIndices"
          :completed-char-count="practice.session.stats.completedChars"
          :line-char-count="practice.activeUnit.lineCharCount"
          :wrong="practice.lastStatus === 'wrong'"
        />
        <VirtualKeyboard :scheme="practice.scheme" :active-key="practice.keyboardActiveKey" :wrong-key="practice.wrongKey" />
      </template>
      <CompletionModal
        :open="practice.lastStatus === 'complete'"
        :accuracy="practice.liveStats.accuracy"
        :wpm="practice.liveStats.wpm"
        :max-combo="practice.liveStats.maxCombo"
        :busy="practice.isSwitching"
        :practiced-count="practice.module === 'mistake' && !practice.mistakeGroupEmpty ? practice.mistakeCompletion.practiced : null"
        :streak-gain="practice.module === 'mistake' && !practice.mistakeGroupEmpty ? practice.mistakeCompletion.streakGain : null"
        @restart="practice.restartCurrent"
        @next="practice.nextUnit"
        @close="practice.closeCompletion"
      />
    </main>
    <RightInsightPanel
      :accuracy="practice.liveStats.accuracy"
      :elapsed-ms="practice.liveStats.elapsedMs"
      :max-combo="practice.liveStats.maxCombo"
      :wpm="practice.liveStats.wpm"
      :scheme-name="practice.scheme.name"
      :quote="practice.dailyQuote"
      :mistake-mode="practice.module === 'mistake'"
      :mistake-title="practice.mistakeGroupTitle"
      :mistake-description="practice.mistakeGroupDescription"
      :mistake-focus-keys="practice.mistakeGroupFocusKeys"
      :mistake-completed="practice.mistakeGroupProgress.completed"
      :mistake-total="practice.mistakeGroupProgress.total"
      :mistake-target="practice.currentMistakeGroup?.target"
    />
  </div>
</template>

<script setup lang="ts">
import { usePracticeStore } from '../../stores/practiceStore';
import { RouterLink } from 'vue-router';
import ModuleTabs from '../controls/ModuleTabs.vue';
import CompletionModal from '../practice/CompletionModal.vue';
import PracticeStage from '../practice/PracticeStage.vue';
import VirtualKeyboard from '../practice/VirtualKeyboard.vue';
import SchemeSwitch from '../controls/SchemeSwitch.vue';
import FloatingSidebar from './FloatingSidebar.vue';
import RightInsightPanel from './RightInsightPanel.vue';

const practice = usePracticeStore();
</script>
