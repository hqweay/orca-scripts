/* @inject-template-id: custom-bg */
/* 自定义背景（挂件）
 * 侧边栏挂件：把图片拖进来（本地文件 / 图片链接 / 笔记图片块）作为全局背景。
 * 支持保留多张图片：拖入的图片进图库，点缩略图切换背景，可单独移除。
 * 图片作为应用主背景（cover 铺满），图库自动保存。
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
.itx-bg-drop { border: 1.5px dashed var(--orca-color-border, rgba(127,127,127,0.4)); border-radius: 8px; padding: 12px 8px; text-align: center; font-size: 12px; opacity: .78; cursor: pointer; }
.itx-bg-drop.itx-drop-active { border-color: var(--orca-color-primary-5, #3b82f6); background: rgba(59,130,246,0.08); opacity: 1; }
.itx-bg-preview { margin-top: 8px; height: 72px; border-radius: 6px; background-size: cover; background-position: center; border: 1px solid var(--orca-color-border, rgba(127,127,127,0.2)); }
.itx-bg-thumbs { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
.itx-bg-thumb { position: relative; width: 44px; height: 44px; border-radius: 6px; background-size: cover; background-position: center; border: 1.5px solid transparent; cursor: pointer; opacity: .8; }
.itx-bg-thumb.itx-on { border-color: var(--orca-color-primary-5, #3b82f6); opacity: 1; }
.itx-bg-thumb-x { position: absolute; top: -5px; right: -5px; width: 14px; height: 14px; line-height: 13px; text-align: center; border-radius: 50%; background: var(--orca-color-danger, #d33); color: #fff; font-size: 10px; cursor: pointer; }
.itx-bg-empty { margin-top: 8px; font-size: 12px; opacity: .55; }
.itx-bg-actions { margin-top: 8px; }
.itx-bg-clear { border: 1px solid var(--orca-color-border, rgba(127,127,127,0.25)); background: transparent; color: inherit; border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
.itx-bg-clear:hover { border-color: var(--orca-color-danger, #d33); color: var(--orca-color-danger, #d33); }`;

  var MAX_IMAGES = 6;
  var styleEl = null;
  var widgetStyle = null;
  var state = loadState();
  var detachDrop = null;
  var containerRef = null;

  function loadState() {
    var s = $inject.storage.get("state") || {};
    return {
      list: Array.isArray(s.list) ? s.list : [],
      current: s.current || "",
    };
  }
  function saveState() {
    try {
      $inject.storage.set("state", { list: state.list.slice(0, MAX_IMAGES), current: state.current });
    } catch (e) {
      orca.notify("error", "图库保存失败（图片可能过大），已保留当前背景");
      $inject.storage.set("state", { list: [{ src: state.current, name: "", at: Date.now() }], current: state.current });
    }
  }

  function bgUrl(src) {
    return "url(\"" + String(src).replace(/"/g, '\\"') + "\")";
  }

  /** 相对路径 → 可加载的资产 URL（对齐 workbench random 的 resolveAssetUrl）。 */
  function resolveAssetUrl(src) {
    if (!src) return "";
    if (/^(https?:|data:|blob:)/i.test(src)) return src;
    var o = (window.orca && orca.state) || {};
    var dir = (o.repoDir || "").trim();
    if (!dir && o.dataDir && o.repo) {
      dir = (String(o.dataDir).replace(/\/+$/, "") + "/repos/" + o.repo);
    }
    if (!dir) return "";
    var name = String(src).replace(/^\.?\//, "").split(/[?#]/)[0];
    return "file://" + dir + "/assets/" + encodeURI(name);
  }

  function applyBg() {
    document.body.classList.remove("itx-bg");
    document.body.style.removeProperty("--itx-bg-image");
    if (!state.current) return;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.textContent = BG_CSS;
      document.head.appendChild(styleEl);
    }
    document.body.classList.add("itx-bg");
    document.body.style.setProperty("--itx-bg-image", bgUrl(state.current));
  }

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

  function addImage(src, name) {
    state.list = state.list.filter(function (it) { return it.src !== src; });
    state.list.push({ src: src, name: name || "", at: Date.now() });
    if (state.list.length > MAX_IMAGES) state.list = state.list.slice(-MAX_IMAGES);
    state.current = src;
    saveState();
    applyBg();
    renderWidget();
  }
  function removeImage(src) {
    state.list = state.list.filter(function (it) { return it.src !== src; });
    if (state.current === src) {
      state.current = state.list.length ? state.list[state.list.length - 1].src : "";
    }
    saveState();
    applyBg();
    renderWidget();
  }

  function hasBlockPayload(dt) {
    if (!dt || !dt.types) return false;
    return Array.prototype.some.call(dt.types, function (t) {
      var parts = String(t).split("/");
      return parts.length === 2 && parts[0] === "orca";
    });
  }

  async function handleDrop(dt) {
    var src = null;
    var name = "";
    if (dt && dt.files && dt.files.length) {
      var f = dt.files[0];
      if (f.type && f.type.indexOf("image") === 0) {
        src = await readImageFile(f);
        src = await downscaleDataUrl(src, 1920);
        name = f.name || "";
      }
    }
    if (!src && dt) {
      var uri = dt.getData("text/uri-list") || dt.getData("text/plain");
      if (uri) { src = uri.trim().split("\n")[0]; name = src; }
    }
    if (src) {
      addImage(src, name);
      orca.notify("success", "已加入背景图库");
    } else {
      orca.notify("warn", "没识别到图片（支持文件 / 图片链接 / 笔记图片块）");
    }
  }

  async function handleBlockDrops(ids) {
    if (!ids || !ids.length) return;
    var blocks = (await orca.invokeBackend("get-blocks", ids)) || [];
    for (var i = 0; i < blocks.length; i++) {
      var props = (blocks[i].properties || []);
      var repr = null;
      for (var j = 0; j < props.length; j++) { if (props[j].name === "_repr") repr = props[j].value; }
      if (repr && repr.type === "image" && repr.src) {
        // 相对路径 → file:// 资产 URL（对齐 random 的换算），解析不出就跳过
        var url = resolveAssetUrl(repr.src);
        if (url) {
          addImage(url, "图片块");
          orca.notify("success", "已加入背景图库（图片块）");
          return;
        }
        orca.notify("warn", "图片块地址解析失败: " + repr.src);
        return;
      }
    }
    orca.notify("warn", "拖入的块不是图片块");
  }

  function buildHtml() {
    var thumbs = state.list.map(function (it, i) {
      return '<div class="itx-bg-thumb' + (it.src === state.current ? ' itx-on' : '') + '" data-i="' + i + '" style="background-image:' + bgUrl(it.src) + '">' +
        '<span class="itx-bg-thumb-x" data-x="' + i + '" title="移除">×</span></div>';
    }).join("");
    return [
      '<div class="itx-bg-widget">',
      '<div class="itx-bg-label">自定义背景（' + state.list.length + '/' + MAX_IMAGES + '）</div>',
      '<div class="itx-bg-drop">把图片拖到这里<br><small style="opacity:.6">本地文件 / 图片链接 / 笔记图片块</small></div>',
      state.current ? '<div class="itx-bg-preview" style="background-image:' + bgUrl(state.current) + '"></div>' : '',
      state.list.length ? '<div class="itx-bg-thumbs">' + thumbs + '</div>' : '<div class="itx-bg-empty">还没有图片，拖一张进来</div>',
      '<div class="itx-bg-actions"><button class="itx-bg-clear">清除全部</button></div>',
      '</div>',
    ].join("");
  }

  function bindWidget(container) {
    var drop = container.querySelector(".itx-bg-drop");
    var clear = container.querySelector(".itx-bg-clear");
    if (drop) {
      drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("itx-drop-active"); });
      drop.addEventListener("dragleave", function () { drop.classList.remove("itx-drop-active"); });
      drop.addEventListener("drop", function (e) {
        e.preventDefault();
        drop.classList.remove("itx-drop-active");
        var dt = e.dataTransfer;
        // 块拖拽（orca/* 载荷）→ 不拦截，交给容器层的 attachBlockDrop 解析
        if (hasBlockPayload(dt)) return;
        e.stopPropagation();
        void handleDrop(dt);
      });
    }
    if (clear) {
      clear.addEventListener("click", function () {
        state.list = [];
        state.current = "";
        saveState();
        applyBg();
        renderWidget();
      });
    }
    // 缩略图点击切换 / × 移除（事件委托在容器上，重渲染后仍有效）
    container.addEventListener("click", function (e) {
      var x = e.target.closest(".itx-bg-thumb-x");
      if (x) {
        var xi = Number(x.getAttribute("data-x"));
        var it = state.list[xi];
        if (it) removeImage(it.src);
        return;
      }
      var t = e.target.closest(".itx-bg-thumb");
      if (t) {
        var ti = Number(t.getAttribute("data-i"));
        var item = state.list[ti];
        if (item) {
          state.current = item.src;
          saveState();
          applyBg();
          renderWidget();
        }
      }
    });
  }

  function renderWidget() {
    try { handle.setStatus(state.current ? "背景 " + state.list.length + " 张" : "无背景"); } catch (e) {}
    if (!containerRef) return;
    containerRef.innerHTML = buildHtml();
    bindWidget(containerRef);
  }

  var handle = $inject.registerSidebarGroup({
    key: "custom-bg",
    title: $inject.scriptName,
    icon: "ti ti-photo",
    parent: $inject.scriptGroup || undefined,
    status: state.current ? "背景 " + state.list.length + " 张" : "无背景",
    render: function () { return buildHtml(); },
    onFocus: function (container) {
      if (!widgetStyle) {
        widgetStyle = document.createElement("style");
        widgetStyle.textContent = WIDGET_CSS;
        document.head.appendChild(widgetStyle);
      }
      containerRef = container;
      container.innerHTML = buildHtml();
      bindWidget(container);
      // 笔记图片块拖入（容器层，接收块拖拽）
      if (!detachDrop) detachDrop = $inject.attachBlockDrop(container, function (ids) { void handleBlockDrops(ids); });
      return function () {
        if (detachDrop) { try { detachDrop(); } catch (e) {} detachDrop = null; }
      };
    },
  });

  applyBg();
  $inject.onUnload(function () {
    document.body.classList.remove("itx-bg");
    document.body.style.removeProperty("--itx-bg-image");
    try { handle.unregister(); } catch (e) {}
    if (styleEl) { styleEl.remove(); styleEl = null; }
    if (widgetStyle) { widgetStyle.remove(); widgetStyle = null; }
  });
})();
