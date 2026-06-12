<template>
  <div class="app-shell">
    <FloatingSidebar />
    <main class="practice-main">
      <div class="practice-topbar">
        <ModuleTabs />
        <SchemeSwitch />
      </div>
      <section class="session-strip">
        <div>
          <p>今日练习 · 诗词句子 · 第 3 组</p>
          <div class="session-progress"><span /></div>
        </div>
        <button type="button" class="soft-pill">换一组</button>
      </section>
      <PracticeStage
        :text="practice.activeUnit.text"
        :active-index="practice.session.cursor.charIndex"
        :code="practice.currentCode"
        :completed-code-count="practice.session.cursor.codeIndex"
        :wrong="practice.lastStatus === 'wrong'"
      />
      <VirtualKeyboard :scheme="practice.scheme" :active-key="practice.currentExpectedKey" :wrong-key="practice.wrongKey" />
      <CompletionModal :open="practice.lastStatus === 'complete'" :accuracy="practice.liveStats.accuracy" />
    </main>
    <RightInsightPanel
      :accuracy="practice.liveStats.accuracy"
      :elapsed-ms="practice.liveStats.elapsedMs"
      :max-combo="practice.liveStats.maxCombo"
      :wpm="practice.liveStats.wpm"
      :scheme-name="practice.scheme.name"
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
