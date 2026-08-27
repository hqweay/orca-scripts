// @inject-template-id: knowledge-forge
// 用途: AI 知识熔炉——搜索/按标签/拖拽收集笔记块，AI 蒸馏成总结、关联、行动项、改写，一键写回今日日志
(function () {
  const STORAGE_KEY = "orca-knowledge-forge-session-v1";
  const STYLE_ID = "orca-knowledge-forge-style";
  const PAGE_SIZE = 20;

  // ========== 存档 ==========
  function defaultState() {
    return { mode: "distill", feed: [], result: "", lastRun: 0 };
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { return defaultState(); }
  }
  let state = loadState();
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ========== 纯文本（后端块优先 .text，回退 content 片段） ==========
  function blockText(b) {
    if (!b) return "";
    if (typeof b.text === "string" && b.text.trim()) return b.text;
    if (Array.isArray(b.content)) {
      return b.content.filter((f) => f && f.t === "t").map((f) => f.v).join("").trim();
    }
    return b.title || "";
  }
  function blockTitle(b) {
    const t = blockText(b).split("\n")[0].trim();
    return t ? (t.length > 30 ? t.slice(0, 30) + "…" : t) : "（无标题块）";
  }

  // ========== query 结果解析（number[] / { id } 对象 / { blocks } 容器） ==========
  function toBlockIds(results) {
    if (!results) return [];
    const list = Array.isArray(results) ? results : (results && results.blocks) || [];
    const ids = [];
    for (const item of list) {
      if (typeof item === "number") { if (item > 0) ids.push(item); continue; }
      if (item && typeof item === "object") {
        const id = item.id;
        if (typeof id === "number" && id > 0) ids.push(id);
      }
    }
    return Array.from(new Set(ids));
  }

  // ========== 收集料 ==========
  let ui = null;
  let announceTimer = null;
  async function addBlocks(blocks) {
    if (!blocks || !blocks.length) return 0;
    const seen = new Set(state.feed.map((f) => f.id));
    let added = 0;
    for (const b of blocks) {
      if (!b || seen.has(b.id)) continue;
      const text = blockText(b);
      if (!text || !text.trim()) continue;
      state.feed.push({ id: b.id, title: blockTitle(b), text: text.slice(0, 500) });
      seen.add(b.id);
      added++;
    }
    state.feed = state.feed.slice(-24);
    saveState();
    if (added) { renderFeed(); updateStatus(); }
    return added;
  }
  async function searchFeed(keyword) {
    const kw = keyword && keyword.trim();
    const q = {
      q: { kind: 100, conditions: kw ? [{ kind: 8, text: kw }] : [] },
      sort: [["_modified", "DESC"]],
      pageSize: PAGE_SIZE,
    };
    const results = await orca.invokeBackend("query", q);
    const ids = toBlockIds(results);
    if (!ids.length) return 0;
    const blocks = await orca.invokeBackend("get-blocks", ids);
    return addBlocks(blocks);
  }
  async function feedByTag(tagName) {
    const name = tagName && tagName.trim();
    if (!name) return 0;
    const blocks = await orca.invokeBackend("get-blocks-with-tags", [name]);
    return addBlocks(blocks);
  }

  // ========== AI 熔炼 ==========
  const MODES = {
    distill: { icon: "🔥", label: "蒸馏", prompt: "把下面这批笔记块蒸馏成 2~4 条要点，每条不超过 40 字，用 - 开头，中文输出。" },
    connect: { icon: "🕸️", label: "关联", prompt: "找出这批笔记块之间隐藏的联系、冲突或可合并的主题，列 3~5 条，每条用 - 开头，中文输出。" },
    action: { icon: "⚡", label: "行动", prompt: "从这批笔记块里提取可执行的任务，输出 - [ ] 待办清单，信息不足的用 ⚠️ 标注，中文输出。" },
    rewrite: { icon: "✍️", label: "改写", prompt: "把批笔记块内容重写为更清晰、更有条理的版本，用 # 小节组织，中文输出。" },
  };
  function setBusy(busy) {
    if (ui && ui.light) ui.light.classList.toggle("kf-light--busy", busy);
  }
  function announce(msg, kind) {
    kind = kind || "info";
    // 宿主级通知（可靠、显眼）：info / success / warn / error
    try { orca.notify(kind === "success" ? "success" : kind === "error" ? "error" : "info", msg); } catch (e) {}
    // 挂件内 toast 作为就近反馈
    if (ui && ui.toast) {
      ui.toast.textContent = msg;
      ui.toast.className = "kf-toast kf-toast--" + kind + " kf-toast--show";
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => {
        if (ui && ui.toast) ui.toast.className = "kf-toast kf-toast--" + kind;
      }, 4200);
    }
  }
  function errMsg(e) {
    const m = e && e.message ? String(e.message) : "";
    return m ? m.slice(0, 90) : "稍后再试";
  }
  async function runForge() {
    if (!state.feed.length) { announce("先把笔记块喂进来！", "error"); return; }
    if (typeof $inject.aiChat !== "function") { announce("AI 未配置", "error"); return; }
    const mode = MODES[state.mode] || MODES.distill;
    setBusy(true);
    announce("⚗️ 正在熔炼 " + state.feed.length + " 块…", "info");
    try {
      const body = state.feed.map((f, i) => "【" + (i + 1) + "】" + f.title + "\n" + f.text).join("\n\n");
      const text = await $inject.aiChat([
        { role: "system", content: "你是住在 Orca 笔记库里的 AI 蒸馏师。用户会给你一批笔记块。严格按任务要求输出，用户可见文案用中文。" },
        { role: "user", content: "任务：" + mode.prompt + "\n\n笔记块：\n" + body },
      ]);
      state.result = (text || "").trim();
      state.lastRun = Date.now();
      saveState();
      renderResult();
      updateStatus();
      announce("熔炼完成 ✨ 结果已生成", "success");
    } catch (e) {
      announce("AI 熔炼失败：" + errMsg(e), "error");
    } finally {
      setBusy(false);
    }
  }

  // ========== 写回今日日志 ==========
  async function writeBack() {
    if (!state.result) { announce("先熔炼出结果再写回", "error"); return; }
    try {
      const journal = await orca.invokeBackend("get-journal-block", new Date());
      if (!journal || !journal.id) { announce("找不到今日日志", "error"); return; }
      const label = (MODES[state.mode] || MODES.distill).label;
      const text = "# ⚗️ 知识熔炉 · " + label + "\n" + state.result;
      await orca.commands.invokeEditorCommand(
        "core.editor.batchInsertText",
        null,
        journal,
        "lastChild",
        text,
        false,
        false
      );
      announce("已写入今日日志 📔", "success");
    } catch (e) {
      announce("写回失败：" + errMsg(e), "error");
    }
  }

  // ========== 视图 ==========
  function render() {
    return '<div class="kf-widget">' +
      '<div class="kf-head">' +
        '<span class="kf-logo">⚗️</span>' +
        '<div class="kf-head-txt">' +
          '<div class="kf-title">AI 知识熔炉</div>' +
          '<div class="kf-sub">把笔记块炼成洞见</div>' +
        '</div>' +
        '<span class="kf-light" id="kfLight"></span>' +
      '</div>' +
      '<div class="kf-toast" id="kfToast"></div>' +
      '<div class="kf-feed-row">' +
        '<input class="kf-input" id="kfQuery" placeholder="关键词搜索笔记…" />' +
        '<button class="kf-btn kf-btn--ghost" id="kfSearchBtn">🔍 搜索收集</button>' +
        '<input class="kf-input" id="kfTag" placeholder="标签名（不加 #）…" />' +
        '<button class="kf-btn kf-btn--ghost" id="kfTagBtn">🏷️ 按标签收集</button>' +
      '</div>' +
      '<div class="kf-hint">↧ 也可以把笔记块直接拖进这里投喂</div>' +
      '<div class="kf-chips" id="kfChips">' +
        '<div class="kf-empty">还没有料，收集一些笔记块吧～</div>' +
      '</div>' +
      '<div class="kf-ops" id="kfOps"></div>' +
      '<div class="kf-result" id="kfResult">' +
        '<div class="kf-empty">选一种熔炼方式，AI 会基于投喂的笔记块输出</div>' +
      '</div>' +
      '<div class="kf-actions">' +
        '<button class="kf-btn kf-btn--primary" id="kfRunBtn">⚗️ 开始熔炼</button>' +
        '<button class="kf-btn" id="kfWriteBtn">📔 写回日志</button>' +
        '<button class="kf-btn" id="kfClearBtn">🧹 清空</button>' +
      '</div>' +
    '</div>';
  }
  function renderFeed() {
    if (!ui || !ui.chips) return;
    if (!state.feed.length) {
      ui.chips.innerHTML = '<div class="kf-empty">还没有料，收集一些笔记块吧～</div>';
      return;
    }
    ui.chips.innerHTML = "";
    state.feed.forEach((f, i) => {
      const chip = document.createElement("div");
      chip.className = "kf-chip";
      chip.textContent = f.title;
      chip.title = f.text;
      chip.addEventListener("click", () => {
        state.feed.splice(i, 1);
        saveState();
        renderFeed();
        updateStatus();
      });
      ui.chips.appendChild(chip);
    });
  }
  function renderOps() {
    if (!ui || !ui.ops) return;
    ui.ops.innerHTML = "";
    Object.keys(MODES).forEach((key) => {
      const m = MODES[key];
      const btn = document.createElement("button");
      btn.className = "kf-op" + (key === state.mode ? " kf-op--active" : "");
      btn.textContent = m.icon + " " + m.label;
      btn.title = m.prompt;
      btn.addEventListener("click", () => {
        state.mode = key;
        saveState();
        renderOps();
      });
      ui.ops.appendChild(btn);
    });
  }
  function renderResult() {
    if (!ui || !ui.result) return;
    if (!state.result) {
      ui.result.innerHTML = '<div class="kf-empty">选一种熔炼方式，AI 会基于投喂的笔记块输出</div>';
      return;
    }
    ui.result.textContent = state.result;
    ui.result.classList.remove("kf-result--fresh");
    void ui.result.offsetWidth;
    ui.result.classList.add("kf-result--fresh");
  }

  // ========== 聚焦 ==========
  function onFocus(container) {
    ui = {
      root: container.querySelector(".kf-widget"),
      light: container.querySelector("#kfLight"),
      toast: container.querySelector("#kfToast"),
      query: container.querySelector("#kfQuery"),
      tag: container.querySelector("#kfTag"),
      chips: container.querySelector("#kfChips"),
      ops: container.querySelector("#kfOps"),
      result: container.querySelector("#kfResult"),
      searchBtn: container.querySelector("#kfSearchBtn"),
      tagBtn: container.querySelector("#kfTagBtn"),
      runBtn: container.querySelector("#kfRunBtn"),
      writeBtn: container.querySelector("#kfWriteBtn"),
      clearBtn: container.querySelector("#kfClearBtn"),
    };
    if (!ui.root) { ui = null; return; }

    renderFeed();
    renderOps();
    renderResult();
    updateStatus();

    const doSearch = () => { if (ui) searchFeed(ui.query.value).then((n) => { if (ui) announce(n ? "收集了 " + n + " 块 🔍" : "没有匹配的笔记", n ? "success" : "info"); }); };
    ui.searchBtn.addEventListener("click", doSearch);
    ui.query.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
    ui.tagBtn.addEventListener("click", () => { if (ui) feedByTag(ui.tag.value).then((n) => { if (ui) announce(n ? "按标签收集了 " + n + " 块 🏷️" : "该标签下没有块", n ? "success" : "info"); }); });
    ui.runBtn.addEventListener("click", runForge);
    ui.writeBtn.addEventListener("click", writeBack);
    ui.clearBtn.addEventListener("click", () => {
      state.feed = [];
      state.result = "";
      saveState();
      renderFeed();
      renderResult();
      updateStatus();
      announce("熔炉已清空", "info");
    });

    // 整挂件接收块拖拽：把笔记块拖进来 = 投喂
    const detachDrop = $inject.attachBlockDrop(container, async (blockIds) => {
      if (!blockIds || !blockIds.length) { announce("（没有抓到大块…）", "info"); return; }
      try {
        const blocks = await orca.invokeBackend("get-blocks", blockIds);
        const n = await addBlocks(blocks);
        announce(n ? "投喂了 " + n + " 块 ✨" : "拖进来的块没有文本", n ? "success" : "info");
      } catch (e) {
        announce("读取块失败，稍后再试", "error");
      }
    });

    return () => {
      clearTimeout(announceTimer);
      announceTimer = null;
      detachDrop();
      ui = null;
    };
  }

  // ========== 状态快照 ==========
  function updateStatus() {
    if (!handle || typeof handle.setStatus !== "function") return;
    const n = state.feed.length;
    if (state.result && state.lastRun) handle.setStatus(n + " 块 · 已熔炼");
    else handle.setStatus(n + " 块 · 待熔炼");
  }

  // ========== 样式 ==========
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `.kf-widget {
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px 12px; box-sizing: border-box;
  color: var(--orca-text-1); font-size: 13px;
  background: linear-gradient(160deg, var(--orca-bg-1) 0%, var(--orca-bg-2) 100%);
}
.kf-widget * { box-sizing: border-box; }
.kf-head { display: flex; align-items: center; gap: 10px; }
.kf-logo { font-size: 30px; line-height: 1; animation: kfFloat 3.2s ease-in-out infinite; }
.kf-head-txt { flex: 1; min-width: 0; }
.kf-title { font-weight: 700; font-size: 15px; }
.kf-sub { font-size: 11.5px; color: var(--orca-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kf-light { width: 10px; height: 10px; border-radius: 50%; background: var(--orca-text-2); flex: none; }
.kf-light--busy {
  background: var(--orca-primary); box-shadow: 0 0 10px var(--orca-primary);
  animation: kfPulse 0.8s ease-in-out infinite;
}
.kf-toast {
  padding: 7px 10px; font-size: 12px; border-radius: 8px;
  opacity: 0; transform: translateY(-3px); pointer-events: none;
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.kf-toast--show { opacity: 1; transform: translateY(0); }
.kf-toast--info { background: var(--orca-bg-2); border: 1px solid var(--orca-border); color: var(--orca-text-1); }
.kf-toast--success { background: var(--orca-bg-2); border: 1px solid var(--orca-primary); color: var(--orca-primary); }
.kf-toast--error { background: var(--orca-bg-2); border: 1px solid #ff5a5a; color: #ff5a5a; }
.kf-feed-row { display: flex; flex-wrap: wrap; gap: 6px; }
.kf-input {
  flex: 1; min-width: 120px;
  padding: 6px 9px; font-size: 12.5px;
  background: var(--orca-bg-1); color: var(--orca-text-1);
  border: 1px solid var(--orca-border); border-radius: 8px;
  outline: none;
}
.kf-input:focus { border-color: var(--orca-primary); }
.kf-btn {
  padding: 6px 10px; font-size: 12.5px; cursor: pointer;
  background: var(--orca-bg-2); color: var(--orca-text-1);
  border: 1px solid var(--orca-border); border-radius: 8px;
  transition: transform 0.12s ease, border-color 0.12s ease;
}
.kf-btn:hover { transform: translateY(-1px); border-color: var(--orca-primary); }
.kf-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.kf-btn--primary { border-color: var(--orca-primary); color: var(--orca-primary); background: transparent; }
.kf-btn--primary:hover { background: var(--orca-primary); color: var(--orca-bg-1); }
.kf-btn--ghost { background: transparent; }
.kf-hint { font-size: 11.5px; color: var(--orca-text-2); text-align: center; opacity: 0.85; user-select: none; }
.kf-chips { display: flex; flex-wrap: wrap; gap: 5px; max-height: 92px; overflow-y: auto; }
.kf-chip {
  max-width: 150px; padding: 3px 9px; font-size: 11.5px;
  background: var(--orca-bg-2); border: 1px solid var(--orca-border); border-radius: 999px;
  cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: border-color 0.12s ease;
}
.kf-chip:hover { border-color: var(--orca-primary); text-decoration: line-through; }
.kf-ops { display: flex; gap: 6px; flex-wrap: wrap; }
.kf-op {
  flex: 1; min-width: 60px; padding: 7px 4px; font-size: 12.5px; cursor: pointer;
  background: var(--orca-bg-2); color: var(--orca-text-2);
  border: 1px solid var(--orca-border); border-radius: 10px;
  transition: all 0.15s ease;
}
.kf-op--active {
  border-color: var(--orca-primary); color: var(--orca-primary);
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.12);
}
.kf-result {
  min-height: 88px; max-height: 260px; overflow-y: auto;
  padding: 10px 12px; white-space: pre-wrap; word-break: break-word;
  font-size: 12.5px; line-height: 1.6;
  background: var(--orca-bg-1); border: 1px solid var(--orca-border); border-radius: 12px;
}
.kf-result--fresh { animation: kfFadeIn 0.45s ease; }
.kf-actions { display: flex; gap: 6px; }
.kf-empty { color: var(--orca-text-2); font-size: 12px; }
@keyframes kfFloat { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-4px) rotate(3deg); } }
@keyframes kfPulse { 0%, 100% { opacity: 0.4; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.1); } }
@keyframes kfFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
`;
    document.head.appendChild(style);
  }

  // ========== 注册 & 清理 ==========
  let handle = null;
  function register() {
    if (typeof $inject.registerSidebarGroup !== "function") return;
    injectStyle();
    handle = $inject.registerSidebarGroup({
      key: "knowledge-forge",
      title: $inject.scriptName,
      icon: "⚗️",
      parent: $inject.scriptGroup || undefined,
      status: "待投喂",
      render,
      onFocus,
    });
    updateStatus();
  }
  register();

  $inject.onUnload(() => {
    try { handle.unregister(); } catch (e) {}
    const style = document.getElementById(STYLE_ID);
    if (style && style.parentNode) style.parentNode.removeChild(style);
  });
})();
