/* @inject-template-id: texture-bg */
/* 纹理背景（挂件）
 * 侧边栏挂件：一键切换全局纹理背景（纸感 / 颗粒 / 织物），7 种内置 + 强度调节。
 * 全屏 fixed 覆盖层 + 混合模式，纯 CSS 程序化生成，轻量无图。
 *
 * 使用：插入后勾选 sidebar（默认），侧边栏「更多」tab 点开本挂件即可切换；
 * 选择与强度自动保存，下次加载自动恢复。
 */
(function () {
  var TEXTURES = ["newsprint", "embossedpaper", "noise", "wood", "granule", "feathery", "velvet"];
  var TEXTURE_CSS = `body.neo-texture::before {
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
  --neo-texture-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNCcgaGVpZ2h0PScxNCc+PGNpcmNsZSBjeD0nMycgY3k9JzMnIHI9JzEuNicgZmlsbD0nJTIzMDAwJy8+PGNpcmNsZSBjeD0nMTAnIGN5PScxMCcgcj0nMS42JyBmaWxsPSclMjMwMDAnIG9wYWNpdHk9Jy42Jy8+PC9zdmc+");
  --neo-texture-size: 14px 14px;
  --neo-texture-blend: multiply;
  --neo-texture-base: 0.3;
}
body.neo-texture-embossedpaper {
  --neo-texture-image: repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 3px), repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0 1px, transparent 1px 5px);
  --neo-texture-blend: multiply;
  --neo-texture-base: 0.5;
}
body.neo-texture-noise {
  --neo-texture-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMDAnIGhlaWdodD0nMjAwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC45JyBudW1PY3RhdmVzPScyJyBzdGl0Y2hUaWxlcz0nc3RpdGNoJy8+PGZlQ29sb3JNYXRyaXggdHlwZT0nc2F0dXJhdGUnIHZhbHVlcz0nMCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScyMDAnIGhlaWdodD0nMjAwJyBmaWx0ZXI9J3VybCgjbiknIG9wYWNpdHk9JzAuNTUnLz48L3N2Zz4=");
  --neo-texture-blend: soft-light;
  --neo-texture-base: 0.7;
}
body.neo-texture-wood {
  --neo-texture-image: repeating-linear-gradient(78deg, rgba(120,70,30,0.14) 0 7px, rgba(90,50,20,0.05) 7px 14px, rgba(145,90,40,0.11) 14px 21px, rgba(105,60,25,0.04) 21px 28px), repeating-linear-gradient(96deg, rgba(80,45,20,0.10) 0 11px, rgba(160,100,45,0.06) 11px 22px);
  --neo-texture-blend: multiply;
  --neo-texture-base: 0.6;
}
body.neo-texture-granule {
  --neo-texture-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNjAnIGhlaWdodD0nMTYwJz48ZmlsdGVyIGlkPSdnJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC41JyBudW1PY3RhdmVzPScxJyBzdGl0Y2hUaWxlcz0nc3RpdGNoJy8+PGZlQ29sb3JNYXRyaXggdHlwZT0nc2F0dXJhdGUnIHZhbHVlcz0nMCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScxNjAnIGhlaWdodD0nMTYwJyBmaWx0ZXI9J3VybCgjZyknIG9wYWNpdHk9JzAuNScvPjwvc3ZnPg==");
  --neo-texture-blend: overlay;
  --neo-texture-base: 0.6;
}
body.neo-texture-feathery {
  --neo-texture-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 5px);
  --neo-texture-blend: soft-light;
  --neo-texture-base: 0.7;
}
body.neo-texture-velvet {
  --neo-texture-image: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), transparent 45%), radial-gradient(circle at 72% 82%, rgba(0,0,0,0.07), transparent 50%);
  --neo-texture-blend: soft-light;
  --neo-texture-base: 0.7;
}
`;
  var WIDGET_CSS = `.tb { padding: 2px 4px; }
.tb-label { font-size: 12px; opacity: .7; margin-bottom: 6px; }
.tb-grid { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.tb-chip { border: 1px solid var(--orca-color-border, rgba(127,127,127,0.2)); background: transparent; color: inherit; border-radius: 6px; padding: 3px 8px; font-size: 12px; cursor: pointer; }
.tb-chip.tb-on { border-color: var(--orca-color-primary-5, #3b82f6); color: var(--orca-color-primary-5, #3b82f6); }
.tb-op { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.tb-range { flex: 1; }
.tb-op-val { opacity: .7; min-width: 26px; text-align: right; }`;

  var styleEl = null;
  var widgetStyle = null;
  var state = loadState();

  function loadState() {
    var s = $inject.storage.get("state") || {};
    return { texture: s.texture || "none", opacity: Number(s.opacity) || 1 };
  }
  function saveState() { $inject.storage.set("state", state); }

  function applyTexture() {
    TEXTURES.forEach(function (n) { document.body.classList.remove("neo-texture-" + n); });
    document.body.classList.remove("neo-texture");
    document.body.style.removeProperty("--neo-texture-opacity");
    if (!state.texture || state.texture === "none") return;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.textContent = TEXTURE_CSS;
      document.head.appendChild(styleEl);
    }
    document.body.classList.add("neo-texture", "neo-texture-" + state.texture);
    document.body.style.setProperty("--neo-texture-opacity", String(state.opacity));
  }

  function buildHtml() {
    return [
      '<div class="tb">',
      '<div class="tb-label">纹理背景</div>',
      '<div class="tb-grid">',
      '<button class=\"tb-chip\" data-t=\"none\">无</button>',
      '<button class=\"tb-chip\" data-t=\"newsprint\">新闻纸</button>',
      '<button class=\"tb-chip\" data-t=\"embossedpaper\">压纹纸</button>',
      '<button class=\"tb-chip\" data-t=\"noise\">噪点</button>',
      '<button class=\"tb-chip\" data-t=\"wood\">木纹</button>',
      '<button class=\"tb-chip\" data-t=\"granule\">颗粒</button>',
      '<button class=\"tb-chip\" data-t=\"feathery\">羽丝</button>',
      '<button class=\"tb-chip\" data-t=\"velvet\">绒面</button>',
      '</div>',
      '<div class="tb-op">',
      '<span>强度</span>',
      '<input type="range" class="tb-range" min="0" max="2" step="0.1" value="' + state.opacity + '">',
      '<span class="tb-op-val">' + state.opacity.toFixed(1) + '</span>',
      '</div>',
      '</div>',
    ];
  }

  var handle = $inject.registerSidebarGroup({
    key: "texture-bg",
    title: $inject.scriptName,
    icon: "ti ti-layers-subtract",
    parent: $inject.scriptGroup || undefined,
    status: "纹理",
    render: buildHtml,
    onFocus: function (container) {
      if (!widgetStyle) {
        widgetStyle = document.createElement("style");
        widgetStyle.textContent = WIDGET_CSS;
        document.head.appendChild(widgetStyle);
      }
      var root = container.querySelector(".tb");
      if (!root) return;
      var chips = Array.prototype.slice.call(root.querySelectorAll(".tb-chip"));
      var range = root.querySelector(".tb-range");
      var val = root.querySelector(".tb-op-val");

      function renderActive() {
        chips.forEach(function (c) {
          c.classList.toggle("tb-on", c.getAttribute("data-t") === state.texture);
        });
        range.value = state.opacity;
        val.textContent = state.opacity.toFixed(1);
      }

      chips.forEach(function (c) {
        c.addEventListener("click", function () {
          state.texture = c.getAttribute("data-t");
          saveState();
          applyTexture();
          renderActive();
        });
      });
      range.addEventListener("input", function () {
        state.opacity = Number(range.value);
        saveState();
        applyTexture();
        val.textContent = state.opacity.toFixed(1);
      });
      renderActive();
    },
  });

  // 加载即应用上次的选择；卸载清理
  applyTexture();
  $inject.onUnload(function () {
    TEXTURES.forEach(function (n) { document.body.classList.remove("neo-texture-" + n); });
    document.body.classList.remove("neo-texture");
    document.body.style.removeProperty("--neo-texture-opacity");
    try { handle.unregister(); } catch (e) {}
    if (styleEl) { styleEl.remove(); styleEl = null; }
    if (widgetStyle) { widgetStyle.remove(); widgetStyle = null; }
  });
})();
