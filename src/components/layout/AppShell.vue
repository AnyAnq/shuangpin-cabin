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
      <PracticeStage
        :text="practice.activeUnit.text"
        :active-index="practice.activeTextIndex"
        :code="practice.currentCode"
        :completed-code-count="practice.session.cursor.codeIndex"
        :codes="practice.session.codes"
        :text-char-indices="practice.session.textCharIndices"
        :completed-char-count="practice.session.stats.completedChars"
        :wrong="practice.lastStatus === 'wrong'"
      />
      <VirtualKeyboard :scheme="practice.scheme" :active-key="practice.keyboardActiveKey" :wrong-key="practice.wrongKey" />
      <CompletionModal
        :open="practice.lastStatus === 'complete'"
        :accuracy="practice.liveStats.accuracy"
        :wpm="practice.liveStats.wpm"
        :max-combo="practice.liveStats.maxCombo"
        :busy="practice.isSwitching"
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
    />
  </div>
</template>

<script setup lang="ts">
import { usePracticeStore } from '../../stores/practiceStore';
import ModuleTabs from '../controls/ModuleTabs.vue';
import CompletionModal from '../practice/CompletionModal.vue';
import PracticeStage from '../practice/PracticeStage.vue';
import VirtualKeyboard from '../practice/VirtualKeyboard.vue';
import SchemeSwitch from '../controls/SchemeSwitch.vue';
import FloatingSidebar from './FloatingSidebar.vue';
import RightInsightPanel from './RightInsightPanel.vue';

const practice = usePracticeStore();
</script>
