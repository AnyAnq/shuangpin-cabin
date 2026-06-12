import { expect, test } from '@playwright/test';

test('按错键不会推进当前字', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('多情却被无情恼')).toBeVisible();
  await page.keyboard.press('S');

  await expect(page.locator('.target-line .is-active')).toHaveText('多');
  await expect(page.locator('[data-key="s"]')).toHaveClass(/is-wrong/);
});
