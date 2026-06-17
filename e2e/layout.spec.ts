import { expect, test } from '@playwright/test';

test('编码提示和键盘整体下移', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  const hintMarginTop = await page.locator('.code-hint').evaluate((element) => {
    return Number.parseFloat(window.getComputedStyle(element).marginTop);
  });

  expect(hintMarginTop).toBeGreaterThanOrEqual(260);
});

test('当前编码提示显示为键盘高亮键帽', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  const currentKey = page.locator('.code-key.is-current');
  await expect(currentKey).toBeVisible();

  const styles = await currentKey.evaluate((element) => {
    const computed = window.getComputedStyle(element);
    return {
      backgroundColor: computed.backgroundColor,
      borderRadius: Number.parseFloat(computed.borderRadius),
      boxShadow: computed.boxShadow,
      color: computed.color,
    };
  });

  expect(styles.backgroundColor).toBe('rgb(47, 148, 97)');
  expect(styles.color).toBe('rgb(255, 255, 255)');
  expect(styles.borderRadius).toBeGreaterThanOrEqual(10);
  expect(styles.boxShadow).toContain('rgb(30, 104, 67)');
});

test('汉字下方的双拼指导显示为迷你键帽', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  const firstGuideKey = page.locator('[data-char-code="0"] [data-char-code-key]').first();
  await expect(firstGuideKey).toBeVisible();

  const styles = await firstGuideKey.evaluate((element) => {
    const computed = window.getComputedStyle(element);
    return {
      backgroundColor: computed.backgroundColor,
      borderRadius: Number.parseFloat(computed.borderRadius),
      boxShadow: computed.boxShadow,
      display: computed.display,
      height: element.getBoundingClientRect().height,
      width: element.getBoundingClientRect().width,
    };
  });

  expect(styles.display).toBe('grid');
  expect(styles.backgroundColor).toBe('rgb(47, 148, 97)');
  expect(styles.borderRadius).toBeGreaterThanOrEqual(4);
  expect(styles.boxShadow).toContain('rgb(30, 104, 67)');
  expect(styles.height).toBeGreaterThanOrEqual(18);
  expect(styles.width).toBeGreaterThanOrEqual(18);
});

test('正文汉字之间保留更宽的横向间距', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  await expect.poll(async () => page.locator('.target-char').count()).toBeGreaterThan(1);
  const gap = await page.locator('.target-char').evaluateAll((chars) => {
    const first = chars[0].getBoundingClientRect();
    const second = chars[1].getBoundingClientRect();
    return second.left - first.right;
  });

  expect(gap).toBeGreaterThanOrEqual(8);
});

async function mockContentApi(page: import('@playwright/test').Page) {
  await page.route('**/external-api/chicken-soup', async (route) => {
    await route.fulfill({
      json: { code: 200, msg: '请求成功', data: { content: '知不足而奋进，望远山而前行。' } },
    });
  });
  await page.route('**/tongue-api/raokouling', async (route) => {
    await route.fulfill({
      json: { code: 0, msg: 'success', data: { content: '四是四，十是十。十四是十四，四十是四十。' } },
    });
  });
  await page.route('**/poetry-api/yiyan?type=poetry', async (route) => {
    await route.fulfill({
      json: {
        code: 200,
        msg: '数据请求成功',
        data: '行到水穷处坐看云起时《终南别业》 — 王维',
      },
    });
  });
}
