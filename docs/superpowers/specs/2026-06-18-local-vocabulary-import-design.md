# 本地词库导入与导出设计

## 背景

双拼小筑已经支持从在线词库中心安装外置词库，并将词库保存到浏览器 IndexedDB 后用于词库练习。现有远程词库使用标准 JSON 包格式，练习模块通过已安装词库生成练习单元。

新功能要让用户导入本地词库，自行制作练习内容，并能把整理好的本地词库导出为标准 JSON 包，形成“制作、导入、练习、备份/分享”的闭环。

## 目标

- 支持导入标准 JSON 词库包。
- 支持导入简易 TXT/CSV 词表。
- 导入前展示解析预览和可编辑元信息。
- 本地词库与在线词库在词库中心明确分区。
- 本地词库支持导出为标准 JSON 包。
- 练习模块继续复用现有词库练习流程，不感知词库来源。

## 非目标

- 不在本阶段提供词条级编辑器。
- 不提供云端同步、账号体系或在线分享市场。
- 不改变词库练习的组句、拼音转换和双拼编码逻辑。
- 不导出 TXT/CSV；导出统一使用标准 JSON 包，保证可再次导入。

## 文件格式

### 标准 JSON 包

JSON 导入沿用现有远程词库格式：

```json
{
  "schemaVersion": 1,
  "id": "my-vocabulary",
  "name": "我的词库",
  "version": "1.0.0",
  "author": "用户",
  "license": "Personal",
  "pricingType": "owned",
  "description": "自定义练习词库",
  "tags": ["custom"],
  "entries": [
    { "text": "今天", "weight": 100, "tags": ["daily"] }
  ]
}
```

JSON 文件使用现有 `validateVocabularyPackage` 作为最终准入规则。导入成功后标记为本地来源。

如果 JSON 根节点是数组，则按简易词表处理。数组项可以是字符串词条，也可以是包含 `text`、`weight`、`tags` 的对象。这兼容从剪贴板或其它工具导出的 JSON 词表。

### TXT/CSV 简易词表

TXT 和 CSV 面向普通用户，支持一行一个词，也支持逗号追加权重和标签：

```text
今天
项目,80,工作
练习,60,基础|输入
```

解析规则：

- CSV 列含义为 `text,weight,tags`。
- 首行如果是 `text,weight,tags`，自动作为表头跳过。
- 标签可用 `|`、`/`、空格或中文顿号分隔。
- 只保留纯中文词条，沿用最长 12 字限制。
- 重复词条合并，保留最高权重并合并标签。
- 没有权重时按文件顺序生成权重，越靠前权重越高。
- 空行、注释行、符号词、英文数字混合词进入过滤统计，不中断导入。

TXT/CSV 导入后生成标准 `VocabularyPackageFile`：

- `id`: `local-<slug>-<timestamp>`
- `name`: 默认取文件名去扩展名
- `version`: `1.0.0`
- `author`: `本地导入`
- `license`: `Personal`
- `pricingType`: `owned`
- `description`: `从本地文件导入的自定义词库`
- `tags`: `custom`, `local`

名称、描述、作者和标签在确认导入前可编辑。

## 信息架构与界面

词库中心分为三个区域。

### 本地词库

展示用户导入的本地词库。词库页只承担管理和练习入口，不放本地导入按钮；导入入口放在设置抽屉的“词库与项目”区域。空状态提示用户可以到设置中导入 JSON/TXT/CSV 自制练习内容。

本地词库卡片操作：

- 开始练习
- 导出
- 卸载

导出按钮下载标准 JSON 包。

### 在线已安装词库

展示从在线词库中心安装到浏览器本地的词库。

在线已安装词库卡片操作：

- 开始练习
- 卸载

### 在线词库中心

展示 registry 中的可安装词库，保留“刷新词库”和“安装/更新”操作。在线词库加载失败时，只显示在线区域错误，不影响本地词库使用。

## 导入交互

1. 用户打开设置抽屉，在“词库与项目”区域点击“导入本地词库”。
2. 文件选择器接受 `.json,.txt,.csv`。
3. 前端读取文件内容并解析。
4. 展示导入预览：
   - 词库名称、描述、作者、标签。
   - 文件类型。
   - 有效词条数。
   - 重复合并数。
   - 过滤词条数。
   - 前 12 个有效词条。
   - 过滤原因摘要。
5. 如果没有有效词条，禁用“确认导入”。
6. 用户确认后安装到 IndexedDB。
7. 保存后刷新已安装词库状态；如果用户当前位于词库页，本地词库列表同步更新。

标准 JSON 如果与已安装 ID 冲突，导入按钮显示“覆盖导入”。确认后覆盖原词库内容，来源标记为本地。

## 架构

### 领域层

在 `src/domain/vocabulary.ts` 增加本地导入和导出相关能力：

- `parseLocalVocabularyFile(fileName, text)`：按扩展名分派 JSON、TXT、CSV。
- `parsePlainVocabularyEntries(text)`：解析 TXT/CSV 行。
- `createLocalVocabularyPackage(meta, entries)`：生成标准词库包。
- `createVocabularyExportFile(packageRecord, entries)`：将已安装词库还原为可下载 JSON。

解析函数返回报告对象：

- `packageFile`
- `validCount`
- `filteredCount`
- `duplicateCount`
- `previewEntries`
- `filterReasons`

现有 `validateVocabularyPackage` 和 `buildVocabularyPracticeUnits` 保持最终规则来源。

### 存储层

`VocabularyPackageRecord` 增加：

- `sourceType: 'remote' | 'local'`
- `originalFileName?: string`

Dexie schema 升级到 version 3。旧数据迁移规则：

- 如果 `sourceUrl` 以 `local-file:` 开头，视为 `local`。
- 其他旧数据视为 `remote`。

`installVocabularyPackage` 增加可选参数：

```ts
{
  sourceType?: 'remote' | 'local';
  originalFileName?: string;
}
```

远程安装默认 `remote`，本地导入传 `local`。

新增查询能力：

- `listVocabularyPackagesBySource(sourceType)`

导出可复用现有 `getInstalledVocabularyPackage` 和 `listVocabularyEntries`，再交给领域层生成标准 JSON。

### 视图层

`SettingsDrawer.vue` 负责：

- 文件选择和读取。
- 调用领域解析函数。
- 展示预览和元信息编辑。
- 确认导入后调用存储层安装。
- 安装完成后发出 `vocabulary-imported` 事件。

`VocabulariesView.vue` 负责：

- 根据 `sourceType` 分离本地词库和在线已安装词库。
- 为本地词库提供 JSON 导出。
- 监听设置抽屉的 `vocabulary-imported` 事件并刷新本地词库列表。

### 练习层

`practiceStore.ts` 不新增来源判断。词库练习仍从已安装词库读取，用户点击任意本地或在线词库卡片的“开始练习”后，调用现有 `setVocabularyPackage(packageId)` 和 `setModule('vocabulary')`。

## 错误处理

- 文件读取失败：提示“文件读取失败，请重新选择文件”。
- JSON 语法错误：提示“JSON 格式不正确”。
- JSON 字段不完整：提示“词库文件格式不完整”。
- TXT/CSV 没有有效词条：禁用确认导入，提示“未找到可练习的纯中文词条”。
- 部分词条无效：不中断导入，在预览中显示过滤数量和原因摘要。
- ID 冲突：JSON 导入允许覆盖，本地简易导入自动生成新 ID。
- 导出失败：提示“导出失败，请稍后重试”，不影响词库本身。
- 在线词库加载失败：只影响在线词库中心，本地词库仍可管理和练习。

## 测试策略

### 单元测试

`tests/domain/vocabulary.test.ts`：

- TXT 一行一词解析。
- CSV 表头跳过。
- 权重和标签解析。
- 重复词条合并。
- 非法词条过滤。
- 默认元信息生成。
- 导出的 JSON 能再次通过 `validateVocabularyPackage`。

`tests/domain/vocabularyStorage.test.ts`：

- `sourceType` 存储。
- 按 `sourceType` 查询。
- 旧数据迁移后的默认来源。

### 组件测试

`tests/components/VocabulariesView.test.ts`：

- 渲染本地词库、在线已安装词库、在线词库中心三个区域。
- 确认词库页不展示本地导入入口。
- 本地词库显示导出按钮。
- 在线词库不显示导出按钮。

`tests/components/SettingsDrawer.test.ts`：

- 设置抽屉展示“词库与项目”区域和 GitHub 项目入口。
- 导入 TXT 后显示预览并安装为本地词库。
- 导入完成后发出 `vocabulary-imported` 事件。

### 端到端测试

增加基础路径：

- 导入 TXT。
- 导入入口位于设置抽屉。
- 点击开始练习。
- 确认练习页显示导入词库内容。

## 验收标准

- 用户可以导入标准 JSON 词库包。
- 用户可以导入 TXT/CSV 简易词表并编辑默认元信息。
- 词库中心明确区分本地词库、在线已安装词库、在线词库中心。
- 本地词库可以开始练习、导出 JSON、卸载。
- 在线词库仍可以刷新、安装、更新、开始练习和卸载。
- 无效词条不会导致整个导入失败，用户能看到过滤统计。
- 导出的 JSON 可以再次导入并生成相同词条集合。
- 现有词库练习、远程安装和已安装词库练习不回归。
