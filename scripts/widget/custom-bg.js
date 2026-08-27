/* @inject-template-id: custom-bg */
/* 自定义背景（挂件）
 * 侧边栏挂件：把图片拖进来（本地文件 / 图片链接 / 笔记图片块）作为全局背景。
 * 支持保留多张图片：拖入的图片进图库，点缩略图切换背景，可单独移除。
 *
 * 图片存储策略（对齐 orca-neo / workbench random 的资产机制）：
 *   - 本地文件：优先用 File.path 绝对路径 → file:// 直接渲染（零存储、零上传）；
 *     无 path 的 Electron 版本退化为降采样后 upload-asset-binary 存入仓库 assets，
 *     渲染用 file://<repoDir>/assets/<name> 绝对路径（无 base64 膨胀）；
 *   - 图片链接：直接存 URL；
 *   - 笔记图片块：读 _repr.src（相对路径）同样转 file:// 渲染。
 * 自愈：全局背景挂在 body 的 class/变量上，生命周期不受控，MutationObserver 观察
 * body 的 class/style 被外部改动后防抖补画（写前先比较，值一致跳过，避免自触发循环）。
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
  var bgObserver = null;
  var state = loadState();
  var detachDrop = null;
  var containerRef = null;

  function currentRaw() {
    var it = state.list[state.idx];
    return it ? it.src : "";
  }

  /** 相对路径 → file:// 绝对路径；外链原样（对齐 workbench random 的 resolveAssetUrl）。 */
  function resolveAssetUrl(src) {
    if (!src) return "";
    if (/^(https?:|data:|blob:|file:)/i.test(src)) return src;
    var o = (window.orca && orca.state) || {};
    var dir = (o.repoDir || "").trim();
    if (!dir && o.dataDir && o.repo) {
      dir = (String(o.dataDir).replace(/\/+$/, "") + "/repos/" + o.repo);
    }
    if (!dir) return "";
    var name = String(src).replace(/^\.?\//, "").split(/[?#]/)[0];
    return "file://" + dir + "/assets/" + encodeURI(name);
  }
  function resolved(src) { return resolveAssetUrl(src) || src || ""; }

  function loadState() {
    var s = $inject.storage.get("state") || {};
    var list = Array.isArray(s.list) ? s.list : [];
    var idx = Number(s.idx);
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) idx = list.length - 1;
    return { list: list, idx: idx };
  }
  function saveState() {
    try {
      $inject.storage.set("state", { list: state.list.slice(0, MAX_IMAGES), idx: state.idx });
    } catch (e) {
      orca.notify("error", "图库保存失败，已保留当前背景");
      var cur = currentRaw();
      $inject.storage.set("state", { list: [{ src: cur, name: "", at: Date.now() }], idx: 0 });
    }
  }

  function bgUrl(src) {
    return 'url("' + String(src).replace(/"/g, '\\"') + '")';
  }
  function bgUrlHtml(src) {
    return "url('" + String(src).replace(/'/g, "\\'") + "')";
  }

  // 自愈铁律：全局副作用（body class/变量）生命周期不受控，主题切换、其它插件、
  // Orca 重渲染都可能抹掉。写之前先比较，值一致就跳过——避免自触发观察器造成循环。
  function applyBg() {
    var src = resolved(currentRaw());
    var targetVar = src ? bgUrl(src) : "";
    var curVar = document.body.style.getPropertyValue("--itx-bg-image");
    var has = document.body.classList.contains("itx-bg");
    if (has === !!src && curVar === targetVar) return;
    document.body.classList.toggle("itx-bg", !!src);
    if (!src) {
      document.body.style.removeProperty("--itx-bg-image");
      return;
    }
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.textContent = BG_CSS;
      document.head.appendChild(styleEl);
    }
    document.body.style.setProperty("--itx-bg-image", targetVar);
  }

  /** 观察 body 的 class/style 被外部改动，防抖后补画背景。只监听 attribute，
   *  不订阅 subtree（body 下节点变化是事件风暴）。 */
  function ensureBgObserver() {
    if (bgObserver) return;
    var timer = 0;
    bgObserver = new MutationObserver(function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { try { applyBg(); } catch (e) {} }, 200);
    });
    bgObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
  }

  function readImageDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  /** data URL → 降采样 Blob（超 maxDim 压到 maxDim，jpg 0.85）。 */
  function downscaleToBlob(dataUrl, maxDim, type, quality) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var scale = maxDim / Math.max(img.width, img.height);
        if (scale >= 1) { fetch(dataUrl).then(function (r) { return r.blob(); }).then(resolve); return; }
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(resolve, type || "image/jpeg", quality || 0.85);
      };
      img.onerror = function () { fetch(dataUrl).then(function (r) { return r.blob(); }).then(resolve); };
      img.src = dataUrl;
    });
  }

  /** 本地文件 → 上传到仓库 assets，返回相对路径。 */
  async function importFileToAssets(file) {
    var dataUrl = await readImageDataUrl(file);
    var blob = await downscaleToBlob(dataUrl, 1920, file.type || "image/jpeg", 0.85);
    var buf = await blob.arrayBuffer();
    var assetPath = await orca.invokeBackend("upload-asset-binary", blob.type || file.type || "image/png", buf);
    if (!assetPath) throw new Error("上传失败");
    return String(assetPath);
  }

  function addImage(src, name) {
    var existed = state.list.findIndex(function (it) { return it.src === src; });
    if (existed >= 0) {
      state.idx = existed;
    } else {
      state.list.push({ src: src, name: name || "", at: Date.now() });
      if (state.list.length > MAX_IMAGES) state.list = state.list.slice(-MAX_IMAGES);
      state.idx = state.list.length - 1;
    }
    saveState();
    applyBg();
    renderWidget();
  }
  function removeImage(src) {
    var i = state.list.findIndex(function (it) { return it.src === src; });
    if (i < 0) return;
    state.list.splice(i, 1);
    if (state.idx === i) state.idx = state.list.length ? Math.min(i, state.list.length - 1) : -1;
    else if (state.idx > i) state.idx -= 1;
    saveState();
    applyBg();
    renderWidget();
  }
  function switchImage(i) {
    if (i < 0 || i >= state.list.length) return;
    state.idx = i;
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
    if (dt && dt.files && dt.files.length) {
      var f = dt.files[0];
      if (f.type && f.type.indexOf("image") === 0) {
        // 有绝对路径（Electron 老版本 File.path）→ 直接用 file:// 渲染，不上传
        if (f.path) {
          addImage("file://" + f.path, f.name || "文件图片");
          orca.notify("success", "已加入背景图库");
          return;
        }
        // 无 path（新版 Electron）→ 降采样后上传仓库 assets
        try {
          var assetPath = await importFileToAssets(f);
          addImage(assetPath, f.name || "文件图片");
          orca.notify("success", "已加入背景图库（已存入仓库 assets）");
          return;
        } catch (e) {
          orca.notify("warn", "图片上传失败: " + (e && e.message ? e.message : e));
          return;
        }
      }
    }
    if (dt) {
      var uri = dt.getData("text/uri-list") || dt.getData("text/plain");
      if (uri) {
        var src = uri.trim().split("\n")[0];
        if (src) { addImage(src, src); orca.notify("success", "已加入背景图库"); return; }
      }
    }
    orca.notify("warn", "没识别到图片（支持文件 / 图片链接 / 笔记图片块）");
  }

  async function handleBlockDrops(ids) {
    if (!ids || !ids.length) return;
    var blocks = (await orca.invokeBackend("get-blocks", ids)) || [];
    for (var i = 0; i < blocks.length; i++) {
      var props = (blocks[i].properties || []);
      var repr = null;
      for (var j = 0; j < props.length; j++) { if (props[j].name === "_repr") repr = props[j].value; }
      if (repr && repr.type === "image" && repr.src) {
        addImage(String(repr.src), "图片块");
        orca.notify("success", "已加入背景图库（图片块）");
        return;
      }
    }
    orca.notify("warn", "拖入的块不是图片块");
  }

  function buildHtml() {
    var cur = resolved(currentRaw());
    var thumbs = state.list.map(function (it, i) {
      return '<div class="itx-bg-thumb' + (i === state.idx ? ' itx-on' : '') + '" data-i="' + i + '" style="background-image:' + bgUrlHtml(resolved(it.src)) + '">' +
        '<span class="itx-bg-thumb-x" data-x="' + i + '" title="移除">×</span></div>';
    }).join("");
    return [
      '<div class="itx-bg-widget">',
      '<div class="itx-bg-label">自定义背景（' + state.list.length + '/' + MAX_IMAGES + '）</div>',
      '<div class="itx-bg-drop">把图片拖到这里<br><small style="opacity:.6">本地文件 / 图片链接 / 笔记图片块</small></div>',
      cur ? '<div class="itx-bg-preview" style="background-image:' + bgUrlHtml(cur) + '"></div>' : '',
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
        if (hasBlockPayload(dt)) return;
        e.stopPropagation();
        void handleDrop(dt);
      });
    }
    if (clear) {
      clear.addEventListener("click", function () {
        state.list = [];
        state.idx = -1;
        saveState();
        applyBg();
        renderWidget();
      });
    }
    container.addEventListener("click", function (e) {
      var x = e.target.closest(".itx-bg-thumb-x");
      if (x) {
        var xi = Number(x.getAttribute("data-x"));
        var it = state.list[xi];
        if (it) removeImage(it.src);
        return;
      }
      var t = e.target.closest(".itx-bg-thumb");
      if (t) switchImage(Number(t.getAttribute("data-i")));
    });
  }

  function renderWidget() {
    try { handle.setStatus(currentRaw() ? "背景 " + state.list.length + " 张" : "无背景"); } catch (e) {}
    if (!containerRef) return;
    containerRef.innerHTML = buildHtml();
    bindWidget(containerRef);
  }

  var handle = $inject.registerSidebarGroup({
    key: "custom-bg",
    title: $inject.scriptName,
    icon: "ti ti-photo",
    parent: $inject.scriptGroup || undefined,
    status: currentRaw() ? "背景 " + state.list.length + " 张" : "无背景",
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
      if (!detachDrop) detachDrop = $inject.attachBlockDrop(container, function (ids) { void handleBlockDrops(ids); });
      return function () {
        if (detachDrop) { try { detachDrop(); } catch (e) {} detachDrop = null; }
      };
    },
  });

  applyBg();
  ensureBgObserver();
  $inject.onUnload(function () {
    if (bgObserver) { bgObserver.disconnect(); bgObserver = null; }
    document.body.classList.remove("itx-bg");
    document.body.style.removeProperty("--itx-bg-image");
    try { handle.unregister(); } catch (e) {}
    if (styleEl) { styleEl.remove(); styleEl = null; }
    if (widgetStyle) { widgetStyle.remove(); widgetStyle = null; }
  });
})();
