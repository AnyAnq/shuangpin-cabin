import { expect, test } from '@playwright/test';
import { lessons } from '../src/domain/practice/lessons';
import { xiaoheScheme } from '../src/domain/schemes/xiaohe';

test('新手课程完成、进阶、刷新恢复与方案隔离', async ({ page }) => {
  await page.goto('/lessons');
  await expect(page.getByRole('heading', { name: '从第一键开始' })).toBeVisible();
  await page.getByTestId('lesson-initials').getByRole('button', { name: '开始练习' }).click();
  await expect(page.getByLabel('本课指引')).toContainText('声母起步');
  await page.getByRole('button', { name: '小鹤双拼', exact: true }).click();
  await page.keyboard.type(lessons[0].syllables.split(' ').map(xiaoheScheme.encodeSyllable).join(''), { delay: 15 });
  await expect(page.getByRole('dialog')).toContainText('本课已达标');
  await expect(page.getByRole('button', { name: '下一阶段', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '关闭完成弹窗' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('本课指引')).toContainText('韵母定位');
  await page.getByRole('link', { name: '课程目录' }).click();
  await page.reload();
  await expect(page.getByTestId('lesson-initials')).toContainText('最高 100% · 已达标');
  await page.getByRole('button', { name: '自然码', exact: true }).click();
  await expect(page.getByTestId('lesson-initials')).toContainText('尚未练习');
});

test('完成课程后显示真实趋势，目标持久化，清空记录会刷新趋势', async ({ page }) => {
  await page.goto('/lessons');
  await page.getByTestId('lesson-initials').getByRole('button', { name: '开始练习' }).click();
  await page.keyboard.type(lessons[0].syllables.split(' ').map(xiaoheScheme.encodeSyllable).join(''), { delay: 15 });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '关闭完成弹窗' }).click();
  await page.getByRole('link', { name: '记录', exact: true }).click();
  await expect(page.locator('.progress-summary')).toContainText('1 组练习');
  await expect(page.locator('.trend-chart').first()).toContainText('100%');
  await page.getByRole('combobox', { name: '每日目标' }).selectOption('15');
  await page.reload();
  await expect(page.getByRole('combobox', { name: '每日目标' })).toHaveValue('15');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '清空练习记录' }).click();
  await expect(page.locator('.progress-summary')).toContainText('0 组练习');
});

test('课程和趋势页在窄屏可浏览，课程可离线开始', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lessons');
  await expect(page.getByTestId('lesson-initials').getByRole('button')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.setOffline(true);
  await page.getByTestId('lesson-initials').getByRole('button').click();
  await expect(page.getByLabel('本课指引')).toContainText('声母起步');
  await context.setOffline(false);
  await page.getByRole('link', { name: '记录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '看见每一天的进步' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('词句课程按容器续排，标点跟在前一个字后面', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1240 });
  await page.goto('/lessons');
  await page.getByTestId('lesson-sentences').getByRole('button', { name: '开始练习' }).click();
  const lines = page.locator('[data-poem-line]');
  await expect(lines).toHaveCount(1);
  expect(await lines.evaluateAll(rows => rows.map(row => [...row.querySelectorAll('.target-glyph')].map(glyph => glyph.textContent).join(''))))
    .toEqual(['每天练习双拼，让输入更轻松。']);
  const glyphs = await page.locator('.target-glyph').evaluateAll(items => items.map(item => item.getBoundingClientRect().top));
  expect(new Set(glyphs).size).toBe(1);
  expect(glyphs[6]).toBe(glyphs[5]);
  expect(glyphs[13]).toBe(glyphs[12]);
  await page.keyboard.type(lessons[3].syllables.split(' ').slice(0, 6).map(xiaoheScheme.encodeSyllable).join(''));
  await expect(page.locator('.target-char.is-active .target-glyph')).toHaveText('让');
});
