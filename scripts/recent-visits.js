// @inject-template-id: recent-visits
// 用途: 最近访问挂件 —— 记录最近打开过的块（页面、日记均含标题/日期），在侧边栏「更多」tab 常驻显示，点击即跳回
// journal 兼容：日记根块没有文本/别名，标题以面板日期参数为权威格式化为「X年X月X日 日记」。
// 稳定性：面板切换瞬间块 id / 数据可能未就绪 —— 未就绪时进入 400ms 重试网；
//         journal 一律以 viewArgs.date 走后端 get-journal-block 权威反查（消除 viewState 残留旧 id 的竞态）。
// 点击跳转：journal 条目用 goTo("journal",{date}) 保持日记视图上下文——
//         若跳成 block 视图，本体「上/下一篇日记」导航会失效（面板丢失日期上下文）。

(() => {
  // ---------- 依赖守卫 ----------
  if (!window.Valtio || typeof window.Valtio.subscribe !== "function") {
    orca.notify("error", "环境缺少 Valtio，最近访问挂件无法启动");
    return;
  }

  const MAX_DEFAULT = 30; // 默认最多保留条数；可在设置页「脚本配置」调整
  function maxKeep() {
    try {
      var m = Number($inject.config().max);
      if (Number.isFinite(m) && m > 0) return Math.floor(m);
    } catch (e) {}
    return MAX_DEFAULT;
  }
  const STORE_KEY = () => `inject-recent-${orca.state.repo}`; // repo 隔离

  // ---------- 数据 ----------
  let list = [];
  try {
    const raw = localStorage.getItem(STORE_KEY());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed
          .filter((x) => x && typeof x.id === "number" && typeof x.title === "string")
          .slice(0, maxKeep());
      }
    }
  } catch (e) { /* 忽略损坏的存储 */ }

  let lastFocused = null; // 上次已记录的焦点块
  let containerRef = null; // 挂件聚焦容器引用（聚焦期间实时刷新用）

  const persist = () => {
    try { localStorage.setItem(STORE_KEY(), JSON.stringify(list)); } catch (e) { /* ignore */ }
  };

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  const fmtJournalDate = (d) =>
    `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

  const startOfDay = (sec) => {
    const d = new Date(sec * 1000);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  };

  // ---------- 面板递归 walk ----------
  // 返回 { view, id?, journalDate? }。journal 附带面板日期（标题权威来源）。
  const getFocused = (p) => {
    if (!p || p.locked) return null;
    if (p.id === orca.state.activePanel) {
      if (p.view === "block") {
        const id = p.viewArgs?.blockId ? Number(p.viewArgs.blockId) : null;
        return id ? { view: "block", id } : null;
      }
      if (p.view === "journal") {
        let id = null;
        if (p.viewArgs?.blockId) id = Number(p.viewArgs.blockId);
        else {
          const k = Object.keys(p.viewState || {}).filter((x) => !isNaN(Number(x)));
          if (k.length) id = Number(k[0]);
        }
        let journalDate = null;
        if (p.viewArgs?.date) {
          const d = new Date(p.viewArgs.date);
          if (!isNaN(d)) journalDate = d;
        }
        return { view: "journal", id, journalDate };
      }
      return null;
    }
    for (const c of p.children || []) { const r = getFocused(c); if (r) return r; }
    return null;
  };

  // 找主编辑面板（block/journal），点击跳转前先把焦点切回去，避免侧边栏聚焦态把分栏整体替换掉
  const findMainPanel = (p) => {
    if (!p) return null;
    if (!p.locked && (p.view === "block" || p.view === "journal")) return p.id;
    for (const c of p.children || []) { const r = findMainPanel(c); if (r) return r; }
    return null;
  };

  // ---------- 记录（唯一入口）：MRU 置顶 + 更新标题/日期 + 持久化 + 实时刷新 ----------
  // 重复访问也置顶——「最近访问」按访问时间排序，跳回目标永远在最上面。
  const recordVisit = (id, title, dateMs) => {
    const idx = list.findIndex((x) => x.id === id);
    const entry = idx >= 0 ? list[idx] : { id, title };
    const titleChanged = entry.title !== title;
    entry.title = title;
    if (dateMs != null) entry.date = dateMs;
    if (idx > 0) list.splice(idx, 1);
    if (idx !== 0) list.unshift(entry); // 已在顶部则原地不动，避免无谓持久化
    if (list.length > maxKeep()) list.length = maxKeep();
    lastFocused = id;
    if (idx !== 0 || titleChanged || dateMs != null) {
      persist(); // 只在有实质变化（换位 / 改标题 / 补日期）时持久化与刷新
      handle.setStatus(`记录 ${list.length} 条`);
      if (containerRef) containerRef.innerHTML = render(); // 聚焦期间实时刷新列表
    }
    return true;
  };

  // ---- 脚本设置（声明后 $inject.openConfig 才有内容）----
  $inject.registerSettings(
    [{ name: "max", label: "最多保留条数", type: "number", default: MAX_DEFAULT }],
    function (v) {
      var n = Number(v.max);
      if (Number.isFinite(n) && n > 0 && list.length > n) {
        list.length = n;
        persist();
        if (containerRef) containerRef.innerHTML = render();
      }
    },
  );

  // ---------- 重试网：数据未就绪时按 400ms 补记（上限 6 次），成功记录后清零 ----------
  let retryTimer = null;
  let retryCount = 0;
  const scheduleRetry = () => {
    if (retryTimer || retryCount >= 6) return;
    retryCount += 1;
    retryTimer = setTimeout(() => { retryTimer = null; track(); }, 400);
  };

  // ---------- journal 异步权威解析：日期 → 后端反查块 id（按日期去重防抖） ----------
  const journalInFlight = new Set();
  const resolveJournalByDate = (dayStartSec, dateObj) => {
    const key = String(dayStartSec);
    if (journalInFlight.has(key)) return;
    journalInFlight.add(key);
    orca.invokeBackend("get-journal-block", dateObj)
      .then((b) => {
        journalInFlight.delete(key);
        if (b && b.id != null) {
          recordVisit(Number(b.id), `${fmtJournalDate(dateObj)} 日记`, dateObj.getTime());
          if (containerRef) containerRef.innerHTML = render();
        }
      })
      .catch(() => { journalInFlight.delete(key); });
  };

  // ---------- 追踪（热路径：每个按键都会触发，必须廉价） ----------
  const track = () => {
    const info = getFocused(orca.state.panels);
    if (!info) return;

    if (info.view === "journal") {
      // journal：viewArgs.date 为权威（viewState 可能残留上一天的旧 id）。
      if (info.journalDate) {
        const dayStartSec = startOfDay(info.journalDate.getTime() / 1000);
        // 同步快路径：候选块已就绪且创建日与日记日期一致 → 直接记录
        if (info.id != null) {
          const b = orca.state.blocks[info.id];
          if (b) {
            const createdDay = startOfDay(new Date(b.created).getTime() / 1000);
            if (createdDay === dayStartSec) {
              retryCount = 0;
              recordVisit(info.id, `${fmtJournalDate(info.journalDate)} 日记`, info.journalDate.getTime());
              return;
            }
            // 创建日与面板日期不符（如懒创建的未来页）→ 走异步权威反查
          }
        }
        resolveJournalByDate(dayStartSec, info.journalDate);
      }
      return;
    }

    const focused = info.id;
    if (focused == null) { scheduleRetry(); return; }
    const b = orca.state.blocks[focused];
    if (!b) { scheduleRetry(); return; } // 数据未就绪：等重试补记
    retryCount = 0;

    const title =
      (b.aliases && b.aliases[0]) ||
      (b.text && b.text.trim() ? b.text.slice(0, 20) : "(无标题)");
    recordVisit(focused, title);
  };

  const unsub = window.Valtio.subscribe(orca.state, track);

  // ---------- 渲染（纯函数） ----------
  const render = () => {
    if (!list.length) {
      return `<div class="ri-wrap"><div class="ri-empty">暂无访问记录<br>打开任意页面后自动记录</div></div>`;
    }
    return `<div class="ri-wrap"><div class="ri-list">${list
      .map(
        (x) =>
          `<div class="ri-item${x.date != null ? " is-journal" : ""}" data-id="${x.id}" title="${escapeHtml(x.title)}">
             <span class="ri-title">${escapeHtml(x.title)}</span>
             <span class="ri-id">#${x.id}</span>
           </div>`
      )
      .join("")}</div></div>`;
  };

  // ---------- 侧边栏挂件 ----------
  const handle = $inject.registerSidebarGroup({
    key: "recent-visits",
    title: $inject.scriptName,
    icon: "ti ti-history",
    actions: [{ icon: "ti ti-settings", title: "配置", onClick: function () { $inject.openConfig() } }],
    parent: $inject.scriptGroup || undefined,
    status: `记录 ${list.length} 条`,
    render,
    onFocus: (container) => {
      containerRef = container;
      const onClick = (e) => {
        const row = e.target.closest(".ri-item");
        if (!row) return;
        const id = Number(row.getAttribute("data-id"));
        if (!id) return;
        const entry = list.find((x) => x.id === id);
        const mainPanelId = findMainPanel(orca.state.panels);
        if (mainPanelId) { try { orca.nav.switchFocusTo(mainPanelId); } catch (e) { /* ignore */ } }
        // 日记条目保持 journal 视图上下文——跳成 block 视图会让本体的
        // 「上/下一篇日记」导航失效；非日记条目才走 block 打开。
        if (entry && entry.date != null) {
          orca.nav.goTo("journal", { date: new Date(entry.date) }, mainPanelId || undefined);
        } else {
          orca.nav.goTo("block", { blockId: id }, mainPanelId || undefined);
        }
      };
      container.addEventListener("click", onClick); // 事件委托，重渲染不丢监听
      return () => {
        container.removeEventListener("click", onClick);
        containerRef = null;
      };
    },
  });

  // ---------- 样式（收敛到 ri- 前缀） ----------
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .ri-wrap { padding: 4px; position: relative; }
    .ri-empty { padding: 24px 12px; text-align: center; color: var(--orca-color-text-2, rgba(128,128,128,.75)); font-size: 13px; line-height: 1.7; }
    .ri-list { display: flex; flex-direction: column; gap: 2px; }
    .ri-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; cursor: pointer; }
    .ri-item:hover { background: var(--orca-color-selection, rgba(128,128,128,.12)); }
    .ri-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--orca-fg, inherit); }
    .ri-id { flex: none; font-size: 11px; color: var(--orca-color-text-2, rgba(128,128,128,.75)); }
  `;
  document.head.appendChild(styleEl);

  // ---------- 卸载清理（注册后脚本才具备可卸载状态） ----------
  $inject.onUnload(() => {
    unsub();
    if (retryTimer) clearTimeout(retryTimer);
    handle.unregister();
    styleEl.remove();
  });
})();
