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
    </main>
    <RightInsightPanel />
  </div>
</template>

<script setup lang="ts">
import ModuleTabs from '../controls/ModuleTabs.vue';
import SchemeSwitch from '../controls/SchemeSwitch.vue';
import FloatingSidebar from './FloatingSidebar.vue';
import RightInsightPanel from './RightInsightPanel.vue';
</script>
