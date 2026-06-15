import { expect, test } from '@playwright/test';

test('按错键不会推进当前字', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  await expect(page.getByText('多情却被无情恼')).toBeVisible();
  await page.keyboard.press('S');

  await expect(page.locator('.target-line .is-active')).toHaveText('多');
  await expect(page.locator('[data-key="s"]')).toHaveClass(/is-wrong/);
});

test('可以切换练习模块并换一组', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  await page.getByRole('button', { name: '绕口令' }).click();
  await expect(page.getByText('四是四，十是十')).toBeVisible();

  await page.getByRole('button', { name: '诗词句子' }).click();
  await page.getByRole('button', { name: '换一组' }).click();
  await expect(page.getByText('多情却被无情恼')).toBeVisible();
});

test('刷新后默认回到诗词句子', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  await page.getByRole('button', { name: '易错练习' }).click();
  await expect(page.getByText('今日练习 · 易错练习')).toBeVisible();

  await page.reload();
  await expect(page.getByText('今日练习 · 诗词句子')).toBeVisible();
});

test('取题中会禁用模块切换，避免快速乱点', async ({ page }) => {
  await mockContentApi(page, { tongueTwisterDelayMs: 600 });
  await page.goto('/');

  await page.getByRole('button', { name: '绕口令' }).click();

  await expect(page.getByRole('status')).toContainText('取题中...');
  await expect(page.getByRole('button', { name: '诗词句子' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '易错练习' })).toBeDisabled();

  const loadingBox = await page.getByRole('status').boundingBox();
  const mainBox = await page.locator('.practice-main').boundingBox();
  expect(loadingBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  const loadingCenterX = loadingBox!.x + loadingBox!.width / 2;
  const loadingCenterY = loadingBox!.y + loadingBox!.height / 2;
  const mainCenterX = mainBox!.x + mainBox!.width / 2;
  const mainCenterY = mainBox!.y + mainBox!.height / 2;
  expect(Math.abs(loadingCenterX - mainCenterX)).toBeLessThan(20);
  expect(Math.abs(loadingCenterY - mainCenterY)).toBeLessThan(20);

  await expect(page.getByText('今日练习 · 绕口令')).toBeVisible();
  await expect(page.getByText('四是四，十是十')).toBeVisible();
});

async function mockContentApi(page: import('@playwright/test').Page, options: { tongueTwisterDelayMs?: number } = {}) {
  await page.route('**/external-api/chicken-soup', async (route) => {
    await route.fulfill({
      json: { code: 200, msg: '请求成功', data: { content: '知不足而奋进，望远山而前行。' } },
    });
  });
  await page.route('**/external-api/tongue-twister', async (route) => {
    if (options.tongueTwisterDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.tongueTwisterDelayMs));
    }
    await route.fulfill({
      json: { code: 200, msg: '请求成功', data: '四是四，十是十。十四是十四，四十是四十。' },
    });
  });
  await page.route('**/external-api/diary-poetry', async (route) => {
    await route.fulfill({
      json: {
        code: 200,
        msg: '请求成功',
        data: {
          content: '行到水穷处坐看云起时',
          origin: '终南别业',
          author: '王维',
          category: '古诗文-山水',
        },
      },
    });
  });
}
