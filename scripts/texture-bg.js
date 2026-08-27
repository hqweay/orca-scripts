/* @inject-template-id: texture-bg */
/* 纹理背景
 * 给整个应用铺一层纸感 / 颗粒 / 织物纹理（全屏 fixed 覆盖层 + 混合模式）。
 * 7 种内置纹理（CSS 程序化生成，轻量无图），可在「脚本配置」里选纹理与强度。
 *
 * 使用：插入后勾选 autoRun（或点代码块加载），设置页「脚本配置」选纹理、调强度。
 * 强度 = 0 即关闭；1 为常规浓度。
 */
(function () {
  const TEXTURE_CSS = `body.neo-texture::before {
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
/* 新闻纸：半调网点 */
body.neo-texture-newsprint {
  --neo-texture-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNCcgaGVpZ2h0PScxNCc+PGNpcmNsZSBjeD0nMycgY3k9JzMnIHI9JzEuNicgZmlsbD0nJTIzMDAwJy8+PGNpcmNsZSBjeD0nMTAnIGN5PScxMCcgcj0nMS42JyBmaWxsPSclMjMwMDAnIG9wYWNpdHk9Jy42Jy8+PC9zdmc+");
  --neo-texture-size: 14px 14px;
  --neo-texture-blend: multiply;
  --neo-texture-base: 0.3;
}
/* 压纹纸：直纹（laid） */
body.neo-texture-embossedpaper {
  --neo-texture-image: repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 3px), repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0 1px, transparent 1px 5px);
  --neo-texture-blend: multiply;
  --neo-texture-base: 0.5;
}
/* 噪点：细颗粒噪点 */
body.neo-texture-noise {
  --neo-texture-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMDAnIGhlaWdodD0nMjAwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC45JyBudW1PY3RhdmVzPScyJyBzdGl0Y2hUaWxlcz0nc3RpdGNoJy8+PGZlQ29sb3JNYXRyaXggdHlwZT0nc2F0dXJhdGUnIHZhbHVlcz0nMCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScyMDAnIGhlaWdodD0nMjAwJyBmaWx0ZXI9J3VybCgjbiknIG9wYWNpdHk9JzAuNTUnLz48L3N2Zz4=");
  --neo-texture-blend: soft-light;
  --neo-texture-base: 0.7;
}
/* 木纹：多层暖棕渐变 */
body.neo-texture-wood {
  --neo-texture-image: repeating-linear-gradient(78deg, rgba(120,70,30,0.14) 0 7px, rgba(90,50,20,0.05) 7px 14px, rgba(145,90,40,0.11) 14px 21px, rgba(105,60,25,0.04) 21px 28px), repeating-linear-gradient(96deg, rgba(80,45,20,0.10) 0 11px, rgba(160,100,45,0.06) 11px 22px);
  --neo-texture-blend: multiply;
  --neo-texture-base: 0.6;
}
/* 颗粒：较粗颗粒 */
body.neo-texture-granule {
  --neo-texture-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNjAnIGhlaWdodD0nMTYwJz48ZmlsdGVyIGlkPSdnJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC41JyBudW1PY3RhdmVzPScxJyBzdGl0Y2hUaWxlcz0nc3RpdGNoJy8+PGZlQ29sb3JNYXRyaXggdHlwZT0nc2F0dXJhdGUnIHZhbHVlcz0nMCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScxNjAnIGhlaWdodD0nMTYwJyBmaWx0ZXI9J3VybCgjZyknIG9wYWNpdHk9JzAuNScvPjwvc3ZnPg==");
  --neo-texture-blend: overlay;
  --neo-texture-base: 0.6;
}
/* 羽丝：细斜向纤维 */
body.neo-texture-feathery {
  --neo-texture-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 5px);
  --neo-texture-blend: soft-light;
  --neo-texture-base: 0.7;
}
/* 绒面：柔光斑 */
body.neo-texture-velvet {
  --neo-texture-image: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), transparent 45%), radial-gradient(circle at 72% 82%, rgba(0,0,0,0.07), transparent 50%);
  --neo-texture-blend: soft-light;
  --neo-texture-base: 0.7;
}`;
  const TEXTURES = ["newsprint", "embossedpaper", "noise", "wood", "granule", "feathery", "velvet"];
  let styleEl = null;

  function applyTexture(name, opacity) {
    for (const n of TEXTURES) document.body.classList.remove("neo-texture-" + n);
    document.body.classList.remove("neo-texture");
    document.body.style.removeProperty("--neo-texture-opacity");
    if (!name || name === "none") return;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.textContent = TEXTURE_CSS;
      document.head.appendChild(styleEl);
    }
    document.body.classList.add("neo-texture", "neo-texture-" + name);
    document.body.style.setProperty("--neo-texture-opacity", String(opacity));
  }

  $inject.registerSettings(
    [
      {
        name: "texture",
        type: "select",
        label: "纹理",
        options: [
          { value: "none", label: "无" },
          { value: "newsprint", label: "新闻纸" },
          { value: "embossedpaper", label: "压纹纸" },
          { value: "noise", label: "噪点" },
          { value: "wood", label: "木纹" },
          { value: "granule", label: "颗粒" },
          { value: "feathery", label: "羽丝" },
          { value: "velvet", label: "绒面" },
        ],
        default: "none",
      },
      {
        name: "opacity",
        type: "number",
        label: "纹理强度（乘数）",
        default: 1,
      },
    ],
    undefined,
    (values) => applyTexture(values.texture, Number(values.opacity) || 1),
  );

  const cfg = $inject.config() || {};
  applyTexture(cfg.texture || "none", Number(cfg.opacity) || 1);

  $inject.onUnload(() => {
    applyTexture("none", 1);
    if (styleEl) { styleEl.remove(); styleEl = null; }
  });
})();
