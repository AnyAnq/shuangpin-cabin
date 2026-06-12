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
      <PracticeStage text="多情却被无情恼，今夜还如昨夜长。" :active-index="0" code="do" :completed-code-count="1" :wrong="false" />
      <VirtualKeyboard :scheme="xiaoheScheme" active-key="d" :wrong-key="null" />
    </main>
    <RightInsightPanel />
  </div>
</template>

<script setup lang="ts">
import { xiaoheScheme } from '../../domain/schemes/xiaohe';
import ModuleTabs from '../controls/ModuleTabs.vue';
import PracticeStage from '../practice/PracticeStage.vue';
import VirtualKeyboard from '../practice/VirtualKeyboard.vue';
import SchemeSwitch from '../controls/SchemeSwitch.vue';
import FloatingSidebar from './FloatingSidebar.vue';
import RightInsightPanel from './RightInsightPanel.vue';
</script>
