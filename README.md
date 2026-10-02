# orca-scripts

虎鲸笔记（Orca Note）用户脚本注册表：lets-inject 插件的「脚本更新」从这里拉取索引与脚本源码；lets-workbench 的「市场卡片」从这里拉取卡片索引与 HTML fragment。

## 结构

- `scripts.json` — 脚本索引
- `scripts/<category>/<id>.js|css` — 脚本源码；头部带 `// @inject-template-id: <id>` 自描述标记（CSS 用 `/* */`）
- `cards.json` — 卡片索引（id / name / version / file / category）
- `cards/<id>.js` — 卡片 HTML fragment；头部带 `<!-- @inject-template-id: <id> -->` 自描述标记

## 条目字段

必填：`id`（全局唯一）、`name`、`version`（每次改动 +1）、`file`（相对所属目录）、`description`。

可选：

| 字段 | 说明 |
|---|---|
| `lang` | `css` 脚本插入为 CSS 代码块并在启动时注入为 `<style>`；缺省 `javascript` |
| `category` | 分类 id。`texture`（全屏纹理）/ `material`（菜单弹层材质）/ `layout` / `widget` / `utility` / `ai`；未登记的分类市场里仍会出现在「全部」下 |
| `tagProps` | 插入时应用的 `#脚本` 标签属性（`sidebar` / `shortcut` / `group` 等），缺省 `sidebar: true` |
| `author` | 作者显示名。**收编第三方作品必填** |
| `source` | 原文链接或纯文本出处；http(s) 开头时市场里渲染成可点链接 |
| `license` | 授权声明。**收编第三方作品必填**；作者未表态就在文件头写「待确认」并暂不在 `scripts.json` 里填，拿到授权后再补上——不要替作者选一个 |
| `icon` | 覆盖市场/侧边栏图标（tabler 类名，如 `ti ti-brush`）；缺省按语言与分类推导 |
| `changelog` | 本版本变更说明（一句话）；市场仅在「可更新」时展示 |

第三方作品另需在**脚本文件头部**写明作者 / 来源 / 授权（对齐 `scripts/texture/texture-newsprint.js` 的做法），
使代码脱离注册表后仍可追溯出处。

## 自检

提交前跑一次卡片检查（标记一致性 / 语法 / 配置契约 / 死配置）：

```bash
node tools/check-cards.mjs
```

## 发布流程

1. 修改 `scripts/` 下对应脚本/卡片，**递增 scripts.json / cards.json 里的 version**
2. 提交推送。插件端「检查更新」即可拉到新版本并一键更新已插入的实例

> 脚本源与 monorepo 模板库当前为双源同步：改模板后需手动同步到这里（或反之），注意别漂移。
