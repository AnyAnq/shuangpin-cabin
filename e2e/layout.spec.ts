import { expect, test } from '@playwright/test';

test('编码提示和键盘整体下移', async ({ page }) => {
  await page.goto('/');

  const hintMarginTop = await page.locator('.code-hint').evaluate((element) => {
    return Number.parseFloat(window.getComputedStyle(element).marginTop);
  });

  expect(hintMarginTop).toBeGreaterThanOrEqual(260);
});
