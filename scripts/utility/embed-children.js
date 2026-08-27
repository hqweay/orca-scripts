/* @inject-template-id: embed-children */
/* 块嵌入子项
 * 让打上「块嵌入子项」标签的块,在作为镜像块嵌入到其他页面时,
 * 自动穿透展示它的全部子项,并应用无缝样式(去缩进、统一列表图标与缩进线)。
 *
 * 启用方式:
 *   1. 点击本代码块即可切换加载/卸载该样式;
 *   2. 或在「#脚本」标签属性中勾选 autoRun,启动时自动加载。
 *
 * 换一个触发标签:把下方所有 [data-name="块嵌入子项"] 一起替换即可。
 */
.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-main:not(.orca-repr-main-collapsed) {
  display: none;
}

.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children .orca-block[data-indent="3"] {
  --orca-block-indent: 2 !important;
}
.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children .orca-block[data-indent="4"] {
  --orca-block-indent: 3 !important;
}
.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children .orca-block[data-indent="5"] {
  --orca-block-indent: 4 !important;
}
.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children .orca-block[data-indent="6"] {
  --orca-block-indent: 5 !important;
}
.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children .orca-block[data-indent="7"] {
  --orca-block-indent: 6 !important;
}
.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children .orca-block[data-indent="8"] {
  --orca-block-indent: 7 !important;
}
.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children .orca-block[data-indent="9"] {
  --orca-block-indent: 8 !important;
}
.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children .orca-block[data-indent="10"] {
  --orca-block-indent: 9 !important;
}

.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children > .orca-block[data-type="ul"] > .orca-repr > .orca-repr-main .orca-block-handle:not(:hover) {
  font-family: tabler-icons !important;
  font-style: normal;
  font-weight: 400;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  --my-size-bullet: 16px;
  width: var(--my-size-bullet);
  height: var(--my-size-bullet);
  font-size: 19px;
  display: flex;
  justify-content: center;
  align-items: center;
  top: calc(0.5 * (var(--orca-block-line-height) - var(--my-size-bullet)));
  /* 统一 icon、color、bg */
}
.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children > .orca-block[data-type="ul"] > .orca-repr > .orca-repr-main .orca-block-handle:not(:hover):before {
  content: "\ff8d";
  font-size: unset;
  /* 覆盖掉 ul 的特殊颜色,采用默认颜色 */
  color: var(--orca-block-handle-passive-color);
}
.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children > .orca-block[data-type="ul"] > .orca-repr > .orca-repr-main .orca-block-handle:not(:hover).orca-block-handle-collapsed:before {
  width: unset;
  height: unset;
  background-color: unset;
}

.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children > .orca-block[data-type="ul"] > .orca-repr > .orca-repr-main .orca-repr-scope-line:before {
  border-left: 2px dashed var(--orca-color-scope-line);
}
.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children > .orca-block[data-type="ul"] > .orca-repr > .orca-repr-main .orca-repr-scope-line:hover {
  background-color: unset;
}
.orca-repr-main:has(span[data-name="块嵌入子项"]) + .orca-repr-children > .orca-block[data-type="mirror"] > .orca-repr > .orca-repr-children > .orca-block[data-type="ul"] > .orca-repr > .orca-repr-main .orca-repr-scope-line:hover:before {
  border-left-width: 3px;
}
