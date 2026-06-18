<template>
  <div class="rail-shell">
    <aside class="floating-rail" data-testid="floating-sidebar">
      <div class="brand-mark">拼</div>
      <nav class="rail-nav" aria-label="主导航">
        <RouterLink
          v-for="item in enabledNavItems"
          :key="item.routeName"
          class="rail-item"
          :class="{ 'is-active': route.name === item.routeName }"
          :to="{ name: item.routeName }"
          :title="item.title"
          :aria-label="item.label"
        >
          <component :is="item.icon" />
        </RouterLink>
        <span
          v-for="item in disabledNavItems"
          :key="item.label"
          class="rail-item is-disabled"
          :title="item.title"
          :aria-label="item.label"
          aria-disabled="true"
          role="link"
        >
          <component :is="item.icon" />
        </span>
      </nav>
      <button class="rail-item rail-bottom" type="button" title="设置" aria-label="设置" @click="$emit('open-settings')">
        <Settings />
      </button>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import { ChartColumn, LibraryBig, NotebookText, Settings } from '@lucide/vue';
import type { Component } from 'vue';

defineEmits<{
  (event: 'open-settings'): void;
}>();

const route = useRoute();

const enabledNavItems = [
  { label: '练习', title: '练习', routeName: 'practice', icon: NotebookText },
  { label: '记录', title: '记录', routeName: 'records', icon: ChartColumn },
  { label: '词库', title: '词库', routeName: 'vocabularies', icon: LibraryBig },
] as const;

const disabledNavItems: Array<{ label: string; title: string; icon: Component }> = [];
</script>
