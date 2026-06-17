import { expect, test } from '@playwright/test';

test('侧边栏保留核心入口并可在记录和练习间切换', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: '键位对照' })).toHaveCount(0);

  await page.getByRole('link', { name: '记录' }).click();
  await expect(page).toHaveURL(/\/records$/);
  await expect(page.getByRole('heading', { name: '纠错教练' })).toBeVisible();
  await expect(page.getByRole('link', { name: '记录' })).toHaveClass(/is-active/);

  await page.getByRole('link', { name: '练习' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('今日练习 · 诗词句子')).toBeVisible();
});

test('/keymap 会回到练习页', async ({ page }) => {
  await page.goto('/keymap');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('今日练习 · 诗词句子')).toBeVisible();
});
