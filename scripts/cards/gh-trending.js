<!-- @inject-template-id: gh-trending -->
<div class="gh-wall" id="ghWall">
<style>
  .gh-wall{font-family:var(--orca-font,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif);color:var(--orca-text,#1f2328);box-sizing:border-box;}
  .gh-wall *,.gh-wall *::before,.gh-wall *::after{box-sizing:border-box;}
  .gh-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
  .gh-title{font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px;color:var(--orca-heading,var(--orca-text,#1f2328));}
  .gh-mark{width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,var(--orca-accent,#4078c0),#6e40c9);flex:none;}
  .gh-sub{font-size:12px;color:var(--orca-text-secondary,#57606a);}
  .gh-count{margin-left:auto;font-size:12px;color:var(--orca-text-secondary,#57606a);background:var(--orca-chip-bg,rgba(127,127,127,.13));padding:2px 10px;border-radius:999px;white-space:nowrap;}
  .gh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:12px;}
  .gh-card{display:flex;flex-direction:column;gap:10px;background:var(--orca-card-bg,var(--orca-bg-2,#ffffff));border:1px solid var(--orca-border,rgba(127,127,127,.22));border-radius:var(--orca-radius,12px);padding:14px;text-decoration:none;color:inherit;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;min-width:0;}
  .gh-card:hover{transform:translateY(-2px);border-color:var(--orca-accent,#4078c0);box-shadow:0 4px 14px rgba(0,0,0,.08);}
  .gh-top{display:flex;gap:10px;align-items:flex-start;min-width:0;}
  .gh-avatar{width:34px;height:34px;border-radius:8px;flex:none;background:var(--orca-border,rgba(127,127,127,.25));}
  .gh-name{font-size:13.5px;font-weight:600;line-height:1.35;word-break:break-all;color:var(--orca-link,var(--orca-accent,#4078c0));}
  .gh-desc{font-size:12px;color:var(--orca-text-secondary,#57606a);line-height:1.5;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .gh-meta{display:flex;align-items:center;gap:12px;margin-top:auto;padding-top:2px;font-size:11.5px;color:var(--orca-text-secondary,#57606a);flex-wrap:wrap;}
  .gh-stat{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;}
  .gh-lang{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;}
  .gh-dot{width:8px;height:8px;border-radius:50%;flex:none;}
  .gh-updated{margin-left:auto;white-space:nowrap;}
  .gh-empty{padding:36px 16px;text-align:center;color:var(--orca-text-secondary,#57606a);font-size:13px;line-height:1.7;border:1px dashed var(--orca-border,rgba(127,127,127,.32));border-radius:var(--orca-radius,12px);grid-column:1 / -1;}
  .gh-foot{margin-top:12px;font-size:11px;color:var(--orca-text-secondary,#57606a);opacity:.75;text-align:right;}
</style>
<div class="gh-head">
  <div class="gh-title"><span class="gh-mark"></span>GitHub 今日热榜</div>
  <span class="gh-sub">最近 24 小时创建 · 按 Star 数排序</span>
  <span class="gh-count" id="ghCount">加载中…</span>
</div>
<div class="gh-grid" id="ghGrid"></div>
<div class="gh-foot">数据来源：GitHub Search API</div>
</div>
<script>
var grid = document.getElementById('ghGrid');
var count = document.getElementById('ghCount');

var LANG_COLORS = {
  'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'Python': '#3572a5',
  'Go': '#00add8', 'Rust': '#dea584', 'Java': '#b07219', 'C++': '#f34b7d',
  'C': '#555555', 'C#': '#178600', 'HTML': '#e34c26', 'CSS': '#563d7c',
  'Shell': '#89e051', 'Vue': '#41b883', 'Swift': '#f05138', 'Kotlin': '#a97bff',
  'Dart': '#00b4ab', 'Ruby': '#701516', 'PHP': '#4f5d95', 'Zig': '#ec915c',
  'Elixir': '#6e4a7e', 'Scala': '#c22d40', 'Objective-C': '#438eff'
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function fmt(n) {
  if (n == null) return '0';
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
}
function daysAgoISO(n) {
  var d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

function card(r) {
  var langColor = LANG_COLORS[r.language] || '#8b949e';
  var lang = r.language
    ? '<span class="gh-lang"><i class="gh-dot" style="background:' + langColor + '"></i>' + esc(r.language) + '</span>'
    : '';
  var desc = r.description
    ? '<div class="gh-desc">' + esc(r.description) + '</div>'
    : '';
  return '<a class="gh-card" href="' + esc(r.html_url) + '" target="_blank" rel="noopener noreferrer">' +
    '<div class="gh-top">' +
      '<img class="gh-avatar" src="' + esc(r.owner.avatar_url) + '&s=68" alt="" loading="lazy">' +
      '<div style="min-width:0;flex:1">' +
        '<div class="gh-name">' + esc(r.full_name) + '</div>' + desc +
      '</div>' +
    '</div>' +
    '<div class="gh-meta">' +
      '<span class="gh-stat">★ ' + fmt(r.stargazers_count) + '</span>' +
      '<span class="gh-stat">⑂ ' + fmt(r.forks_count) + '</span>' + lang +
      '<span class="gh-updated">' + esc((r.updated_at || '').slice(0, 10)) + '</span>' +
    '</div>' +
  '</a>';
}

async function load() {
  try {
    grid.innerHTML = '<div class="gh-empty">加载中…</div>';
    var url = 'https://api.github.com/search/repositories?q=' +
      encodeURIComponent('created:>' + daysAgoISO(1)) +
      '&sort=stars&order=desc&per_page=30';
    var res = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
    if (res.status === 403 || res.status === 429) {
      throw new Error('GitHub API 请求过于频繁（已限流），请稍后重试');
    }
    if (!res.ok) throw new Error('GitHub API 响应异常（' + res.status + '）');
    var data = await res.json();
    var items = (data && data.items) || [];
    if (!items.length) {
      grid.innerHTML = '<div class="gh-empty">今天还没有新上榜的仓库，晚些再来看看吧</div>';
      count.textContent = '0 个仓库';
    } else {
      grid.innerHTML = items.map(card).join('');
      count.textContent = items.length + ' 个仓库';
    }
  } catch (e) {
    grid.innerHTML = '<div class="gh-empty">加载失败：' + esc(e.message || '网络错误') + '</div>';
    count.textContent = '加载失败';
  }
}

load();
</script>
