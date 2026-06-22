# 双拼练习外置词库包

这个目录可以上传到 Gitee 仓库，用作网站的外置词库源。启用赞助会员后，官方词库包建议放在 Gitee 私有仓库，只允许 Cloudflare Pages Function 通过 `GITEE_ACCESS_TOKEN` 读取。

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

1. 在 Gitee 新建私有仓库，例如 `shuangpin-vocabularies`。
2. 上传本目录下的所有文件，保持目录结构不变。
3. 网站默认通过 Cloudflare Pages Function 代理读取 Gitee contents API，不需要 Gitee 支持跨域。
4. 在练习网站部署环境里设置：

```text
VITE_VOCABULARY_REGISTRY_URL=/api/vocabularies/registry.json
GITEE_ACCESS_TOKEN=你的 Gitee 私有仓库 token
```

## 注意

- 如果不用 Cloudflare Pages Function，才需要把 `registry.json` 里的下载地址替换为你的静态托管域名。
- 当前 `registry.json` 默认使用同域代理地址 `/api/vocabularies/...`。
- 词库 JSON 必须是纯 JSON，不能写注释。
- 词条只能放纯中文，不要带标点、空格、英文、数字。
- 会员词库不要公开放在 Gitee Pages 或 raw 静态地址，应由后端代理鉴权后读取。
