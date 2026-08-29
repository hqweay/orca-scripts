<!-- @inject-template-id: photo-carousel -->
<div class="cw-card" id="cwCard">
<style>
  .cw-card{font-family:var(--orca-font,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif);box-sizing:border-box;}
  .cw-card *,.cw-card *::before,.cw-card *::after{box-sizing:border-box;}
  .cw-stage{position:relative;height:340px;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,#f2f4f7,#e4e7ec);}
  .cw-img{display:block;width:100%;height:100%;object-fit:contain;}
  .cw-count{position:absolute;right:8px;bottom:8px;font-size:11px;color:#fff;background:rgba(0,0,0,.5);padding:2px 8px;border-radius:999px;}
  .cw-drop{height:340px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1.5px dashed var(--orca-border,rgba(127,127,127,.4));border-radius:12px;font-size:12px;color:var(--orca-text-secondary,#57606a);}
  .cw-drop.cw-active{border-color:var(--orca-accent,#4078c0);background:rgba(64,120,192,.06);}
  .cw-thumbs{margin-top:8px;display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;}
  .cw-thumb{position:relative;width:56px;height:42px;border-radius:6px;background-size:cover;background-position:center;border:1.5px solid transparent;cursor:pointer;flex:none;opacity:.8;}
  .cw-thumb.cw-on{border-color:var(--orca-accent,#4078c0);opacity:1;}
  .cw-x{position:absolute;top:-5px;right:-5px;width:14px;height:14px;line-height:13px;text-align:center;border-radius:50%;background:var(--orca-danger,#d33);color:#fff;font-size:10px;cursor:pointer;}
  .cw-hint{margin-top:8px;font-size:11px;color:var(--orca-text-secondary,#57606a);opacity:.6;text-align:center;}
</style>
</div>
<script>
// 图片轮播卡片：拖入图片（本地文件 / 图片链接 / 笔记图片块 / 查询块）→ 自动轮播。
// 数据经 $embed.data 读写（lets.embed-view.data 块属性，卡片自有存储）：数据跟笔记走；
// 写入不动 _repr.html（避免沙箱重挂载），其它视图需要时刷新重读，不做自动同步。
// 本地文件优先 File.path 直接 file:// 渲染，无 path 降采样后存仓库 assets（对齐 custom-bg）。
var BLOCK_ID = (typeof $embed !== 'undefined' && $embed.blockId) || null;
var root = document.getElementById('cwCard');
var state = { list: [], idx: -1 };
var timer = null;
var INTERVAL_MS = 3000;

// 声明配置项：宿主（workbench ⋯ 菜单「卡片配置」/ embed-view header ⚙）据此渲染
// 通用表单，配置值存块属性 lets.embed-view.config，脚本重跑时读取应用。
if (typeof $embed !== 'undefined' && $embed.defineConfig) {
  $embed.defineConfig([
    { name: 'interval', label: '轮播间隔（秒）', type: 'number', default: 3 },
  ]);
}

/** 块属性读取（同步，从后端返回的块对象取）。 */
function propOf(b, name) {
  var props = (b && b.properties) || [];
  for (var i = 0; i < props.length; i++) {
    if (props[i].name === name) return props[i].value;
  }
  return undefined;
}
/** get-block 读指定属性（异步）。 */
async function readBlockProp(name) {
  if (BLOCK_ID == null) return undefined;
  try {
    return propOf(await orca.invokeBackend('get-block', BLOCK_ID), name);
  } catch (e) { return undefined; }
}

async function loadConfig() {
  var n = Number(($embed.config || {}).interval);
  if (Number.isFinite(n) && n > 0) INTERVAL_MS = n * 1000;
}

async function loadState() {
  try {
    var d = await $embed.data.get();
    if (d && typeof d === 'object') state = d;
  } catch (e) {}
  if (!Array.isArray(state.list)) state.list = [];
  var idx = Number(state.idx);
  if (!Number.isFinite(idx) || idx < 0 || idx >= state.list.length) state.idx = state.list.length ? 0 : -1;
}
/** 写块数据属性（setProperties 持久化到后端）。数据以块为数据源。 */
function saveState() {
  $embed.data.set(state).catch(function (e) {
    orca.notify('warn', '保存失败: ' + (e && e.message || e));
  });
}

/** 相对路径 → file:// 绝对路径；外链原样（对齐 custom-bg / workbench random）。 */
function resolved(src) {
  if (!src) return '';
  if (/^(https?:|data:|blob:|file:)/i.test(src)) return src;
  var o = (orca && orca.state) || {};
  var dir = (o.repoDir || '').trim();
  if (!dir && o.dataDir && o.repo) dir = String(o.dataDir).replace(/\/+$/, '') + '/repos/' + o.repo;
  if (!dir) return '';
  return 'file://' + dir + '/assets/' + encodeURI(String(src).replace(/^\.?\//, '').split(/[?#]/)[0]);
}

function next() {
  if (state.list.length < 2) return;
  state.idx = (state.idx + 1) % state.list.length;
  render();
}
function startAuto() {
  stopAuto();
  if (state.list.length < 2) return;
  timer = setInterval(next, INTERVAL_MS);
}
function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
function switchImage(i) {
  if (i < 0 || i >= state.list.length) return;
  state.idx = i;
  saveState();
  startAuto();
  render();
}
function removeImage(src) {
  var i = state.list.findIndex(function (it) { return it.src === src; });
  if (i < 0) return;
  state.list.splice(i, 1);
  if (state.idx >= state.list.length) state.idx = state.list.length - 1;
  saveState();
  startAuto();
  render();
}
function addImage(src, name) {
  var existed = state.list.findIndex(function (it) { return it.src === src; });
  if (existed >= 0) state.idx = existed;
  else { state.list.push({ src: src, name: name || '' }); state.idx = state.list.length - 1; }
  saveState();
  startAuto();
  render();
}

function readImageDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
/** data URL → 降采样 Blob（超 1920 压到 1920，jpg 0.85）。 */
function downscaleToBlob(dataUrl) {
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      var scale = 1920 / Math.max(img.width, img.height);
      if (scale >= 1) { fetch(dataUrl).then(function (r) { return r.blob(); }).then(resolve); return; }
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(resolve, 'image/jpeg', 0.85);
    };
    img.onerror = function () { fetch(dataUrl).then(function (r) { return r.blob(); }).then(resolve); };
    img.src = dataUrl;
  });
}
async function importFileToAssets(file) {
  var dataUrl = await readImageDataUrl(file);
  var blob = await downscaleToBlob(dataUrl);
  var buf = await blob.arrayBuffer();
  var assetPath = await orca.invokeBackend('upload-asset-binary', blob.type || file.type || 'image/png', buf);
  if (!assetPath) throw new Error('上传失败');
  return String(assetPath);
}

/** 块拖拽 payload 的 orca 类型名（无则 null）。 */
function orcaTypeOf(dt) {
  if (!dt || !dt.types) return null;
  return Array.prototype.slice.call(dt.types).filter(function (t) {
    var parts = String(t).split('/');
    return parts.length === 2 && parts[0] === 'orca';
  })[0] || null;
}
function hasBlockPayload(dt) { return orcaTypeOf(dt) != null; }

/** 解析块拖拽 payload → 块 id 列表（对齐 dragUtils.parseBlockDragData）。 */
function parseDropBlockIds(dt) {
  var orcaType = orcaTypeOf(dt);
  var data = orcaType ? dt.getData(orcaType) : dt ? dt.getData('text/plain') : '';
  if (!data) return [];
  var parsed;
  try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
  var ids = [];
  if (parsed && typeof parsed === 'object') {
    if (parsed.id) ids.push(Number(parsed.id));
    else if (Array.isArray(parsed.blockIds)) ids = parsed.blockIds.map(Number);
    else if (Array.isArray(parsed.blocks)) ids = parsed.blocks.map(Number);
    else if (Array.isArray(parsed) && parsed[0] && parsed[0].id) ids = parsed.map(function (b) { return Number(b.id); });
  } else if (typeof parsed === 'string' || typeof parsed === 'number') {
    var n = Number(parsed);
    if (!isNaN(n) && n > 0) ids.push(n);
  }
  return ids.filter(function (id) { return !isNaN(id) && id > 0; });
}

/** 图片块（_repr.type === "image"）的 src，非图片块返回 null。 */
function imageSrcOf(b) {
  var repr = propOf(b, '_repr');
  return (repr && repr.type === 'image' && repr.src) ? String(repr.src) : null;
}

/** 查询块执行查询 → 图片块 id 列表。
 * 查询层面 AND 上「_repr.type = image」过滤（kind 9 类型条件，op 5 = QueryHas），
 * 而非拉回全部结果再 JS 遍历。 */
async function queryImageIds(b) {
  var repr = propOf(b, '_repr');
  if (!repr || repr.type !== 'query' || !repr.q || !repr.q.q) return [];
  var q = JSON.parse(JSON.stringify(repr.q.q));
  var imgFilter = { kind: 9, types: { op: 5, value: ['image'] } };
  var merged = (q && q.kind === 100 && Array.isArray(q.conditions))
    ? { kind: 100, conditions: q.conditions.concat(imgFilter) }
    : { kind: 100, conditions: [q, imgFilter] };
  var ids = await orca.invokeBackend('query', { q: merged, pageSize: 100 });
  return Array.isArray(ids) ? ids : [];
}

/** 拖入块：图片块直接取图；查询块执行查询（含图片过滤）收集所有图片块。 */
async function handleBlockDrop(ids) {
  if (!ids || !ids.length) return;
  var blocks = (await orca.invokeBackend('get-blocks', ids)) || [];
  var added = 0;
  for (var i = 0; i < blocks.length; i++) {
    var src = imageSrcOf(blocks[i]);
    if (src) { addImage(src, '图片块'); added++; continue; }
    var qIds = await queryImageIds(blocks[i]);
    if (!qIds.length) continue;
    var qBlocks = (await orca.invokeBackend('get-blocks', qIds)) || [];
    for (var j = 0; j < qBlocks.length; j++) {
      var qSrc = imageSrcOf(qBlocks[j]);
      if (qSrc) { addImage(qSrc, '图片块'); added++; }
    }
  }
  if (added) orca.notify('success', '已加入 ' + added + ' 张图片');
  else orca.notify('warn', '拖入的块里没有图片块');
}

function handleDrop(dt) {
  if (dt && dt.files && dt.files.length) {
    var f = dt.files[0];
    if (f.type && f.type.indexOf('image') === 0) {
      if (f.path) { addImage('file://' + f.path, f.name || '图片'); orca.notify('success', '已加入轮播'); return; }
      importFileToAssets(f).then(function (p) {
        addImage(p, f.name || '图片');
        orca.notify('success', '已加入轮播（已存仓库 assets）');
      }).catch(function (e) {
        orca.notify('warn', '图片上传失败: ' + (e && e.message || e));
      });
      return;
    }
  }
  if (dt) {
    var uri = dt.getData('text/uri-list') || dt.getData('text/plain');
    if (uri) {
      var src = uri.trim().split('\n')[0];
      if (src) { addImage(src, src); orca.notify('success', '已加入轮播'); return; }
    }
  }
  orca.notify('warn', '没识别到图片（支持本地文件 / 图片链接 / 笔记图片块 / 查询块）');
}

function thumbHtml(it, i) {
  return '<div class="cw-thumb' + (i === state.idx ? ' cw-on' : '') + '" data-i="' + i + '" style="background-image:url(\'' +
    String(resolved(it.src)).replace(/'/g, "\\'") + '\')">' +
    '<span class="cw-x" data-i="' + i + '" title="移除">×</span></div>';
}
function render() {
  var it = state.list[state.idx];
  var body = it
    ? '<div class="cw-stage"><img class="cw-img" src="' + String(resolved(it.src)).replace(/"/g, '&quot;') + '" alt="">' +
      '<span class="cw-count">' + (state.idx + 1) + '/' + state.list.length + '</span></div>' +
      '<div class="cw-thumbs">' + state.list.map(thumbHtml).join('') + '</div>'
    : '<div class="cw-drop">把图片拖到这里<br><small style="opacity:.65">本地文件 / 图片链接 / 图片块 / 查询块</small></div>';
  root.innerHTML = body + '<div class="cw-hint">' + (state.list.length ? '拖入图片加入轮播' : '') + '</div>';
}

// 事件委托一次绑定（render 重建 innerHTML 不影响 root 上的监听）。
// 拖拽三件套统一 stopPropagation：阻止冒泡到块容器触发宿主「拖放文件以插入」。
function stopDrag(e) { e.preventDefault(); e.stopPropagation(); }
root.addEventListener('dragenter', stopDrag);
root.addEventListener('dragover', function (e) {
  stopDrag(e);
  var d = root.querySelector('.cw-drop');
  if (d) d.classList.add('cw-active');
});
root.addEventListener('dragleave', function (e) {
  e.stopPropagation();
  var d = root.querySelector('.cw-drop');
  if (d) d.classList.remove('cw-active');
});
root.addEventListener('drop', function (e) {
  stopDrag(e);
  var d = root.querySelector('.cw-drop');
  if (d) d.classList.remove('cw-active');
  if (hasBlockPayload(e.dataTransfer)) {
    var ids = parseDropBlockIds(e.dataTransfer);
    if (ids.length) { void handleBlockDrop(ids); return; }
  }
  void handleDrop(e.dataTransfer);
});
root.addEventListener('click', function (e) {
  var x = e.target.closest('.cw-x');
  if (x) { var it = state.list[Number(x.getAttribute('data-i'))]; if (it) removeImage(it.src); return; }
  var t = e.target.closest('.cw-thumb');
  if (t) switchImage(Number(t.getAttribute('data-i')));
});
root.addEventListener('mouseenter', stopAuto);
root.addEventListener('mouseleave', startAuto);

await loadState();
await loadConfig();
render();
startAuto();
</script>
