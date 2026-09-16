# 双拼练习外置词库包

官方词库源是公共仓库 [IQueue/shuangpin-vocabularies](https://gitee.com/IQueue/shuangpin-vocabularies)，所有词库免费开放，无需登录或配置 token。

## 目录结构

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

## 本地开发

运行 `npm run dev`，在词库页即可读取和安装公共仓库中的词库，无需先发布网站。

Vite 接管 `/api/vocabularies/...`，复用 Cloudflare Pages Function 的代理逻辑读取 Gitee contents API，并把索引中的下载链接统一改为同域地址。

## 部署与更新

1. 将本目录下的词库文件上传到公共仓库的 `master` 分支，保持目录结构。
2. 部署到 Cloudflare Pages 时，保留 `functions/api/vocabularies/[[path]].ts`，由它提供同域接口。
3. 网站默认索引地址是 `/api/vocabularies/registry.json`，无需额外环境变量。需要覆盖索引地址时可设置 `VITE_VOCABULARY_REGISTRY_URL`。
4. 更新词库时同步更新词库版本和 `registry.json` 中的版本、词条数量。

## 注意

- 索引缓存 5 分钟，带版本的词库包缓存 1 天。
- 如果以后改用私有仓库，可在 Cloudflare Pages 服务端配置 `GITEE_ACCESS_TOKEN`；当前公共仓库不需要。
- 词库 JSON 必须是纯 JSON，不能写注释。
- 词条只能放纯中文，不要带标点、空格、英文、数字。
