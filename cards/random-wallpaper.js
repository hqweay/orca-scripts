<!-- @inject-template-id: random-wallpaper -->
<div class="rw-card" id="rwCard">
<style>
  .rw-card{position:relative;display:flex;flex-direction:column;height:100%;min-height:280px;font-family:var(--orca-font,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif);border-radius:12px;overflow:hidden;box-sizing:border-box;}
  /* 撑满容器：沙箱里 html/body 被宿主改写为 [data-embed-root]，webview 里是真实文档根，
     两边都让高度链打通——卡片随容器（嵌入视图拖拽高度 / 工作台 cell）缩放。 */
  html,body{height:100%;}
  .rw-card *,.rw-card *::before,.rw-card *::after{box-sizing:border-box;}
  .rw-img{display:block;flex:1;min-height:0;width:100%;object-fit:contain;background:linear-gradient(135deg,#f2f4f7,#e4e7ec);}
  .rw-foot{flex:none;display:flex;align-items:center;gap:6px;padding:8px 12px;font-size:11px;color:var(--orca-color-text-2,#57606a);}
  .rw-dot{width:6px;height:6px;border-radius:50%;background:var(--orca-color-primary-5,#4078c0);flex:none;}
  .rw-foot-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .rw-foot-actions{display:flex;gap:2px;flex:none;}
  .rw-btn{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:transparent;border:none;color:inherit;opacity:.6;cursor:pointer;padding:0;}
  .rw-btn:hover{opacity:1;}
  .rw-btn svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
</style>
<img class="rw-img" id="rwImg" alt="随机壁纸">
<div class="rw-foot">
  <i class="rw-dot"></i><span class="rw-foot-text" id="rwFoot">正在加载…</span>
  <span class="rw-foot-actions" id="rwActions" style="display:none">
    <button class="rw-btn" id="rwOpen" title="在浏览器打开原图"><svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>
    <button class="rw-btn" id="rwSave" title="保存到笔记库"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
  </span>
</div>
</div>
<script>
// 随机壁纸卡片（多源 + 轮播）：
// - 图片源（source）：必应每日壁纸（默认，官方 API 两页约 16 天池，国内直连最稳）/
//   樱花随机图 / 随机风景 / 随机二次元 / 随机动漫 / Lorem Picsum（国际）/ 全部源轮播。
// - 轮播（interval > 0）：按秒定时换图；all 源每 tick 随机挑一个源；预加载完成后换图
//   （不闪白屏）；单张失败自动跳过换下一个源。
// - 保存（⤓）：把当前图存进仓库 assets（upload-asset-binary）；外链（↗）：浏览器打开原图。
//   需要 orca 可用（allowBridge 关闭时不显示按钮）。
// 配置存块属性 lets.embed-view.config，脚本重跑时读取；timer 按 blockId 键控，
// 重挂（刷新/配置变更）先清旧 timer——沙箱清 Shadow DOM 清不掉宿主 setInterval。
var BLOCK_ID = (typeof $embed !== 'undefined' && $embed.blockId) || null;
var CONFIG_PROP = 'lets.embed-view.config';
var TIMER_KEY = '__rwTimer_' + (BLOCK_ID == null ? 'na' : BLOCK_ID);
var img = document.getElementById('rwImg');
var foot = document.getElementById('rwFoot');
var actions = document.getElementById('rwActions');
var saveBtn = document.getElementById('rwSave');
var openBtn = document.getElementById('rwOpen');
var seed = Math.random().toString(36).slice(2, 10);
// orca 可用性：沙箱=参数/屏蔽后的 window.orca；webview=桥接门面（仅在 allowBridge 开时注入）
var api = (typeof orca !== 'undefined' && orca) || (typeof window !== 'undefined' && window.orca) || null;

// 声明配置项：宿主（workbench ⋯ 菜单「卡片配置」/ embed-view header ⚙）据此渲染
// 通用表单，配置值存块属性 lets.embed-view.config，脚本重跑时读取应用。
if (typeof $embed !== 'undefined' && $embed.defineConfig) {
  $embed.defineConfig([
    {
      name: 'source', label: '图片源', type: 'select', default: 'bing',
      options: [
        { value: 'bing', label: '必应每日壁纸（国内直连）' },
        { value: 'all', label: '全部源轮播' },
        { value: 'dmoe', label: '樱花随机图' },
        { value: 'fj', label: '随机风景' },
        { value: 'ycy', label: '随机二次元' },
        { value: 'loliapi', label: '随机动漫' },
        { value: 'picsum', label: 'Lorem Picsum（国际）' },
      ],
    },
    { name: 'interval', label: '轮播间隔（秒，0 = 不轮播）', type: 'number', default: 0 },
  ]);
}

// 直链图源（<img> 直接加载，均已实测国内可直连；dmoe 必须用裸域，www 子域已挂）。
// bing 单独走官方 API（两页去重约 16 天池，挂载时拉一次、整个生命周期内复用）。
var DIRECT_SOURCES = {
  dmoe:    { label: '樱花随机图', url: 'https://dmoe.cc/random.php' },
  fj:      { label: '随机风景', url: 'https://t.alcy.cc/fj' },
  ycy:     { label: '随机二次元', url: 'https://t.alcy.cc/ycy' },
  loliapi: { label: '随机动漫', url: 'https://www.loliapi.com/acg/' },
  picsum:  { label: 'Lorem Picsum（国际）', url: 'https://picsum.photos/seed/' + seed + '/1200/675' },
};
var ALL_KEYS = ['bing', 'dmoe', 'fj', 'ycy', 'loliapi', 'picsum'];
var VALID_SOURCES = { bing: 1, all: 1 };
Object.keys(DIRECT_SOURCES).forEach(function (k) { VALID_SOURCES[k] = 1; });

var preferred = 'bing';
var queue = [];          // 初始加载回退链
var bingPool = null;     // 必应图池（挂载时拉取一次）
var currentUrl = '';     // 当前展示图（保存/外链用）
var loadingToken = 0;    // 防迟到 onerror 串扰
var rotating = false;    // 轮播 tick 进行中标记

/** 读配置（块属性 lets.embed-view.config），返回 {source, interval}。 */
async function readConfig() {
  var cfg = { source: null, interval: 0 };
  if (BLOCK_ID == null || typeof orca === 'undefined' || !orca) return cfg;
  try {
    var b = await orca.invokeBackend('get-block', BLOCK_ID);
    var props = (b && b.properties) || [];
    for (var i = 0; i < props.length; i++) {
      if (props[i].name === CONFIG_PROP && typeof props[i].value === 'string') {
        var parsed = JSON.parse(props[i].value);
        if (parsed && VALID_SOURCES[parsed.source]) cfg.source = parsed.source;
        var n = Number(parsed.interval);
        if (Number.isFinite(n) && n > 0) cfg.interval = n;
      }
    }
  } catch (e) {}
  return cfg;
}

/** 必应图池：官方 API 取 idx=0/8 两页（约 16 天池，idx 再深会被钳制），按日期去重。 */
async function loadBingPool() {
  if (bingPool) return bingPool;
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
  bingPool = pics;
  return bingPool;
}

/** 从指定源取一张候选图（url + footer 文案），不做 DOM 操作。 */
async function fetchCandidate(key) {
  if (key === 'bing') {
    var pool = await loadBingPool();
    var p = pool[Math.floor(Math.random() * pool.length)];
    return { url: 'https://cn.bing.com' + p.url, caption: p.title || p.copyright || '必应每日壁纸' };
  }
  var url = DIRECT_SOURCES[key].url;
  url += (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now() + Math.random().toString(36).slice(2, 6);
  return { url: url, caption: DIRECT_SOURCES[key].label };
}

function setFoot(text) {
  foot.textContent = text + ' · 刷新换一张';
}

/** 预加载：加载成功才换图，避免闪白屏。 */
function preload(url) {
  return new Promise(function (resolve, reject) {
    var im = new Image();
    im.onload = function () { resolve(); };
    im.onerror = function () { reject(new Error('preload failed')); };
    im.src = url;
  });
}

function show(url, caption) {
  currentUrl = url;
  img.src = url;
  setFoot(caption);
}

// ---- 轮播 tick：随机源（all）取图 → 预加载 → 换图；任何失败静默跳过，下一 tick 再试 ----
async function tick() {
  if (rotating) return;
  rotating = true;
  try {
    var key = preferred === 'all' ? ALL_KEYS[Math.floor(Math.random() * ALL_KEYS.length)] : preferred;
    var c = await fetchCandidate(key);
    await preload(c.url);
    show(c.url, c.caption);
  } catch (e) { /* 该源本次失败，下一 tick 再试 */ }
  rotating = false;
}

function startTimer(seconds) {
  if (window[TIMER_KEY]) { clearInterval(window[TIMER_KEY]); window[TIMER_KEY] = null; }
  if (!seconds || seconds <= 0) return;
  window[TIMER_KEY] = setInterval(tick, Math.max(5, seconds) * 1000);
}

// ---- 初始加载：首图走回退链（保底出图），进入轮播后由 tick 接管 ----
function setSource(key, url, caption) {
  var token = ++loadingToken;
  img.onerror = function () {
    if (token === loadingToken) tryNext();
  };
  show(url, caption);
}

function tryNext() {
  var key = queue.shift();
  if (!key) {
    setFoot('图源全部加载失败，检查网络后刷新重试');
    return;
  }
  fetchCandidate(key)
    .then(function (c) { setSource(key, c.url, c.caption); })
    .catch(function () { tryNext(); });
}

// ---- 保存到笔记库 / 浏览器打开（需 orca；allowBridge 关闭时按钮隐藏）----
function initActions() {
  if (!api) return;
  actions.style.display = '';
  openBtn.addEventListener('click', function () {
    if (currentUrl) api.invokeBackend('shell-open', currentUrl).catch(function () {});
  });
  saveBtn.addEventListener('click', async function () {
    if (!currentUrl || saveBtn.disabled) return;
    saveBtn.disabled = true;
    try {
      var res = await fetch(currentUrl);
      var blob = await res.blob();
      var buf = await blob.arrayBuffer();
      var assetPath = await api.invokeBackend('upload-asset-binary', blob.type || 'image/jpeg', buf);
      if (!assetPath) throw new Error('上传失败');
      // 图片落为卡片块的子块：资产真正进笔记（可被引用、随同步走），展开卡片即可见
      if (BLOCK_ID != null) {
        var ref = (api.state && api.state.blocks && api.state.blocks[BLOCK_ID]) || { id: BLOCK_ID };
        await api.commands.invokeEditorCommand(
          'core.editor.insertBlock', null, ref, 'lastChild', null,
          { type: 'image', src: assetPath },
        );
        api.notify('success', '已保存为卡片子块：' + assetPath);
      } else {
        api.notify('success', '已保存到仓库 assets：' + assetPath);
      }
    } catch (e) {
      api.notify('error', '保存失败：' + (e && e.message || e));
    }
    saveBtn.disabled = false;
  });
}

(async function () {
  if (window[TIMER_KEY]) { clearInterval(window[TIMER_KEY]); window[TIMER_KEY] = null; }

  var cfg = await readConfig();
  preferred = cfg.source || 'bing';
  initActions();

  // 首图回退链：all 模式随机洗牌；单源模式首选源在前
  var keys;
  if (preferred === 'all') {
    keys = ALL_KEYS.slice().sort(function () { return Math.random() - 0.5; });
  } else {
    keys = [preferred];
    ALL_KEYS.forEach(function (k) { if (k !== preferred) keys.push(k); });
  }
  queue = keys;
  tryNext();

  startTimer(cfg.interval);
})();
</script>
