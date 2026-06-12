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

test('快速切换模块时旧请求不会覆盖当前诗词内容', async ({ page }) => {
  await mockContentApi(page, { tongueTwisterDelayMs: 600 });
  await page.goto('/');

  await page.getByRole('button', { name: '绕口令' }).click();
  await page.getByRole('button', { name: '诗词句子' }).click();

  await expect(page.getByText('今日练习 · 诗词句子')).toBeVisible();
  await expect(page.getByText('行到水穷处坐看云起时')).toBeVisible();
  await expect(page.getByText('四是四，十是十')).toBeHidden();
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
