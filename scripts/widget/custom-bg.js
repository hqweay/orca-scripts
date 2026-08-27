/* @inject-template-id: custom-bg */
/* 自定义背景（挂件）
 * 侧边栏挂件：把图片拖进来（本地文件 / 图片链接 / 笔记里的图片块）作为全局背景。
 * 图片作为应用主背景（cover 铺满），选择自动保存，可一键清除。
 *
 * 参考：https://github.com/Eon-Wen/Orca-neo（自定义背景图实现；类名/变量改为 itx 命名空间）。
 */
(function () {
  var BG_CSS = `body.itx-bg #main,
body.itx-bg .orca-panels-container {
  background-image: var(--itx-bg-image);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}`;
  var WIDGET_CSS = `.itx-bg-widget { padding: 2px 4px; }
.itx-bg-label { font-size: 12px; opacity: .7; margin-bottom: 6px; }
.itx-bg-drop { border: 1.5px dashed var(--orca-color-border, rgba(127,127,127,0.4)); border-radius: 8px; padding: 14px 8px; text-align: center; font-size: 12px; opacity: .78; cursor: pointer; }
.itx-bg-drop.itx-drop-active { border-color: var(--orca-color-primary-5, #3b82f6); background: rgba(59,130,246,0.08); opacity: 1; }
.itx-bg-preview { margin-top: 8px; height: 72px; border-radius: 6px; background-size: cover; background-position: center; border: 1px solid var(--orca-color-border, rgba(127,127,127,0.2)); }
.itx-bg-actions { margin-top: 8px; display: flex; gap: 6px; }
.itx-bg-clear { border: 1px solid var(--orca-color-border, rgba(127,127,127,0.25)); background: transparent; color: inherit; border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
.itx-bg-clear:hover { border-color: var(--orca-color-danger, #d33); color: var(--orca-color-danger, #d33); }`;

  var styleEl = null;
  var widgetStyle = null;
  var state = loadState();
  var detachDrop = null;

  function loadState() {
    var s = $inject.storage.get("state") || {};
    return { src: s.src || "", opacity: Number(s.opacity) || 1 };
  }
  function saveState() { $inject.storage.set("state", state); }

  function bgUrl(src) {
    return "url(\"" + String(src).replace(/"/g, '\\"') + "\")";
  }

  function applyBg() {
    document.body.classList.remove("itx-bg");
    document.body.style.removeProperty("--itx-bg-image");
    if (!state.src) return;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.textContent = BG_CSS;
      document.head.appendChild(styleEl);
    }
    document.body.classList.add("itx-bg");
    document.body.style.setProperty("--itx-bg-image", bgUrl(state.src));
  }

  /** 本地图片文件 → data URL（超宽图用 canvas 降采样到 1920px，避免背景太大）。 */
  function readImageFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  function downscaleDataUrl(dataUrl, maxDim) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        if (img.width <= maxDim && img.height <= maxDim) { resolve(dataUrl); return; }
        var scale = maxDim / Math.max(img.width, img.height);
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }

  async function handleDrop(dt) {
    var src = null;
    if (dt && dt.files && dt.files.length) {
      var f = dt.files[0];
      if (f.type && f.type.indexOf("image") === 0) {
        src = await readImageFile(f);
        src = await downscaleDataUrl(src, 1920);
      }
    }
    if (!src && dt) {
      var uri = dt.getData("text/uri-list") || dt.getData("text/plain");
      if (uri) src = uri.trim().split("\n")[0];
    }
    if (src) {
      state.src = src;
      saveState();
      applyBg();
      refreshUi();
      orca.notify("success", "背景已应用");
    } else {
      orca.notify("warn", "没识别到图片（支持文件 / 图片链接 / 笔记图片块）");
    }
  }

  async function handleBlockDrops(ids) {
    if (!ids || !ids.length) return;
    var blocks = (await orca.invokeBackend("get-blocks", ids)) || [];
    for (var i = 0; i < blocks.length; i++) {
      var repr = (blocks[i].properties || []).find(function (p) { return p.name === "_repr"; })?.value;
      if (repr && repr.type === "image" && repr.src) {
        state.src = repr.src;
        saveState();
        applyBg();
        refreshUi();
        orca.notify("success", "背景已应用（图片块）");
        return;
      }
    }
    orca.notify("warn", "拖入的块不是图片块");
  }

  function buildHtml() {
    return [
      '<div class="itx-bg-widget">',
      '<div class="itx-bg-label">自定义背景</div>',
      '<div class="itx-bg-drop">把图片拖到这里<br><small style="opacity:.6">本地文件 / 图片链接 / 笔记图片块</small></div>',
      state.src ? '<div class="itx-bg-preview" id="itx-bg-preview" style="background-image:' + bgUrl(state.src) + '"></div>' : '',
      '<div class="itx-bg-actions">',
      '<button class="itx-bg-clear">清除背景</button>',
      '</div>',
      '</div>',
    ].join("");
  }

  function refreshUi() {
    try {
      handle.setStatus(state.src ? "自定义背景" : "无背景");
    } catch (e) {}
    if (!widgetStyle) return;
    var root = document.querySelector(".itx-bg-widget");
    if (root) {
      var preview = root.querySelector("#itx-bg-preview");
      if (preview) preview.style.backgroundImage = bgUrl(state.src);
      var drop = root.querySelector(".itx-bg-drop");
      if (drop) drop.innerHTML = state.src ? "已应用，可再拖图片替换" : "把图片拖到这里<br><small style=\"opacity:.6\">本地文件 / 图片链接 / 笔记图片块</small>";
    }
  }

  var handle = $inject.registerSidebarGroup({
    key: "custom-bg",
    title: $inject.scriptName,
    icon: "ti ti-photo",
    parent: $inject.scriptGroup || undefined,
    status: state.src ? "自定义背景" : "无背景",
    render: buildHtml,
    onFocus: function (container) {
      if (!widgetStyle) {
        widgetStyle = document.createElement("style");
        widgetStyle.textContent = WIDGET_CSS;
        document.head.appendChild(widgetStyle);
      }
      var drop = container.querySelector(".itx-bg-drop");
      var clear = container.querySelector(".itx-bg-clear");
      if (drop) {
        drop.addEventListener("dragover", function (e) {
          e.preventDefault();
          e.stopPropagation();
          drop.classList.add("itx-drop-active");
        });
        drop.addEventListener("dragleave", function () { drop.classList.remove("itx-drop-active"); });
        drop.addEventListener("drop", function (e) {
          e.preventDefault();
          e.stopPropagation();
          drop.classList.remove("itx-drop-active");
          void handleDrop(e.dataTransfer);
        });
      }
      if (clear) {
        clear.addEventListener("click", function () {
          state.src = "";
          saveState();
          applyBg();
          refreshUi();
        });
      }
      // 笔记图片块拖入
      if (!detachDrop) detachDrop = $inject.attachBlockDrop(container, function (ids) { void handleBlockDrops(ids); });
      return function () {
        if (detachDrop) { try { detachDrop(); } catch (e) {} detachDrop = null; }
      };
    },
  });

  // 加载即应用上次的选择；卸载清理
  applyBg();
  $inject.onUnload(function () {
    applyBgToNone();
    try { handle.unregister(); } catch (e) {}
    if (styleEl) { styleEl.remove(); styleEl = null; }
    if (widgetStyle) { widgetStyle.remove(); widgetStyle = null; }
  });
  function applyBgToNone() {
    document.body.classList.remove("itx-bg");
    document.body.style.removeProperty("--itx-bg-image");
  }
})();
