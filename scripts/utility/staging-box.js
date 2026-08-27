// @inject-template-id: staging-box
// 用途: 暂存箱挂件——把块拖进来暂存，一键移动到光标处
;(function () {
  "use strict"

  const LS_KEY = "lets-inject.staging-box.v1"

  const state = { items: [], idSet: new Set() }
  let liveContainer = null
  let busy = false

  /* ---------- 工具函数 ---------- */
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]))
  }

  function fmtTime(v) {
    if (!v) return ""
    let d = null
    if (v instanceof Date) d = v
    else if (typeof v === "number") d = new Date(v >= 1e12 ? v : v * 1000)
    else { d = new Date(v); if (isNaN(d)) return "" }
    if (isNaN(d.getTime())) return ""
    const p = (n) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }

  function displayText(it) {
    const t = String(it.text || "").trim()
    return t || "(空块/附件)"
  }

  function getCursorBlockId() {
    try {
      const cd = orca.utils.getCursorDataFromSelection(window.getSelection())
      return cd && cd.anchor && cd.anchor.blockId ? cd.anchor.blockId : null
    } catch (e) { return null }
  }

  async function blockFrags(id) {
    const blocks = await orca.invokeBackend("get-blocks", [id])
    const b = blocks && blocks[0]
    if (!b) return null
    if (Array.isArray(b.content) && b.content.length) return b.content
    return [{ t: "t", v: b.text || "" }]
  }

  /* ---------- 持久化（localStorage，重启后暂存仍在） ---------- */
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state.items.map((i) => ({ id: i.id, text: i.text, created: i.created }))))
    } catch (e) {}
  }

  function loadItems() {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr)) return
      for (const it of arr) {
        if (it && typeof it.id === "number" && !state.idSet.has(it.id)) {
          state.items.push({ id: it.id, text: it.text || "", created: it.created || "" })
          state.idSet.add(it.id)
        }
      }
    } catch (e) {}
  }

  async function refreshTexts() {
    if (!state.items.length) return
    let blocks = []
    try { blocks = await orca.invokeBackend("get-blocks", state.items.map((i) => i.id)) } catch (e) { return }
    const map = new Map((blocks || []).map((b) => [b.id, b]))
    const kept = []
    for (const it of state.items) {
      const b = map.get(it.id)
      if (b) { it.text = b.text || ""; if (b.created) it.created = b.created; kept.push(it) }
    }
    state.items = kept
    state.idSet = new Set(kept.map((i) => i.id))
    save()
    refreshView()
    handle.setStatus(`已暂存 ${state.items.length} 块`)
  }

  /* ---------- 视图 ---------- */
  function render() {
    const n = state.items.length
    const list = state.items.map((it) => {
      const t = displayText(it)
      return `<li class="wstg-item">
        <button type="button" class="wstg-jump" data-act="jump" data-id="${it.id}" title="跳到原块：${esc(t)}">${esc(t)}</button>
        <span class="wstg-time" title="创建时间">${fmtTime(it.created)}</span>
        <button type="button" class="wstg-del" data-act="remove" data-id="${it.id}" title="移出暂存">✕</button>
      </li>`
    }).join("")

    return `<div class="wstg-toolbar">
        <button type="button" data-act="move" title="把暂存块移动到光标所在块之后（原位删除）">移动</button>
        <button type="button" data-act="copy" title="复制到光标所在块之后，原件保留">复制</button>
        <button type="button" data-act="merge" title="全部文本合并为一块，插入光标之后">合并</button>
        <button type="button" data-act="ai" title="AI 总结全部暂存内容，插入光标之后">AI</button>
        <button type="button" data-act="pick" title="随机跳到一个暂存块（抽签）">抽一个</button>
        <button type="button" data-act="copytext" title="复制全部暂存文本到剪贴板">文本</button>
        <button type="button" data-act="clear" title="清空暂存箱">清空</button>
      </div>
      <div class="wstg-status">已暂存 ${n} 块 · 把块拖进来</div>
      ${n ? `<ul class="wstg-list">${list}</ul>` : `<div class="wstg-empty">空空如也<br>把任意块拖进来暂存</div>`}`
  }

  function refreshView() {
    if (liveContainer) liveContainer.innerHTML = render()
  }

  function setBusy(b) {
    busy = b
    if (liveContainer) liveContainer.classList.toggle("wstg-busy", b)
    handle.setStatus(b ? "AI 总结中…" : `已暂存 ${state.items.length} 块`)
  }

  /* ---------- 数据操作 ---------- */
  function clearItems() {
    state.items = []
    state.idSet.clear()
    save()
    refreshView()
    handle.setStatus("已暂存 0 块")
  }

  function removeItem(id) {
    state.items = state.items.filter((i) => i.id !== id)
    state.idSet.delete(id)
    save()
    refreshView()
    handle.setStatus(`已暂存 ${state.items.length} 块`)
  }

  async function onDrop(blockIds) {
    if (!Array.isArray(blockIds) || !blockIds.length) return
    const blocks = await orca.invokeBackend("get-blocks", blockIds)
    let added = 0
    for (const b of blocks || []) {
      if (!b || !b.id || state.idSet.has(b.id)) continue
      state.items.push({ id: b.id, text: b.text || "", created: b.created || b.modified || "" })
      state.idSet.add(b.id)
      added++
    }
    if (added) {
      save()
      refreshView()
      handle.setStatus(`已暂存 ${state.items.length} 块`)
      orca.notify("success", `已暂存 ${added} 块`)
    }
  }

  /* ---------- 动作 ---------- */
  async function insertItemsAtCursor(ids) {
    const cursorId = getCursorBlockId()
    if (!cursorId) {
      orca.notify("warn", "请先在编辑区点击一个块，确定插入位置")
      return false
    }
    let ref = orca.state.blocks[cursorId]
    if (!ref) {
      orca.notify("warn", "找不到光标所在块")
      return false
    }
    for (const id of ids) {
      const frags = await blockFrags(id)
      if (!frags) continue
      const newId = await orca.commands.invokeEditorCommand("core.editor.insertBlock", null, ref, "after", frags)
      ref = orca.state.blocks[newId] || ref
    }
    return true
  }

  async function moveToCursor() {
    if (!state.items.length) { orca.notify("warn", "暂存箱是空的"); return }
    const cursorId = getCursorBlockId()
    if (!cursorId) { orca.notify("warn", "请先在编辑区点击一个块，确定移动位置"); return }
    const ids = state.items.map((i) => i.id)
    let moved = false
    try {
      await orca.commands.invokeEditorCommand("core.editor.moveBlocks", null, ids, cursorId, "after")
      moved = true
    } catch (e) { moved = false }
    if (!moved) {
      const ok = await insertItemsAtCursor(ids)
      if (!ok) return
      try { await orca.commands.invokeEditorCommand("core.editor.deleteBlocks", null, ids) }
      catch (e) { orca.notify("warn", "原件不在当前文档：已复制到光标处，但原件未能自动删除") }
    }
    clearItems()
    orca.notify("success", moved ? `已移动 ${ids.length} 块到光标处` : "已移动到光标处")
  }

  async function copyToCursor() {
    if (!state.items.length) { orca.notify("warn", "暂存箱是空的"); return }
    const ok = await insertItemsAtCursor(state.items.map((i) => i.id))
    if (ok) orca.notify("success", `已复制 ${state.items.length} 块到光标处（暂存保留）`)
  }

  async function mergeToCursor() {
    if (!state.items.length) { orca.notify("warn", "暂存箱是空的"); return }
    const text = state.items.map((it, i) => `${i + 1}. ${displayText(it)}`).join("\n")
    const cursorId = getCursorBlockId()
    if (!cursorId) { orca.notify("warn", "请先在编辑区点击一个块"); return }
    const ref = orca.state.blocks[cursorId]
    if (!ref) { orca.notify("warn", "找不到光标所在块"); return }
    await orca.commands.invokeEditorCommand("core.editor.insertBlock", null, ref, "after", [{ t: "t", v: text }])
    clearItems()
    orca.notify("success", "已合并为一块插入光标处")
  }

  async function aiSummary() {
    if (!state.items.length) { orca.notify("warn", "暂存箱是空的"); return }
    const text = state.items.map((it, i) => `${i + 1}. ${displayText(it)}`).join("\n")
    setBusy(true)
    try {
      const res = await $inject.aiChat([
        { role: "system", content: "你是笔记整理助手，用简洁的中文总结要点，多用短句和列表。" },
        { role: "user", content: `请总结以下暂存笔记的核心内容：\n\n${text}` }
      ])
      const cursorId = getCursorBlockId()
      if (!cursorId) { orca.notify("warn", "请先在编辑区点击一个块"); return }
      const ref = orca.state.blocks[cursorId]
      if (!ref) { orca.notify("warn", "找不到光标所在块"); return }
      await orca.commands.invokeEditorCommand("core.editor.insertBlock", null, ref, "after", [{ t: "t", v: res }])
      orca.notify("success", "AI 总结已插入光标处")
    } catch (e) {
      orca.notify("error", "AI 总结失败：" + (e && e.message || e))
    } finally {
      setBusy(false)
    }
  }

  function randomPick() {
    if (!state.items.length) { orca.notify("warn", "暂存箱是空的"); return }
    const it = state.items[Math.floor(Math.random() * state.items.length)]
    orca.nav.goTo("block", { blockId: it.id })
  }

  async function copyText() {
    if (!state.items.length) { orca.notify("warn", "暂存箱是空的"); return }
    const text = state.items.map((it, i) => `${i + 1}. ${displayText(it)}`).join("\n")
    try {
      await navigator.clipboard.writeText(text)
      orca.notify("success", "已复制全部暂存文本到剪贴板")
    } catch (e) {
      orca.notify("error", "复制失败，请手动选择文本")
    }
  }

  /* ---------- 交互 ---------- */
  async function onClick(e) {
    const btn = e.target.closest("[data-act]")
    if (!btn || busy) return
    e.stopPropagation()
    const act = btn.dataset.act
    const id = Number(btn.dataset.id) || 0
    try {
      if (act === "jump" && id) { orca.nav.goTo("block", { blockId: id }); return }
      if (act === "remove" && id) { removeItem(id); return }
      if (act === "move") { await moveToCursor(); return }
      if (act === "copy") { await copyToCursor(); return }
      if (act === "merge") { await mergeToCursor(); return }
      if (act === "ai") { await aiSummary(); return }
      if (act === "pick") { randomPick(); return }
      if (act === "copytext") { await copyText(); return }
      if (act === "clear") { clearItems(); orca.notify("info", "暂存箱已清空"); return }
    } catch (err) {
      orca.notify("error", "操作失败：" + (err && err.message || err))
    }
  }

  function onFocus(container) {
    container.classList.add("wstg-root")
    liveContainer = container
    container.addEventListener("click", onClick)
    const detachDrop = $inject.attachBlockDrop(container, (blockIds) => {
      onDrop(blockIds).catch((err) => orca.notify("error", "暂存失败：" + (err && err.message || err)))
    })
    refreshView()
    return () => {
      container.removeEventListener("click", onClick)
      try { detachDrop() } catch (e) {}
      liveContainer = null
    }
  }

  /* ---------- 样式（收敛在 .wstg-root 下） ---------- */
  const CSS = `
.wstg-root{ font-size:13px; line-height:1.5; color:var(--orca-text-color, inherit); }
.wstg-root .wstg-toolbar{ display:flex; flex-wrap:wrap; gap:6px; padding:8px 10px 6px; }
.wstg-root .wstg-toolbar button{
  appearance:none; border:1px solid var(--orca-border-color, color-mix(in srgb, currentColor 25%, transparent));
  background:var(--orca-bg-subtle, transparent); color:inherit; border-radius:6px;
  padding:3px 9px; font-size:12px; cursor:pointer;
}
.wstg-root .wstg-toolbar button:hover{ background:var(--orca-bg-hover, color-mix(in srgb, currentColor 10%, transparent)); }
.wstg-root .wstg-status{ padding:2px 12px 8px; font-size:11px; color:var(--orca-color-text-2, color-mix(in srgb, currentColor 60%, transparent)); }
.wstg-root .wstg-list{
  list-style:none; margin:0; padding:4px 10px 12px;
  max-height:min(60vh, 420px); overflow-y:auto;
  display:flex; flex-direction:column; gap:5px;
}
.wstg-root .wstg-item{
  display:flex; align-items:center; gap:6px; padding:5px 8px;
  border:1px solid var(--orca-border-color, color-mix(in srgb, currentColor 18%, transparent));
  border-radius:8px; background:var(--orca-bg-subtle, color-mix(in srgb, currentColor 4%, transparent));
}
.wstg-root .wstg-jump{
  flex:1; min-width:0; text-align:left; background:none; border:none; padding:0;
  color:inherit; cursor:pointer; font-size:12px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.wstg-root .wstg-jump:hover{ color:var(--orca-accent-color, inherit); text-decoration:underline; }
.wstg-root .wstg-time{ flex:none; font-size:10px; color:var(--orca-color-text-2, color-mix(in srgb, currentColor 55%, transparent)); }
.wstg-root .wstg-del{
  flex:none; background:none; border:none; padding:2px 4px; font-size:12px; line-height:1;
  color:var(--orca-color-text-2, inherit); cursor:pointer; border-radius:4px;
}
.wstg-root .wstg-del:hover{ color:var(--orca-danger-color, inherit); background:var(--orca-bg-hover, color-mix(in srgb, currentColor 10%, transparent)); }
.wstg-root .wstg-empty{ padding:28px 12px; text-align:center; font-size:12px; color:var(--orca-color-text-2, color-mix(in srgb, currentColor 55%, transparent)); }
.wstg-root.wstg-busy{ opacity:.6; pointer-events:none; }
`

  /* ---------- 启动 ---------- */
  loadItems()

  const styleEl = document.createElement("style")
  styleEl.id = "wstg-style"
  styleEl.textContent = CSS
  document.head.appendChild(styleEl)

  const handle = $inject.registerSidebarGroup({
    key: "lets-inject.staging-box",
    title: $inject.scriptName || "暂存箱",
    icon: "ti ti-inbox",
    parent: $inject.scriptGroup || undefined,
    status: `已暂存 ${state.items.length} 块`,
    render,
    onFocus
  })

  refreshTexts()

  $inject.onUnload(() => {
    try { handle.unregister() } catch (e) {}
    try { styleEl.remove() } catch (e) {}
  })
})();
