# 双拼练习外置词库包

这个目录可以直接上传到 Gitee 仓库或 Gitee Pages，用作网站的外置词库源。

## 推荐目录

```text
registry.json
packages/
  daily-common@1.0.0.json
  work-study@1.0.0.json
  life-consumption@1.0.0.json
  easy-confuse@1.0.0.json
sources/
  VOCABULARY_SOURCES.md
```

## 部署步骤

1. 在 Gitee 新建公开仓库，例如 `shuangpin-vocabularies`。
2. 上传本目录下的所有文件，保持目录结构不变。
3. 网站默认通过 Cloudflare Pages Function 代理读取 Gitee raw 文件，不需要 Gitee 支持跨域。
4. 在练习网站部署环境里设置：

```text
VITE_VOCABULARY_REGISTRY_URL=/api/vocabularies/registry.json
```

## 注意

- 如果不用 Cloudflare Pages Function，才需要把 `registry.json` 里的下载地址替换为你的静态托管域名。
- 当前 `registry.json` 默认使用同域代理地址 `/api/vocabularies/...`。
- 词库 JSON 必须是纯 JSON，不能写注释。
- 词条只能放纯中文，不要带标点、空格、英文、数字。
- 付费词库不要公开放在 Gitee，Gitee 只适合免费词库分发。
