<!-- @inject-template-id: tag-echo -->
<div class="te-wrap" id="teApp">
<style>
  .te-wrap{font-family:var(--orca-font,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif);color:var(--orca-color-text-1,#26292f);line-height:1.5}
  .te-wrap *{box-sizing:border-box;margin:0;padding:0}
  .te-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap}
  .te-head h2{font-size:17px;font-weight:700}
  .te-sub{font-size:12px;color:var(--orca-color-text-3,#8a8f99)}
  .te-state{padding:26px 18px;text-align:center;color:var(--orca-color-text-3,#8a8f99);font-size:13px;border:1px dashed var(--orca-color-border,rgba(127,127,127,.25));border-radius:12px}
  /* 主视图：抽样流——大字排版、整条可点击跳转（重拾的闭环） */
  .te-hero{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
  .te-item{padding:12px 14px;border:1px solid var(--orca-color-border,rgba(127,127,127,.16));border-radius:12px;cursor:pointer;transition:background .12s,border-color .12s;background:var(--orca-color-bg-2,transparent)}
  .te-item:hover{background:var(--orca-color-selection,rgba(127,127,127,.08));border-color:var(--orca-color-primary-5,#4f7cf7)}
  .te-txt{font-size:13.5px;line-height:1.65;color:var(--orca-color-text-1,#26292f);word-break:break-word}
  .te-meta{display:flex;align-items:center;gap:8px;margin-top:7px;flex-wrap:wrap}
  .te-time{font-size:11px;color:var(--orca-color-text-3,#8a8f99)}
  .te-chips{display:flex;gap:4px;flex-wrap:wrap}
  .te-chip{font-size:10px;padding:1px 7px;border-radius:999px;background:var(--orca-color-selection,rgba(127,127,127,.1));color:var(--orca-color-text-3,#8a8f99)}
  /* 画像区：基于全量统计（诚实标注） */
  .te-sec-title{font-size:12px;color:var(--orca-color-text-3,#8a8f99);margin:14px 0 10px}
  .te-sec-title b{color:var(--orca-color-primary-5,#4f7cf7)}
  .te-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
  .te-card{background:var(--orca-color-bg-2,transparent);border:1px solid var(--orca-color-border,rgba(127,127,127,.18));border-radius:12px;padding:14px 16px}
  .te-card h3{font-size:13px;font-weight:600;color:var(--orca-color-text-3,#8a8f99);margin-bottom:10px}
  .te-bars{display:flex;align-items:flex-end;gap:6px;height:118px;padding-top:14px}
  .te-bcol{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}
  .te-bval{font-size:10px;color:var(--orca-color-text-3,#8a8f99)}
  .te-bbar{width:100%;max-width:26px;border-radius:4px 4px 2px 2px;background:var(--orca-color-primary-5,#4f7cf7);min-height:2px}
  .te-blab{font-size:10px;color:var(--orca-color-text-3,#8a8f99);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .te-donut{display:flex;align-items:center;gap:14px}
  .te-legend{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0}
  .te-litem{display:flex;align-items:center;gap:7px;font-size:12px}
  .te-sw{width:10px;height:10px;border-radius:3px;flex-shrink:0}
  .te-lval{margin-left:auto;color:var(--orca-color-text-3,#8a8f99);font-size:11px}
  .te-hrow{display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:9px}
  .te-hrow:last-child{margin-bottom:0}
  .te-hname{width:74px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--orca-color-text-3,#8a8f99)}
  .te-htrack{flex:1;height:8px;border-radius:4px;background:var(--orca-color-border,rgba(127,127,127,.15));overflow:hidden}
  .te-hfill{height:100%;border-radius:4px;background:var(--orca-color-primary-5,#4f7cf7)}
  .te-hval{width:30px;text-align:right;color:var(--orca-color-text-1,#26292f)}
  .te-skip{font-size:11px;color:var(--orca-color-text-3,#8a8f99);margin-top:10px}
  .te-footer{font-size:11px;color:var(--orca-color-text-3,#8a8f99);text-align:right;margin-top:12px}
</style>
<div id="app"><div class="te-state">正在抽取…</div></div>
</div>
<script>
// 标签回响（tag-echo）：任意标签的「重拾 + 画像」。
// - 重拾：从标签集合均匀抽样 count 条，大字排版、整条可点击跳转原块（重拾的闭环）；
//   mode=random 每次刷新重抽（_random + randomSeed），mode=latest 为最新流（_modified DESC）。
// - 画像：月度 / 时段 / 星期 / 高频引用子标签——**基于全量**统计（诚实标注），
//   与抽样流分离，无抽样噪声；超 1000 条取最近 1000 并如实标注。
// 配置走 $embed.config（宿主注入，改配置自动重跑）：tag / count / mode / stats / title。
(function () {
  var app = document.getElementById("teApp");
  if (typeof window.orca === "undefined") {
    app.innerHTML = '<div class="te-state">此嵌入需要开启桥接权限才能展示数据</div>';
    return;
  }

  var cfg = ($embed && $embed.config) || {};
  var TAG = String(cfg.tag || "碎碎念").replace(/^#/, "").trim() || "碎碎念";
  var COUNT = Math.min(30, Math.max(1, Math.round(Number(cfg.count) || 5)));
  var MODE = cfg.mode === "latest" ? "latest" : "random";
  var SHOW_STATS = cfg.stats !== false;
  var POP_CAP = 1000;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function parseDate(b) {
    var raw = b.created || b.modified || null;
    if (raw == null || raw === "") return null;
    var d = typeof raw === "number" ? new Date(raw < 1e12 ? raw * 1000 : raw) : new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  function extractText(b) {
    var t = (b.text || "").trim();
    if (t) return t;
    if (b.content && b.content.length) {
      return b.content
        .filter(function (c) { return c && c.t === "t" && typeof c.v === "string"; })
        .map(function (c) { return c.v; })
        .join("")
        .trim();
    }
    return "";
  }
  function jumpTo(id) {
    try {
      window.orca.nav.goTo("block", { blockId: id });
    } catch (e) {}
  }

  var P1 = "var(--orca-color-primary-5,#4f7cf7)";
  var P2 = "var(--orca-color-primary-7,#3a5fd8)";
  var W = "var(--orca-color-warning,#e6a23c)";
  var D = "var(--orca-color-danger,#e2708a)";
  var T3 = "var(--orca-color-text-3,#8a8f99)";
  var PERIODS = [
    { label: "凌晨 0-5 点", color: P2 },
    { label: "上午 6-11 点", color: P1 },
    { label: "下午 12-17 点", color: W },
    { label: "晚上 18-23 点", color: D },
  ];
  var WEEKS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  // ---- 画像图表（数据来自全量，诚实标注）----
  function monthBars(el, counts) {
    if (!counts.length) { el.innerHTML = '<div class="te-state" style="padding:14px">暂无日期数据</div>'; return; }
    var max = 1;
    counts.forEach(function (c) { if (c.value > max) max = c.value; });
    el.innerHTML =
      '<div class="te-bars">' +
      counts.map(function (c) {
        var h = Math.max(3, Math.round((c.value / max) * 92));
        return '<div class="te-bcol"><div class="te-bval">' + c.value + '</div><div class="te-bbar" style="height:' + h + 'px;background:' + (c.hot ? P1 : T3) + ';opacity:' + (c.hot ? 1 : 0.45) + '"></div><div class="te-blab">' + esc(c.label) + "</div></div>";
      }).join("") +
      "</div>";
  }
  function donut(el, data) {
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    if (!total) { el.innerHTML = '<div class="te-state" style="padding:14px">暂无日期数据</div>'; return; }
    var r = 50, c = 2 * Math.PI * r, off = 0;
    var segs = data.map(function (d) {
      var frac = d.value / total;
      var seg = '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + d.color + '" stroke-width="20" stroke-dasharray="' + frac * c + " " + (c - frac * c) + '" stroke-dashoffset="' + -off * c + '" transform="rotate(-90 60 60)"></circle>';
      off += frac;
      return seg;
    }).join("");
    el.innerHTML =
      '<div class="te-donut"><svg viewBox="0 0 120 120" width="112" height="112" style="flex-shrink:0">' + segs + '</svg><div class="te-legend">' +
      data.map(function (d) {
        return '<div class="te-litem"><span class="te-sw" style="background:' + d.color + '"></span><span>' + esc(d.label) + '</span><span class="te-lval">' + d.value + " · " + Math.round((d.value / total) * 100) + "%</span></div>";
      }).join("") +
      "</div></div>";
  }
  function hbars(el, data) {
    if (!data.length) { el.innerHTML = '<div class="te-state" style="padding:14px">暂无数据</div>'; return; }
    var max = data[0].value || 1;
    el.innerHTML =
      '<div>' +
      data.map(function (d) {
        var w = Math.max(4, Math.round((d.value / max) * 100));
        return '<div class="te-hrow"><span class="te-hname" title="' + esc(d.label) + '">' + esc(d.label) + '</span><div class="te-htrack"><div class="te-hfill" style="width:' + w + '%"></div></div><span class="te-hval">' + d.value + "</span></div>";
      }).join("") +
      "</div>";
  }

  function render(all) {
    var dated = all.filter(function (b) { return parseDate(b); });
    var skipped = all.length - dated.length;

    // ---- 画像统计：全量 ----
    var now = new Date();
    var months = {};
    dated.forEach(function (b) {
      var d = parseDate(b);
      var k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      months[k] = (months[k] || 0) + 1;
    });
    var curKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    var monthCounts = Object.keys(months).sort().map(function (k) {
      var p = k.split("-");
      return { label: p[0] === String(now.getFullYear()) ? parseInt(p[1], 10) + "月" : k.slice(2), value: months[k], hot: k === curKey };
    }).slice(-8);

    var periodData = PERIODS.map(function (p) { return { label: p.label, color: p.color, value: 0 }; });
    dated.forEach(function (b) {
      var h = parseDate(b).getHours();
      if (h < 6) periodData[0].value++;
      else if (h < 12) periodData[1].value++;
      else if (h < 18) periodData[2].value++;
      else periodData[3].value++;
    });

    var weekData = WEEKS.map(function (w) { return { label: w, value: 0 }; });
    dated.forEach(function (b) { weekData[parseDate(b).getDay()].value++; });

    var refCount = {};
    all.forEach(function (b) {
      (b.refs || []).forEach(function (r) {
        var n = (r.name || r.alias || "").replace(/^#/, "");
        if (n && n !== TAG) refCount[n] = (refCount[n] || 0) + 1;
      });
    });
    var topRefs = Object.keys(refCount).map(function (k) { return { label: k, value: refCount[k] }; })
      .sort(function (a, b) { return b.value - a.value; })
      .slice(0, 5);

    // ---- 抽样流：均匀抽样（random）或取最新（latest），整条可点击 ----
    var pool = all.slice();
    if (MODE === "random") {
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
    } else {
      pool.sort(function (a, b) { return (parseDate(b) ? parseDate(b).getTime() : 0) - (parseDate(a) ? parseDate(a).getTime() : 0); });
    }
    var sample = pool.slice(0, COUNT);
    var heroHtml = sample.map(function (b) {
      var d = parseDate(b);
      var time = d ? d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + " " + WEEKS[d.getDay()] : "";
      var chips = (b.refs || [])
        .map(function (r) { return (r.name || r.alias || "").replace(/^#/, ""); })
        .filter(function (n) { return n && n !== TAG; })
        .slice(0, 4)
        .map(function (n) { return '<span class="te-chip">#' + esc(n) + "</span>"; })
        .join("");
      var txt = extractText(b);
      if (txt.length > 600) txt = txt.slice(0, 600) + "…";
      return (
        '<div class="te-item" data-id="' + b.id + '" title="点击跳转原文">' +
        '<div class="te-txt">' + esc(txt || "（无文本内容）") + "</div>" +
        '<div class="te-meta"><span class="te-time">' + esc(time) + "</span>" +
        (chips ? '<span class="te-chips">' + chips + "</span>" : "") +
        "</div></div>"
      );
    }).join("");

    var capped = all.length >= POP_CAP ? "（最近 " + all.length + " 条）" : "";
    var autoTitle = "#" + TAG + " · " + (MODE === "latest" ? "最新 " + COUNT + " 条" : "随机回响");
    var title = typeof cfg.title === "string" && cfg.title.trim() ? cfg.title.trim() : autoTitle;
    var sub =
      "共 " + all.length + " 条" + capped +
      (MODE === "latest" ? " · 最新优先" : " · 随机抽样，刷新重抽");

    var statsHtml = "";
    if (SHOW_STATS) {
      statsHtml =
        '<div class="te-sec-title">📊 画像 · 基于' + (capped ? "最近 " + all.length + " 条" : "全部 " + dated.length + " 条") + (skipped ? "（另有 " + skipped + " 条无日期未计入图表）" : "") + "</div>" +
        '<div class="te-grid">' +
        '<div class="te-card"><h3>📅 月度分布（近 8 个月）</h3><div id="te-month"></div></div>' +
        '<div class="te-card"><h3>🕐 时段分布</h3><div id="te-period"></div></div>' +
        '<div class="te-card"><h3>📆 星期分布</h3><div id="te-week"></div></div>' +
        '<div class="te-card"><h3>🏷️ 高频引用标签 Top 5</h3><div id="te-refs"></div></div>' +
        "</div>";
    }

    app.innerHTML =
      '<div class="te-head"><h2>' + esc(title) + '</h2><span class="te-sub">' + esc(sub) + "</span></div>" +
      '<div class="te-hero">' + heroHtml + "</div>" +
      statsHtml +
      '<div class="te-footer">数据来自笔记库 · 点击条目跳转原文</div>';

    // 抽样流整条可点击（重拾的闭环：看到 → 回到那条笔记）
    Array.prototype.forEach.call(app.querySelectorAll(".te-item"), function (el) {
      el.addEventListener("click", function () { jumpTo(Number(el.getAttribute("data-id"))); });
    });

    if (SHOW_STATS) {
      monthBars(document.getElementById("te-month"), monthCounts);
      donut(document.getElementById("te-period"), periodData);
      hbars(document.getElementById("te-week"), weekData);
      hbars(document.getElementById("te-refs"), topRefs);
    }
  }

  (async function () {
    try {
      var sort = MODE === "latest" ? [["_modified", "DESC"]] : [["_random", "DESC"]];
      var q = {
        q: { kind: 100, conditions: [{ kind: 4, name: TAG }] },
        sort: sort,
        pageSize: POP_CAP,
      };
      if (MODE === "random") q.randomSeed = Date.now();
      var ids = await window.orca.invokeBackend("query", q);
      if (!ids || !ids.length) {
        app.innerHTML = '<div class="te-state">「#' + esc(TAG) + '」标签下暂无数据</div>';
        return;
      }
      var blocks = await window.orca.invokeBackend("get-blocks", ids);
      render(Array.isArray(blocks) ? blocks : []);
    } catch (e) {
      app.innerHTML = '<div class="te-state">加载失败：' + esc(e && e.message ? e.message : e) + "</div>";
    }
  })();
})();
</script>
