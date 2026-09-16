import { expect, test, type Page } from '@playwright/test';
import { xiaoheScheme } from '../src/domain/schemes/xiaohe';
import { ziranmaScheme } from '../src/domain/schemes/ziranma';

const body = '一片春愁待酒浇。江上舟摇，楼上帘招。';
const poem = body + '—— 蒋捷《一剪梅·舟过吴江》';
const syllables = 'yi pian chun chou dai jiu jiao jiang shang zhou yao lou shang lian zhao'.split(' ');

for (const width of [390, 768, 1280]) {
  test('诗词题注与标点自适应排版：' + width, async ({ page }) => {
    await showText(page, poem, width);
    await expect(page.locator('.practice-title')).toHaveText('《一剪梅 · 舟过吴江》');
    await expect(page.locator('.practice-author')).toHaveText('蒋捷');
    await expect(page.locator('.session-strip')).not.toContainText('蒋捷');
    await expect(page.locator('.session-strip')).not.toContainText('在线诗词');
    await expect(page.locator('[data-char-code]')).toHaveCount(15);

    const glyphs = await readGlyphs(page);
    const rows = visualRows(glyphs);
    expect(rows.join('')).toBe(body);
    if (width >= 768) expect(rows).toEqual(['一片春愁待酒浇。', '江上舟摇，楼上帘招。']);
    else expect(rows.slice(-2)).toEqual(['江上舟摇，', '楼上帘招。']);
    await expectReadableLayout(page, glyphs);
  });

  test('超长分句和连续标点保持可读：' + width, async ({ page }) => {
    const text = '春江潮水连海平海上明月共潮生滟滟随波千万里何处春江无月明\n他说：“好！？”（再练），继续。';
    await showText(page, text, width);
    await expect(page.locator('.practice-heading')).toHaveCount(0);
    const glyphs = await readGlyphs(page);
    expect(glyphs.map(glyph => glyph.text).join('')).toBe(text.replace('\n', ''));
    expect(visualRows(glyphs).length).toBeGreaterThanOrEqual(3);
    await expectReadableLayout(page, glyphs);
  });
}

test('跨行输入、退格、缩放、编码开关与方案切换只处理正文', async ({ page }) => {
  await showText(page, poem, 1280);
  await page.keyboard.type(syllables.slice(0, 7).map(xiaoheScheme.encodeSyllable).join(''));
  const active = page.locator('.target-char.is-active .target-glyph');
  await expect(active).toHaveText('江');
  await page.keyboard.press('Backspace');
  await expect(active).toHaveText('浇');
  await page.keyboard.type(xiaoheScheme.encodeSyllable('jiao').slice(-1));
  await expect(active).toHaveText('江');
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(active).toHaveText('江');
  await expect(page.locator('[data-char-code="8"]')).toHaveAttribute('aria-label', 'j l');

  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByTestId('toggle-character-codes').click();
  await page.getByRole('button', { name: '关闭设置' }).click();
  await expect(page.locator('[data-char-code]')).toHaveCount(0);
  await expect(active).toHaveText('江');
  await page.getByRole('button', { name: '自然码', exact: true }).click();
  await expect(active).toHaveText('一');
  await page.keyboard.type(syllables.map(ziranmaScheme.encodeSyllable).join(''));
  await expect(page.getByRole('dialog')).toContainText('本轮完成');
  await expect(page.locator('.session-progress > span')).toHaveAttribute('style', /100%/);
});

async function showText(page: Page, text: string, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.route('**/poetry-api/yiyan?type=poetry', route => route.fulfill({ json: { code: 200, data: text } }));
  await page.route('**/external-api/one', route => route.fulfill({ json: { code: 200, data: { content: '每天练习，慢慢进步。' } } }));
  await page.goto('/');
  await expect(page.locator('.target-glyph').first()).toBeVisible();
}

async function readGlyphs(page: Page) {
  return page.locator('.target-glyph').evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return { text: element.textContent!, top: Math.round(box.top), left: box.left, right: box.right };
  }));
}

function visualRows(glyphs: Awaited<ReturnType<typeof readGlyphs>>) {
  const rows = new Map<number, string>();
  for (const glyph of glyphs) rows.set(glyph.top, (rows.get(glyph.top) ?? '') + glyph.text);
  return [...rows.values()];
}

async function expectReadableLayout(page: Page, glyphs: Awaited<ReturnType<typeof readGlyphs>>) {
  const copy = (await page.locator('.practice-copy').boundingBox())!;
  expect(copy.x).toBeGreaterThanOrEqual(0);
  expect(copy.x + copy.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  for (const [index, glyph] of glyphs.entries()) {
    expect(glyph.left).toBeGreaterThanOrEqual(copy.x - 1);
    expect(glyph.right).toBeLessThanOrEqual(copy.x + copy.width + 1);
    if (/[，。！？；：、”）]/.test(glyph.text)) expect(glyph.top).toBe(glyphs[index - 1].top);
    if (/[“（]/.test(glyph.text)) expect(glyph.top).toBe(glyphs[index + 1].top);
  }
  // Check visible rows, not just the centered container: wrapped short lines can still lean left.
  const stage = (await page.locator('.practice-stage').boundingBox())!;
  const center = stage.x + stage.width / 2;
  const groups = await page.locator('.text-group').evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().toJSON()));
  for (const top of new Set(groups.map(group => group.top))) {
    const row = groups.filter(group => group.top === top);
    expect(Math.abs((row[0].left + row.at(-1)!.right) / 2 - center)).toBeLessThanOrEqual(1);
  }
  if (await page.locator('.practice-heading').count() && page.viewportSize()!.width >= 768) {
    const title = (await page.locator('.practice-title').boundingBox())!;
    const author = (await page.locator('.practice-author').boundingBox())!;
    expect(Math.abs((title.x + author.x + author.width) / 2 - center)).toBeLessThanOrEqual(1);
  }
  const hints = await page.locator('[data-char-code]').evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().toJSON()));
  for (let i = 1; i < hints.length; i += 1) {
    if (Math.abs(hints[i].top - hints[i - 1].top) < 1) {
      expect(hints[i].left).toBeGreaterThanOrEqual(hints[i - 1].right);
    } else {
      expect(hints[i].top).toBeGreaterThan(hints[i - 1].bottom);
    }
  }
}
