<template>
  <div ref="container" class="typing-reference" role="region" tabindex="0" :class="{ 'is-report': complete }" :aria-label="complete ? '全文差异对照' : '跟打原文'">
    <p v-for="(paragraph, p) in paragraphs" :key="p">
      <template v-for="glyph in paragraph" :key="glyph.index">
        <ins v-if="extras.get(glyph.index)" class="typing-extra" :title="'多打：' + extras.get(glyph.index)">{{ complete ? '+' + extras.get(glyph.index) : '+' }}</ins>
        <span
          :class="['typing-glyph', operations.get(glyph.index)?.kind, { 'is-current': !complete && glyph.index === alignment.consumed }]"
          :data-current="!complete && glyph.index === alignment.consumed ? '' : undefined"
          :title="description(glyph.index)"
        >{{ glyph.char }}<small v-if="complete && operations.get(glyph.index)?.kind === 'replace'">→{{ operations.get(glyph.index)?.actual }}</small></span>
      </template>
    </p>
    <ins v-if="extras.get(length)" class="typing-extra" :title="'多打：' + extras.get(length)">{{ complete ? '+' + extras.get(length) : '+' }}</ins>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { splitCharacters, type TextAlignment } from '../../domain/practice/typing';

const props = defineProps<{ text: string; alignment: TextAlignment; complete?: boolean; follow?: boolean }>();
const container = ref<HTMLElement | null>(null);
const paragraphs = computed(() => {
  let index = 0;
  return props.text.normalize('NFC').replace(/\r\n?/g, '\n').split('\n').filter(line => line.trim()).map(line =>
    splitCharacters(line.trim()).map(char => ({ char, index: index++ })),
  );
});
const length = computed(() => paragraphs.value.reduce((n, p) => n + p.length, 0));
const operations = computed(() => new Map(props.alignment.operations.filter(op => op.kind !== 'insert').map(op => [op.index, op])));
const extras = computed(() => {
  const map = new Map<number, string>();
  for (const op of props.alignment.operations) if (op.kind === 'insert') map.set(op.index, (map.get(op.index) ?? '') + op.actual);
  return map;
});
function description(index: number) {
  const operation = operations.value.get(index);
  if (operation?.kind === 'replace') return `应为“${operation.expected}”，输入了“${operation.actual}”`;
  if (operation?.kind === 'delete') return `漏字：${operation.expected}`;
  return undefined;
}
watch(() => props.alignment.consumed, async () => {
  if (!props.follow || props.complete) return;
  await nextTick();
  const box = container.value;
  const current = box?.querySelector<HTMLElement>('[data-current]');
  if (!box || !current) return;
  const top = current.offsetTop;
  if (top < box.scrollTop || top + current.offsetHeight > box.scrollTop + box.clientHeight) {
    box.scrollTop = Math.max(0, top - box.clientHeight / 2);
  }
});
</script>
