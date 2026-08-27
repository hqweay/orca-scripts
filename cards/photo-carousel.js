<!-- @inject-template-id: photo-carousel -->
<div class="cw-card" id="cwCard">
<style>
  .cw-card{font-family:var(--orca-font,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif);box-sizing:border-box;}
  .cw-card *,.cw-card *::before,.cw-card *::after{box-sizing:border-box;}
  .cw-stage{position:relative;height:340px;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,#f2f4f7,#e4e7ec);}
  .cw-img{display:block;width:100%;height:100%;object-fit:cover;}
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
// 图片轮播卡片：拖入图片（本地文件 / 图片链接）→ 自动轮播。
// 存储：localStorage 按块隔离（$embed.blockId）；本地文件优先 File.path 直接
// file:// 渲染，无 path 降采样后 upload-asset-binary 存仓库 assets（对齐 custom-bg）。
var KEY = 'card:photo-carousel:' + ((typeof $embed !== 'undefined' && $embed.blockId) || 'local');
var root = document.getElementById('cwCard');
var state = loadState();
var timer = null;

function loadState() {
  var s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  var list = s && Array.isArray(s.list) ? s.list : [];
  var idx = Number(s && s.idx);
  if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) idx = list.length ? 0 : -1;
  return { list: list, idx: idx };
}
function saveState() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

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
  saveState();
  render();
}
function startAuto() {
  stopAuto();
  if (state.list.length < 2) return;
  timer = setInterval(next, 3000);
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
  orca.notify('warn', '没识别到图片（支持本地文件 / 图片链接）');
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
    : '<div class="cw-drop">把图片拖到这里<br><small style="opacity:.65">本地文件 / 图片链接</small></div>';
  root.innerHTML = body + '<div class="cw-hint">' + (state.list.length ? '拖入图片加入轮播' : '') + '</div>';
}

// 事件委托一次绑定（render 重建 innerHTML 不影响 root 上的监听）。
root.addEventListener('dragover', function (e) {
  e.preventDefault();
  var d = root.querySelector('.cw-drop');
  if (d) d.classList.add('cw-active');
});
root.addEventListener('dragleave', function () {
  var d = root.querySelector('.cw-drop');
  if (d) d.classList.remove('cw-active');
});
root.addEventListener('drop', function (e) {
  e.preventDefault();
  var d = root.querySelector('.cw-drop');
  if (d) d.classList.remove('cw-active');
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

render();
startAuto();
</script>
