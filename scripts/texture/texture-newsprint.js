/* @inject-template-id: texture-newsprint */
/* 纹理背景：新闻纸
 * 给整个应用铺一层半调纸感纹理（全屏 fixed 覆盖层 + 混合模式）。
 * 启用：点击本代码块，或侧边栏「更多」tab 里点开加载；卸载即还原。
 * 注意：同名的多个纹理脚本同时只启用一个。
 */
(function () {
  var styleEl = document.createElement("style");
  styleEl.textContent = `body.itx::before {
  content: "";
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2147483001;
  background-image: var(--itx-image, none);
  background-repeat: var(--itx-repeat, repeat);
  background-size: var(--itx-size, auto);
  background-position: var(--itx-position, 0 0);
  background-color: var(--itx-bg, transparent);
  mix-blend-mode: var(--itx-blend, multiply);
  opacity: calc(var(--itx-base, 0.3) * var(--itx-opacity, 1));
}
body.itx-newsprint {
  --itx-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNCcgaGVpZ2h0PScxNCc+PGNpcmNsZSBjeD0nMycgY3k9JzMnIHI9JzEuOCcgZmlsbD0nJTIzMDAwJy8+PGNpcmNsZSBjeD0nMTAnIGN5PScxMCcgcj0nMS42JyBmaWxsPSclMjMwMDAnIG9wYWNpdHk9Jy43Jy8+PC9zdmc+");
  --itx-size: 14px 14px;
  --itx-blend: multiply;
  --itx-base: 0.5;
}
`;
  document.head.appendChild(styleEl);
  document.body.classList.add("itx", "itx-newsprint");
  $inject.onUnload(function () {
    document.body.classList.remove("itx", "itx-newsprint");
    styleEl.remove();
  });
})();
