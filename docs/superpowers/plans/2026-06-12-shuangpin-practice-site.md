# 双拼输入法练习网站设计与实现方案

> **给后续执行者的说明：** 实现本方案时，建议使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 按任务推进。每个任务都应先写可验证逻辑，再实现，再运行测试。

**目标：** 开发一个暖色调、沉浸式、响应迅速的双拼输入法练习网站，支持小鹤双拼与自然码一键切换，并提供单字练习、诗词句子练习、文章打字练习、实时统计与易错练习。

**整体架构：** 使用浏览器端优先的 Vue 应用。练习输入、按键反馈、统计计算和错题记录都在本地即时完成，避免网络延迟影响打字体验。公开练习内容使用静态内容包承载，用户练习记录、偏好和易错数据使用 IndexedDB 本地存储。

**推荐技术栈：** Vite、Vue 3、TypeScript、Pinia、Vue Router、Naive UI、Dexie、Vitest、Vue Test Utils、Playwright。

---

## 一、产品定位

这个网站不是普通打字游戏，也不是后台式学习管理系统，而是一个专注、安静、有设计感的双拼训练空间。

用户打开首页后，应该立刻进入练习状态。界面第一优先级是当前文字、当前编码、虚拟键盘和即时反馈；统计、方案、模块、记录等信息都应保持可见但低干扰。

最终视觉方向采用我们讨论后的 V6 方案：

- 暖色护眼背景，主色为象牙白、浅琥珀、暖棕，辅以克制的绿色高亮。
- 左侧为深暖色浮动图标导航，避免模板化侧边栏。
- 顶部放置练习模块切换和双拼方案切换。
- 中央为沉浸练习区，只保留目标文字、编码键帽和虚拟键盘。
- 不显示传统输入框。
- 右侧为实时统计、当前方案和每日一言。
- 每日一言可以展示古诗词、名人名言、哲思短句，提升文化气质。

## 二、核心功能

### 1. 双拼方案切换

支持两种方案：

- 小鹤双拼
- 自然码

切换要求：

- 一键切换。
- 切换后立即刷新编码提示。
- 虚拟键盘上的韵母、声母标注同步变化。
- 易错记录按方案隔离，不能把小鹤的错题混入自然码。

### 2. 练习模块

必须支持三个基础模块：

- 单字练习
- 诗词句子练习
- 文章打字练习

建议后续扩展一个独立模块：

- 易错练习

模块切换在顶部完成。顶部控件应表达为“练什么”，双拼方案切换表达为“用什么方案”，两者不要混在一起。

### 3. 实时统计

每个练习模块都需要实时展示：

- 准确率
- 用时
- 最大连击数
- WPM

统计区域放在右侧面板，用户可以扫视，但不应抢走中央练习焦点。

### 4. 按错键处理

按错键是这个产品体验的关键，必须设计成“清楚但不惩罚”。

按键规则：

- 按对当前期望键：编码进度前进一步。
- 按错字母键：记录错误，但光标不前进。
- 按错后，用户仍需输入正确键才能继续。
- 非输入类按键，如 Shift、Ctrl、Alt、方向键、功能键，应忽略。
- Backspace 是否允许撤销，可以作为练习设置；默认建议允许撤销最后一个已正确输入的编码位。

错误反馈：

- 当前目标字短暂显示错误状态。
- 实际按错的虚拟按键短暂闪烁为暖红或橙色。
- 当前应按键保持绿色或高亮。
- 当前编码键帽轻微抖动或闪烁。
- 准确率立即更新。
- 不弹出大提示，不播放强干扰动画。

错误反馈持续时间建议为 150-220ms。

## 三、内容承载方案

### 1. 练习内容

练习内容不需要一开始进入数据库，建议作为静态内容包放在项目内：

```txt
src/content/characters.ts
src/content/poems.ts
src/content/articles.ts
src/content/quotes.ts
```

内容结构建议：

```ts
export interface PracticeUnit {
  id: string;
  module: 'character' | 'poem' | 'article';
  text: string;
  syllables: string[];
  source?: string;
  tags: string[];
}
```

示例：

```ts
export const poemUnits: PracticeUnit[] = [
  {
    id: 'poem-001',
    module: 'poem',
    text: '多情却被无情恼',
    syllables: ['duo', 'qing', 'que', 'bei', 'wu', 'qing', 'nao'],
    source: '蝶恋花',
    tags: ['宋词', '短句'],
  },
];
```

### 2. 用户数据

用户相关数据使用 IndexedDB 本地存储，通过 Dexie 封装。

本地存储内容：

- 当前选择的双拼方案。
- 当前练习模块。
- 历史练习记录。
- 每轮统计结果。
- 易错记录。
- 每日练习状态。

暂不引入远程数据库。只有当后续需要账号、跨设备同步、排行榜、自定义内容分享时，才考虑 Supabase、Postgres、Turso、Cloudflare D1 等后端方案。

## 四、易错练习设计

易错练习是本网站最重要的差异化功能之一。

### 1. 易错记录维度

每次按错键时，记录以下信息：

```ts
export interface MistakeRecord {
  id: string;
  scheme: 'xiaohe' | 'ziranma';
  module: 'character' | 'poem' | 'article' | 'mistake';
  targetChar: string;
  targetSyllable: string;
  expectedCode: string;
  expectedKey: string;
  actualKey: string;
  errorType: 'initial-key' | 'final-key' | 'sequence' | 'typo';
  contextText: string;
  count: number;
  lastWrongAt: number;
  lastCorrectAt: number | null;
  correctStreak: number;
  averageCorrectionMs: number;
}
```

必须注意：

- 错题按双拼方案隔离。
- 错题按具体期望键记录，而不只是按汉字记录。
- 同一个字在不同方案下的编码可能不同，不能混算。

### 2. 易错评分

易错项不是简单按错误次数排序，而是综合考虑：

- 错误次数。
- 最近是否还错。
- 修正耗时。
- 连续正确次数。

建议评分：

```ts
export function scoreMistake(record: MistakeRecord, now = Date.now()): number {
  const hoursSinceWrong = Math.max(1, (now - record.lastWrongAt) / 36e5);
  const recency = 24 / Math.min(24, hoursSinceWrong);
  const correctionPenalty = Math.min(5, record.averageCorrectionMs / 600);
  const recovery = record.correctStreak * 1.5;

  return Math.max(0, record.count * 3 + recency + correctionPenalty - recovery);
}
```

### 3. 易错练习形式

建议提供三种复练方式：

- 练习中穿插：普通练习每 8-12 个单位插入 1 个近期易错项。
- 独立易错练习：集中练当前方案下分数最高的错题。
- 练习结束复盘：展示本轮最常错的键、声母、韵母和对应例字。

易错练习的语气应该像教练，而不是惩罚。界面可以使用“今日复练”“最近易混”“已掌握”这类表达。

## 五、UI 设计方案

### 1. 整体布局

桌面端采用三栏：

```txt
左侧浮动导航 | 中央练习区 | 右侧信息面板
```

桌面尺寸：

- 左侧导航占位约 104px，实际浮动栏宽约 62px。
- 中央练习区自适应。
- 右侧信息面板约 224px。

响应式：

- 小于 960px 时隐藏右侧信息面板。
- 侧边栏保持图标模式。
- 目标文字和键盘尺寸缩小。
- 顶部模块和方案切换保留。

### 2. 左侧导航

采用深暖色浮动导航，而不是浅色后台侧栏。

设计要求：

- 深棕暖色背景。
- 24px 左右圆角。
- 图标导航，不常驻文字。
- 当前项使用半透明底色和绿色/琥珀细光条。
- 悬停时显示 tooltip。

导航入口：

- 练习
- 课程
- 键位对照
- 记录
- 设置

### 3. 顶部控制区

顶部左侧是练习模块：

- 单字练习
- 诗词句子
- 文章打字

顶部右侧是方案切换：

- 小鹤双拼
- 自然码

控件可以使用 Naive UI 的按钮组或自定义 segmented control。视觉上要圆润，但不能像普通后台筛选器。

### 4. 中央练习区

中央练习区是整个页面的核心。

层级：

```txt
进度条
当前目标文字
编码键帽
虚拟键盘
```

目标文字：

- 当前字深色加粗。
- 已完成字可以变为暖色或浅色。
- 未完成字低对比度。
- 按错时当前字短暂错误态。

编码键帽：

- 显示当前字对应的双拼编码。
- 已正确输入的键帽变绿。
- 当前待输入键帽保持待输入状态。
- 按错时键帽轻微抖动。

输入承载：

- 技术上使用隐藏 input 或全局 keydown。
- 界面上不显示传统输入框。
- 用户的输入反馈只体现在当前字、编码键帽和虚拟键盘上。

虚拟键盘：

- 展示 QWERTY 三行。
- 每个键显示字母和当前方案下的声母/韵母映射。
- 当前应按键高亮。
- 实际按错键短暂错误态。

### 5. 右侧信息面板

右侧面板展示可扫视信息：

- 准确率
- 用时
- 最大连击
- WPM
- 当前方案
- 每日一言

每日一言示例：

```ts
export const dailyQuotes = [
  { text: '心有猛虎，细嗅蔷薇。', source: '萨松', tags: ['名言'] },
  { text: '行到水穷处，坐看云起时。', source: '王维', tags: ['古诗词'] },
  { text: '知不足而奋进，望远山而前行。', source: '练习法', tags: ['自定义'] },
];
```

每日一言不参与练习逻辑，只负责提供情绪和文化氛围。

## 六、推荐文件结构

```txt
src/
  app/
    App.vue
    router.ts
  components/
    layout/
      AppShell.vue
      FloatingSidebar.vue
      RightInsightPanel.vue
    practice/
      PracticeStage.vue
      CodeHint.vue
      VirtualKeyboard.vue
      StatsPanel.vue
      CompletionModal.vue
    controls/
      ModuleTabs.vue
      SchemeSwitch.vue
  content/
    articles.ts
    characters.ts
    poems.ts
    quotes.ts
  domain/
    schemes/
      types.ts
      xiaohe.ts
      ziranma.ts
    practice/
      types.ts
      sessionEngine.ts
      stats.ts
      mistakes.ts
      contentPicker.ts
  stores/
    practiceStore.ts
    preferenceStore.ts
  storage/
    db.ts
    repositories.ts
  styles/
    tokens.css
    global.css
  views/
    PracticeView.vue
tests/
  domain/
    schemes.test.ts
    stats.test.ts
    sessionEngine.test.ts
    mistakes.test.ts
  components/
    PracticeStage.test.ts
    VirtualKeyboard.test.ts
e2e/
  practice.spec.ts
```

## 七、核心领域模型

```ts
export type ShuangpinSchemeId = 'xiaohe' | 'ziranma';
export type PracticeModule = 'character' | 'poem' | 'article' | 'mistake';

export interface ShuangpinScheme {
  id: ShuangpinSchemeId;
  name: string;
  keys: SchemeKey[];
  encodeSyllable: (syllable: string) => string;
}

export interface SchemeKey {
  key: string;
  label: string;
  finals: string[];
  initials: string[];
}

export interface LiveStats {
  startedAt: number | null;
  elapsedMs: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
  wrongKeystrokes: number;
  accuracy: number;
  maxCombo: number;
  currentCombo: number;
  wpm: number;
}
```

## 八、实现任务拆分

### 任务 1：初始化项目

目标：建立 Vue 3 + TypeScript 项目基础。

操作：

```bash
npm create vite@latest . -- --template vue-ts
npm install naive-ui pinia vue-router dexie @vueuse/core lucide-vue-next
npm install -D vitest @vue/test-utils jsdom playwright @playwright/test fake-indexeddb
```

创建基础文件：

- `src/main.ts`
- `src/app/App.vue`
- `src/app/router.ts`
- `src/styles/tokens.css`
- `src/styles/global.css`

验收：

```bash
npm run dev
npm run build
```

### 任务 2：实现双拼方案

目标：建立小鹤双拼和自然码的编码映射。

文件：

- `src/domain/schemes/types.ts`
- `src/domain/schemes/xiaohe.ts`
- `src/domain/schemes/ziranma.ts`
- `tests/domain/schemes.test.ts`

测试重点：

- `duo` 在小鹤中编码为 `do`。
- `qing` 在小鹤中编码为 `qk`。
- `duo` 在自然码中编码为 `do`。
- `qing` 在自然码中编码为 `qy`。
- 不支持的拼音应抛出明确错误。

验收：

```bash
npm run test -- tests/domain/schemes.test.ts
```

### 任务 3：实现练习引擎

目标：把按键逻辑从 UI 中独立出来，保证可以单元测试。

文件：

- `src/domain/practice/types.ts`
- `src/domain/practice/sessionEngine.ts`
- `src/domain/practice/stats.ts`
- `tests/domain/sessionEngine.test.ts`
- `tests/domain/stats.test.ts`

必须覆盖：

- 按对键后编码位前进。
- 按错键后位置不变。
- 按错键会增加错误次数。
- 非输入键会被忽略。
- 完成当前字后进入下一个字。
- 完成全部内容后进入完成状态。
- 准确率、WPM、最大连击可正确计算。

验收：

```bash
npm run test -- tests/domain/sessionEngine.test.ts tests/domain/stats.test.ts
```

### 任务 4：实现易错记录和评分

目标：记录按错键行为，并生成易错练习依据。

文件：

- `src/domain/practice/mistakes.ts`
- `tests/domain/mistakes.test.ts`

必须覆盖：

- 高频错误分数更高。
- 最近错误分数更高。
- 修正耗时长分数更高。
- 连续正确会降低分数。
- 不同双拼方案的错题互不影响。

验收：

```bash
npm run test -- tests/domain/mistakes.test.ts
```

### 任务 5：实现 V6 UI 外壳

目标：落地我们确定的视觉结构。

文件：

- `src/views/PracticeView.vue`
- `src/components/layout/AppShell.vue`
- `src/components/layout/FloatingSidebar.vue`
- `src/components/layout/RightInsightPanel.vue`
- `src/components/controls/ModuleTabs.vue`
- `src/components/controls/SchemeSwitch.vue`

验收标准：

- 页面是暖色沉浸背景。
- 左侧为深暖色浮动导航。
- 顶部有模块切换和方案切换。
- 右侧有统计卡片和每日一言。
- 页面没有广告感和后台管理感。

### 任务 6：实现练习舞台和虚拟键盘

目标：实现无传统输入框的练习体验。

文件：

- `src/components/practice/PracticeStage.vue`
- `src/components/practice/CodeHint.vue`
- `src/components/practice/VirtualKeyboard.vue`
- `tests/components/PracticeStage.test.ts`
- `tests/components/VirtualKeyboard.test.ts`

验收标准：

- 当前字高亮。
- 编码键帽显示正确。
- 已输入编码键帽变绿。
- 当前应按键高亮。
- 按错键时实际错误键出现错误态。
- 页面中不存在可见输入框。

### 任务 7：实现内容和本地存储

目标：建立内容包和 IndexedDB 数据层。

文件：

- `src/content/characters.ts`
- `src/content/poems.ts`
- `src/content/articles.ts`
- `src/content/quotes.ts`
- `src/storage/db.ts`
- `src/storage/repositories.ts`

存储表：

- `mistakes`
- `sessions`
- `preferences`

验收：

```bash
npm run build
```

### 任务 8：串联输入、状态和浏览器验证

目标：让用户可以真实练习。

文件：

- `src/stores/practiceStore.ts`
- `src/components/practice/CompletionModal.vue`
- `src/views/PracticeView.vue`
- `e2e/practice.spec.ts`

必须实现：

- 全局 keydown 或隐藏 input 承载输入。
- 输入时调用练习引擎。
- UI 根据引擎结果更新。
- 按错键不前进。
- 按对键继续。
- 完成后出现结果弹窗。

验收：

```bash
npm run test
npm run build
npx playwright test
```

## 九、测试策略

优先测试领域逻辑，而不是只测界面。

必须有测试：

- 双拼编码映射。
- 练习引擎按键行为。
- 统计计算。
- 易错评分。
- 练习舞台是否不显示输入框。
- 按错键是否不前进。

浏览器验证：

- 打开首页。
- 切换小鹤/自然码。
- 切换三个练习模块。
- 输入正确键。
- 输入错误键。
- 验证统计变化。
- 验证虚拟键盘高亮。

## 十、后续扩展

MVP 完成后可以扩展：

- 易错练习独立页。
- 键位热力图。
- 每日练习计划。
- 文章难度分级。
- 自定义文章导入。
- 云端同步。
- 排行榜。
- 多主题皮肤。

这些功能不应阻塞 MVP。

## 十一、自查结论

本方案已覆盖：

- 技术栈选择。
- 内容承载方式。
- 本地数据存储。
- 双拼方案切换。
- 三种练习模块。
- 实时统计。
- 按错键处理。
- 易错练习设计。
- V6 UI 方向。
- 每日一言。
- 测试与验收方式。

当前工作区还不是 Git 仓库，因此文档未提交 commit。正式开始实现时，建议先初始化 Git，再按任务逐步提交。

## 十二、执行方式选择

方案文档已保存到：

```txt
docs/superpowers/plans/2026-06-12-shuangpin-practice-site.md
```

推荐两种执行方式：

1. **Subagent-Driven（推荐）**：每个任务由独立子代理完成，我在任务之间做检查和整合。
2. **Inline Execution**：在当前会话中按计划逐步实现，每完成一批做一次验证。

请选择一种方式后再进入实现。
