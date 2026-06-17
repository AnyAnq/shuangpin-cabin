import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDailyQuote, fetchPoetryUnit, fetchTongueTwisterUnit } from '../../src/services/contentApi';

describe('在线内容 API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('把绕口令 API 响应转换为可练习内容，并跳过标点生成拼音', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 0,
            msg: 'success',
            data: {
              content: "小石与小史，谁也没读准'正直'。",
            },
          }),
      }),
    );

    const unit = await fetchTongueTwisterUnit();

    expect(fetch).toHaveBeenCalledWith('/tongue-api/raokouling');
    expect(unit.text).toBe("小石与小史，谁也没读准'正直'。");
    expect(unit.syllables).toEqual(['xiao', 'shi', 'yu', 'xiao', 'shi', 'shui', 'ye', 'mei', 'du', 'zhun', 'zheng', 'zhi']);
    expect(unit.tags).toContain('绕口令');
  });

  it('把诗词 API 响应转换为诗词练习内容', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 200,
            msg: '数据请求成功',
            data: '满园花菊郁金黄，中有孤丛色似霜。《重阳席上赋白菊》 — 白居易',
          }),
      }),
    );

    const unit = await fetchPoetryUnit();

    expect(unit.text).toBe('满园花菊郁金黄，中有孤丛色似霜。');
    expect(unit.source).toBe('重阳席上赋白菊 · 白居易');
    expect(unit.syllables[0]).toBe('man');
  });

  it('清理绕口令 API 的换行标签', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 0,
            data: {
              id: 'twister-remote',
              content: '老彭盆碰老陈棚，<br/>棚倒盆碎真可惜。',
            },
          }),
      }),
    );

    const unit = await fetchTongueTwisterUnit();

    expect(unit.text).toBe('老彭盆碰老陈棚，棚倒盆碎真可惜。');
    expect(unit.syllables[0]).toBe('lao');
  });

  it('把 ü 音节归一化为双拼编码可识别的 v 写法', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 0,
            data: { content: '绿女' },
          }),
      }),
    );

    const unit = await fetchTongueTwisterUnit();

    expect(unit.syllables).toEqual(['lv', 'nv']);
  });

  it('把每日一言 API 响应转换为右侧文案', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 200,
            data: { content: '没有人瞧不起你，因为根本就没有人瞧你。' },
          }),
      }),
    );

    const quote = await fetchDailyQuote();

    expect(quote.text).toBe('没有人瞧不起你，因为根本就没有人瞧你。');
    expect(quote.source).toBe('某日一言');
  });
});
