<template>
  <div class="rail-shell">
    <aside class="floating-rail" data-testid="floating-sidebar">
      <div class="brand-mark">拼</div>
      <nav class="rail-nav" aria-label="主导航">
        <button class="rail-item is-active" type="button" title="练习"><NotebookText /></button>
        <button class="rail-item" type="button" title="课程"><BookOpen /></button>
        <button class="rail-item" type="button" title="键位对照"><Keyboard /></button>
        <button class="rail-item" type="button" title="记录"><ChartColumn /></button>
      </nav>
      <button class="rail-item rail-bottom" type="button" title="设置"><Settings /></button>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { BookOpen, ChartColumn, Keyboard, NotebookText, Settings } from '@lucide/vue';
</script>
