# orca-scripts

虎鲸笔记（Orca Note）用户脚本注册表：lets-inject 插件的「脚本更新」功能从这里拉取索引与脚本源码。

## 结构

- `registry.json` — 脚本索引（id / name / version / file）
- `scripts/<id>.js` — 脚本源码；头部带 `// @inject-template-id: <id>` 自描述标记

## 发布流程

1. 修改 `scripts/` 下对应脚本，**递增 registry.json 里的 version**
2. 提交推送。插件端「检查更新」即可拉到新版本并一键更新已插入的实例

> 脚本源与 monorepo 模板库当前为双源同步：改模板后需手动同步到这里（或反之），注意别漂移。
