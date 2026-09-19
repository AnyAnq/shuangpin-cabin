import { expect, test, type Page } from '@playwright/test';

async function startCustom(page: Page, text: string) {
  await page.goto('/typing');
  await page.getByLabel('练习内容', { exact: true }).selectOption('custom');
  await page.getByLabel('自定义原文').fill(text);
  await page.getByRole('button', { name: '开始跟打' }).click();
  await expect(page.getByTestId('typing-input')).toBeFocused();
}

test('错误不阻断跟打，手动评测、错句复练和刷新后回看报告', async ({ page }) => {
  await startCustom(page, '甲乙丙。下一句。');
  await page.keyboard.insertText('甲丙。下一多句。');
  await expect(page.getByTestId('typing-input')).toHaveValue('甲丙。下一多句。');
  await expect(page.getByRole('heading', { name: '本次跟打报告' })).toBeHidden();
  await page.getByRole('button', { name: '完成并评测' }).click();
  await expect(page.getByRole('heading', { name: '本次跟打报告' })).toBeVisible();
  await expect(page.getByLabel('错误统计')).toHaveText('正确 7错字 0漏字 1多字 1');
  await expect(page.locator('.typing-metrics')).toContainText('77.8');
  await page.getByRole('button', { name: '复练本次错句' }).click();
  await expect(page.locator('.typing-toolbar')).toContainText('错句复练');
  await page.keyboard.insertText('甲乙丙。下一句。');
  await page.getByRole('button', { name: '完成并评测' }).click();
  await expect(page.getByLabel('错误统计')).toHaveText('正确 8错字 0漏字 0多字 0');
  await page.getByRole('link', { name: '查看跟打记录' }).click();
  await expect(page.locator('.typing-record-list li')).toHaveCount(2);
  await expect(page.locator('.progress-summary')).toContainText('1 组练习');
  await page.reload();
  await expect(page.locator('.typing-record-list li')).toHaveCount(2);
  await page.getByRole('button', { name: '查看报告' }).last().click();
  await expect(page.getByLabel('错误统计')).toHaveText('正确 7错字 0漏字 1多字 1');
});

test('候选词等待期间保留焦点和文本，取消组词及中间修改不会跳光标', async ({ page }) => {
  await startCustom(page, '你好，今天出门。');
  // This simulates browser composition events; real Windows IME acceptance is a separate manual check.
  await page.getByTestId('typing-input').evaluate((element: HTMLTextAreaElement) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = 'nihao';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }));
  });
  await expect(page.getByRole('button', { name: '完成并评测' })).toBeDisabled();
  await expect(page.locator('.typing-live-stats')).not.toContainText('用时 0:00');
  await expect(page.getByTestId('typing-input')).toHaveValue('nihao');
  await expect(page.getByTestId('typing-input')).toBeFocused();
  await page.getByTestId('typing-input').evaluate((element: HTMLTextAreaElement) => {
    element.value = '';
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }));
  });
  await expect(page.locator('.typing-reference .replace')).toHaveCount(0);
  await page.keyboard.insertText('你好，今天出门。');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.insertText('们');
  await expect(page.getByTestId('typing-input')).toHaveValue('你们好，今天出门。');
  expect(await page.getByTestId('typing-input').evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(2);
  await page.keyboard.press('Backspace');
  await page.getByRole('button', { name: '完成并评测' }).click();
  await expect(page.getByLabel('错误统计')).toHaveText('正确 8错字 0漏字 0多字 0');
  await expect(page.getByLabel('本次错句')).toContainText('你好，今天出门。');
});

test('两千字输入、滚动、窄屏及粘贴保护', async ({ page }) => {
  const article = '保持节奏，继续输入。'.repeat(200);
  await startCustom(page, article);
  expect(await page.getByTestId('typing-input').evaluate(element => {
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
  await page.keyboard.insertText(article.slice(0, -10));
  await expect(page.locator('[data-current]')).toBeInViewport();
  await expect(page.getByTestId('typing-input')).toBeFocused();
  await page.keyboard.insertText(article.slice(-10));
  await expect(page.getByRole('heading', { name: '本次跟打报告' })).toBeHidden();
  await page.getByRole('button', { name: '完成并评测' }).click();
  await expect(page.getByLabel('错误统计')).toHaveText('正确 2000错字 0漏字 0多字 0');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: '重练全文' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
