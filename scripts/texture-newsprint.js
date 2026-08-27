/* @inject-template-id: texture-newsprint */
/* 纹理背景：新闻纸
 * 给整个应用铺一层半调纸感纹理（全屏 fixed 覆盖层 + 混合模式）。
 * 启用：点击本代码块，或侧边栏「更多」tab 里点开加载；卸载即还原。
 * 注意：同名的多个纹理脚本同时只启用一个。
 */
(function () {
  var styleEl = document.createElement("style");
  styleEl.textContent = `body.neo-texture::before {
  content: "";
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2147483001;
  background-image: var(--neo-texture-image, none);
  background-repeat: var(--neo-texture-repeat, repeat);
  background-size: var(--neo-texture-size, auto);
  background-position: var(--neo-texture-position, 0 0);
  background-color: var(--neo-texture-bg, transparent);
  mix-blend-mode: var(--neo-texture-blend, multiply);
  opacity: calc(var(--neo-texture-base, 0.3) * var(--neo-texture-opacity, 1));
}
body.neo-texture-newsprint {
  --neo-texture-image: url("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB3aWR0aD0iNTA4bW0iCiAgIGhlaWdodD0iMjg1Ljc1bW0iCiAgIHZpZXdCb3g9IjAgMCA1MDggMjg1Ljc1IgogICB2ZXJzaW9uPSIxLjEiCiAgIGlkPSJzdmcxIgogICB4bWw6c3BhY2U9InByZXNlcnZlIgogICB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzCiAgICAgaWQ9ImRlZnMxIj48ZmlsdGVyCiAgICAgICBzdHlsZT0iY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzOnNSR0IiCiAgICAgICBpZD0iZmlsdGVyMTAxIgogICAgICAgeD0iMCIKICAgICAgIHk9IjAiCiAgICAgICB3aWR0aD0iMSIKICAgICAgIGhlaWdodD0iMSI+PGZlVHVyYnVsZW5jZQogICAgICAgICBpZD0iZmVUdXJidWxlbmNlMTAxIgogICAgICAgICBiYXNlRnJlcXVlbmN5PSIwLjAyMDAwMDAwMDAwMDAwMDAxMSIKICAgICAgICAgbnVtT2N0YXZlcz0iOSIKICAgICAgICAgc2VlZD0iMTAiCiAgICAgICAgIHR5cGU9ImZyYWN0YWxOb2lzZSIgLz48ZmVEaWZmdXNlTGlnaHRpbmcKICAgICAgICAgaWQ9ImZlRGlmZnVzZUxpZ2h0aW5nMTAxIgogICAgICAgICBzdXJmYWNlU2NhbGU9IjIuMDQ5OTk5OTUiCiAgICAgICAgIGRpZmZ1c2VDb25zdGFudD0iMSI+PGZlRGlzdGFudExpZ2h0CiAgICAgICAgICAgaWQ9ImZlRGlzdGFudExpZ2h0MTAzIgogICAgICAgICAgIGF6aW11dGg9Ijc1IgogICAgICAgICAgIGVsZXZhdGlvbj0iNTAiIC8+PC9mZURpZmZ1c2VMaWdodGluZz48L2ZpbHRlcj48L2RlZnM+PGcKICAgICBpZD0ibGF5ZXIxIgogICAgIHRyYW5zZm9ybT0idHJhbnNsYXRlKC0xNTU0KSI+PHJlY3QKICAgICAgIHN0eWxlPSJvcGFjaXR5OjE7ZmlsbDojN2I0OTM4O2ZpbGwtb3BhY2l0eToxO3N0cm9rZS13aWR0aDoyLjY0NTgzO2ZpbHRlcjp1cmwoI2ZpbHRlcjEwMSkiCiAgICAgICBpZD0icmVjdDEwMSIKICAgICAgIHdpZHRoPSI1MDgiCiAgICAgICBoZWlnaHQ9IjI4NS43NSIKICAgICAgIHg9IjE1NTQiCiAgICAgICB5PSItNC45NzM3OTkyZS0xNCIgLz48L2c+PC9zdmc+Cg==");
  --neo-texture-size: 14px 14px;
  --neo-texture-blend: multiply;
  --neo-texture-base: 0.3;
}
`;
  document.head.appendChild(styleEl);
  document.body.classList.add("neo-texture", "neo-texture-newsprint");
  $inject.onUnload(function () {
    document.body.classList.remove("neo-texture", "neo-texture-newsprint");
    styleEl.remove();
  });
})();
