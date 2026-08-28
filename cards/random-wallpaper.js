<!-- @inject-template-id: random-wallpaper -->
<div class="rw-card" id="rwCard">
<style>
  .rw-card{position:relative;font-family:var(--orca-font,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif);border-radius:12px;overflow:hidden;box-sizing:border-box;}
  .rw-card *,.rw-card *::before,.rw-card *::after{box-sizing:border-box;}
  .rw-img{display:block;width:100%;height:420px;object-fit:cover;background:linear-gradient(135deg,#f2f4f7,#e4e7ec);}
  .rw-foot{display:flex;align-items:center;gap:6px;padding:8px 12px;font-size:11px;color:var(--orca-color-text-2,#57606a);}
  .rw-dot{width:6px;height:6px;border-radius:50%;background:var(--orca-color-primary-5,#4078c0);flex:none;}
</style>
<img class="rw-img" id="rwImg" alt="随机壁纸">
<div class="rw-foot"><i class="rw-dot"></i><span id="rwFoot">正在加载…</span></div>
</div>
<script>
// 随机壁纸卡片（多源）：默认必应每日壁纸（官方 API，国内直连最稳），可切换
// 樱花随机图 / 随机风景 / Lorem Picsum（国际）。加载失败自动沿回退链换源。
// 图片源配置存块属性 lets.embed-view.config（宿主「卡片配置」表单编辑），
// 脚本重跑时读取；每次脚本运行（挂载 / 刷新重跑）必出新图。
var BLOCK_ID = (typeof $embed !== 'undefined' && $embed.blockId) || null;
var CONFIG_PROP = 'lets.embed-view.config';
var img = document.getElementById('rwImg');
var foot = document.getElementById('rwFoot');
var seed = Math.random().toString(36).slice(2, 10);

// 声明配置项：宿主（workbench ⋯ 菜单「卡片配置」/ embed-view header ⚙）据此渲染
// 通用表单，配置值存块属性 lets.embed-view.config，脚本重跑时读取应用。
if (typeof $embed !== 'undefined' && $embed.defineConfig) {
  $embed.defineConfig([
    {
      name: 'source', label: '图片源', type: 'select', default: 'bing',
      options: [
        { value: 'bing', label: '必应每日壁纸（国内直连）' },
        { value: 'dmoe', label: '樱花随机图' },
        { value: 'fj', label: '随机风景' },
        { value: 'ycy', label: '随机二次元' },
        { value: 'loliapi', label: '随机动漫' },
        { value: 'picsum', label: 'Lorem Picsum（国际）' },
      ],
    },
  ]);
}

// 直链图源（<img> 直接加载，均已实测国内可直连；dmoe 必须用裸域，www 子域已挂）。
// bing 单独走官方 API（两页去重约 16 天池 + 标题文案）。
// CHAIN_ORDER 即回退链：首选源失败后按此顺序尝试。
var DIRECT_SOURCES = {
  dmoe:    { label: '樱花随机图', url: 'https://dmoe.cc/random.php' },
  fj:      { label: '随机风景', url: 'https://t.alcy.cc/fj' },
  ycy:     { label: '随机二次元', url: 'https://t.alcy.cc/ycy' },
  loliapi: { label: '随机动漫', url: 'https://www.loliapi.com/acg/' },
  picsum:  { label: 'Lorem Picsum（国际）', url: 'https://picsum.photos/seed/' + seed + '/1200/675' },
};
var CHAIN_ORDER = ['bing', 'dmoe', 'fj', 'ycy', 'loliapi', 'picsum'];

/** 读配置里的图片源（块属性 lets.embed-view.config），无效/缺省返回 null。 */
async function readConfigSource() {
  if (BLOCK_ID == null) return null;
  try {
    var b = await orca.invokeBackend('get-block', BLOCK_ID);
    var props = (b && b.properties) || [];
    for (var i = 0; i < props.length; i++) {
      if (props[i].name === CONFIG_PROP && typeof props[i].value === 'string') {
        var v = JSON.parse(props[i].value).source;
        if (v === 'bing' || DIRECT_SOURCES[v]) return v;
      }
    }
  } catch (e) {}
  return null;
}

/** 必应每日壁纸：官方 API 取 idx=0/8 两页（约 16 天池，idx 再深会被钳制），
 *  按日期去重后随机一张，附标题文案。 */
async function loadBing() {
  var pages = await Promise.all([
    fetch('https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8').then(function (r) { return r.json(); }),
    fetch('https://cn.bing.com/HPImageArchive.aspx?format=js&idx=8&n=8').then(function (r) { return r.json(); }),
  ]);
  var seen = {};
  var pics = [];
  pages.forEach(function (d) {
    (d.images || []).forEach(function (x) {
      if (x && x.url && !seen[x.startdate]) {
        seen[x.startdate] = 1;
        pics.push(x);
      }
    });
  });
  if (!pics.length) throw new Error('bing api empty');
  var p = pics[Math.floor(Math.random() * pics.length)];
  return { url: 'https://cn.bing.com' + p.url, caption: p.title || p.copyright || '必应每日壁纸' };
}

/** 直链图源：拼随机参数保证每次加载必出新图（绕过缓存）。 */
function directSrc(key) {
  var url = DIRECT_SOURCES[key].url;
  return url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now() + Math.random().toString(36).slice(2, 6);
}

function setFoot(text) {
  foot.textContent = text + ' · 刷新换一张';
}

// 回退链消费：加载失败（fetch 失败 / 图片 onerror）自动换下一个源，全部失败给提示。
// loadingToken 防串扰：源 A 的迟到 onerror 不会触发已经切到源 B 的回退。
var queue = [];
var loadingToken = 0;

function setSource(key, url, caption) {
  var token = ++loadingToken;
  img.onerror = function () {
    if (token === loadingToken) tryNext();
  };
  img.src = url;
  setFoot(caption || DIRECT_SOURCES[key].label);
}

function tryNext() {
  var key = queue.shift();
  if (!key) {
    setFoot('图源全部加载失败，检查网络后刷新重试');
    return;
  }
  if (key === 'bing') {
    loadBing()
      .then(function (r) { setSource('bing', r.url, r.caption); })
      .catch(function () { tryNext(); });
    return;
  }
  setSource(key, directSrc(key));
}

(async function () {
  var preferred = (await readConfigSource()) || 'bing';
  queue = [preferred];
  CHAIN_ORDER.forEach(function (k) {
    if (k !== preferred) queue.push(k);
  });
  tryNext();
})();
</script>
