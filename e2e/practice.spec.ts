import { expect, test } from '@playwright/test';

test('按错键不会推进当前字', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  await expectStageText(page, '行到水穷处坐看云起时');
  await page.keyboard.press('S');

  await expect(page.locator('.target-line .is-active .target-glyph')).toHaveText('行');
  await expect(page.locator('[data-key="s"]')).toHaveClass(/is-wrong/);
});

test('可以切换练习模块并换一组', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  await page.getByRole('button', { name: '绕口令' }).click();
  await expectStageText(page, '四是四，十是十。十四是十四，四十是四十。');

  await page.getByRole('button', { name: '诗词句子' }).click();
  await page.getByRole('button', { name: '换一组' }).click();
  await expectStageText(page, '行到水穷处坐看云起时');
});

test('完成弹窗打开时按 Enter 默认进入下一组', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  await expectStageText(page, '行到水穷处坐看云起时');
  await page.keyboard.type('xkdcuvqsiuzokjyyqiui');
  await expect(page.getByRole('dialog')).toContainText('本轮完成');

  await page.keyboard.press('Enter');

  await expect(page.getByRole('dialog')).toBeHidden();
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
  await expectStageText(page, '四是四，十是十。十四是十四，四十是四十。');
});

test('制造错题后进入易错练习会显示错因分组', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  await expectStageText(page, '行到水穷处坐看云起时');
  await page.keyboard.press('S');
  await page.keyboard.press('X');
  await page.keyboard.press('K');
  await page.getByRole('button', { name: '易错练习' }).click();

  await expect(page.getByText('错因复练')).toBeVisible();
  await expect(page.getByText('声母键误按')).toBeVisible();
  await expect(page.getByText('重点键 S')).toBeVisible();
  await expect(page.getByText('今日练习 · 易错练习 · 易错复练')).toBeVisible();
});

test('记录页会给出纠错建议并可开始易错复练', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  await expectStageText(page, '行到水穷处坐看云起时');
  await page.keyboard.press('S');
  await page.keyboard.press('X');
  await page.keyboard.press('K');
  await page.getByRole('link', { name: '记录' }).click();

  await expect(page.getByRole('heading', { name: '纠错教练' })).toBeVisible();
  await expect(page.getByText('今天先修这个')).toBeVisible();
  await expect(page.getByRole('heading', { name: '声母键误按' })).toBeVisible();
  await expect(page.locator('.coach-focus').getByText('重点键 S')).toBeVisible();

  await page.getByRole('button', { name: '开始易错复练' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('今日练习 · 易错练习')).toBeVisible();
});

test('没有错题时易错练习显示冷启动提示', async ({ page }) => {
  await mockContentApi(page);
  await page.goto('/');

  await page.getByRole('button', { name: '易错练习' }).click();

  await expect(page.getByText('错因复练')).toBeVisible();
  await expect(page.getByText('太棒了，没有出过错误')).toBeVisible();
  await expect(page.getByText('继续保持，打出第一条错题后这里会自动生成复练组')).toBeVisible();
  await expect(page.getByText('多情云')).toBeHidden();
});

test('安装外置词库后可以离线进入词库练习', async ({ page }) => {
  await mockContentApi(page);
  await mockVocabularyRegistry(page);
  await page.goto('/');

  await page.getByRole('link', { name: '词库' }).click();
  await expect(page.getByRole('heading', { name: '安装词库后开始练习' })).toBeVisible();
  await page.getByTestId('install-vocabulary-daily-common').click();
  await expect(page.getByText('已安装').first()).toBeVisible();

  await page.getByRole('button', { name: '开始练习' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('今日练习 · 词库练习 · 日常常用词')).toBeVisible();
  await expectStageText(page, '今天事情可以我们项目完成');

  await page.unroute('**/vocabularies/registry.json');
  await page.unroute('https://example.com/daily-common.json');
  await page.getByRole('button', { name: '词库练习' }).click();

  await expectStageText(page, '今天事情可以我们项目完成');
});

async function expectStageText(page: import('@playwright/test').Page, text: string) {
  await expect
    .poll(async () => page.locator('.target-glyph').evaluateAll((nodes) => nodes.map((node) => node.textContent ?? '').join('')))
    .toBe(text);
}

async function mockContentApi(page: import('@playwright/test').Page, options: { tongueTwisterDelayMs?: number } = {}) {
  await page.route('**/external-api/chicken-soup', async (route) => {
    await route.fulfill({
      json: { code: 200, msg: '请求成功', data: { content: '知不足而奋进，望远山而前行。' } },
    });
  });
  await page.route('**/tongue-api/raokouling', async (route) => {
    if (options.tongueTwisterDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.tongueTwisterDelayMs));
    }
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

async function mockVocabularyRegistry(page: import('@playwright/test').Page) {
  await page.route('**/vocabularies/registry.json', async (route) => {
    await route.fulfill({
      json: {
        schemaVersion: 1,
        updatedAt: '2026-06-17T00:00:00.000Z',
        packages: [{
          id: 'daily-common',
          name: '日常常用词',
          version: '1.0.0',
          description: '适合日常输入热身。',
          author: 'Shuangpin Cabin',
          pricingType: 'free',
          tags: ['daily'],
          entryCount: 12,
          downloadUrl: 'https://example.com/daily-common.json',
        }],
      },
    });
  });
  await page.route('https://example.com/daily-common.json', async (route) => {
    await route.fulfill({
      json: {
        schemaVersion: 1,
        id: 'daily-common',
        name: '日常常用词',
        version: '1.0.0',
        author: 'Shuangpin Cabin',
        license: 'MIT',
        pricingType: 'free',
        description: '适合日常输入热身。',
        tags: ['daily'],
        entries: [
          { text: '今天', weight: 99 },
          { text: '事情', weight: 98 },
          { text: '可以', weight: 97 },
          { text: '我们', weight: 96 },
          { text: '项目', weight: 95 },
          { text: '完成', weight: 94 },
        ],
      },
    });
  });
}
