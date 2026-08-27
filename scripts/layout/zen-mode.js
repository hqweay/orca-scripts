// @inject-template-id: zen-mode
/* 禅模式
 * 沉浸式写作:隐藏头部工具/面板拖拽柄/块编辑器侧栏等干扰元素,
 * 聚焦块高亮显示,其余内容虚化模糊。
 *
 * 启用方式:
 *   1. 点击本代码块即可切换加载/卸载该样式;
 *   2. 或在「#脚本」标签属性中勾选 autoRun,启动时自动加载。
 *
 * 注意:隐藏的元素只在未聚焦时消失,点击页面任意位置聚焦即可唤出交互。
 */
.orca-headbar-sidebar-tools,
.orca-headbar-global-tools,
.orca-headbar-user-tools>button:not(.lets-inject-btn),
.orca-panel-drag-handle,
.orca-block-editor-sidetools,
.orca-block-editor-go-btns,
.orca-block-editor-query-tabs-container,
.orca-block-editor-query-views,
.orca-repr-scope-line,
.orca-block-ref-count-marker {
  visibility: hidden;
}
.orca-repr-main {
  opacity: 0.1;
  filter: blur(5px);
}
.orca-block.orca-active>.orca-repr>.orca-repr-main {
  opacity: 1 !important;
  filter: none;
}
.orca-repr:has(>.orca-repr-children>.orca-block.orca-active)>.orca-repr-main,
.orca-block:not(.orca-active):has(+.orca-block.orca-active)>.orca-repr>.orca-repr-main,
.orca-block.orca-active+.orca-block:not(.orca-active)>.orca-repr>.orca-repr-main {
  opacity: 0.25;
  filter: none;
}
