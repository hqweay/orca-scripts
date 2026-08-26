// @inject-template-id: elegant-timer
/* 用途: 计时打卡
 * 在侧边栏「更多」tab 注册「计时打卡」挂件：一个简洁的计时时钟。
 * 开始计时有两种方式：
 * - 录入任务名点击开始 → 在今日日志创建一个块（任务名作为块文本）、打上所选标签、
 *   给开始时间赋值；点击结束 → 给结束时间赋值。
 * - 把笔记块拖入挂件 → 不建新块，直接在拖入的块（可多块）上打所选标签、写 Start，
 *   该块本身就是记录；结束把 End 写回同一批块。数据形状与 time-log 读取契约
 *   完全一致（块文本带纯标签名尾巴，Start/End 挂 refs 数据，绝对秒），跨午夜安全。
 * 写入后自动触发时间统计即时刷新（window.__orcaTimeLogRefresh，time-log 提供）。
 *
 * 实时性机制（关键）：录入建块走 MCP insert_markdown（与编辑器焦点无关），随后脚本内联
 * 完成 time-log 的刷新仪式：get-block-tree 拉整棵子树回写 orca.state.blocks + 强制
 * get-block 拉根（补根.children 里的新块 id）→ 编辑器立即重渲染。时间属性（Start/End）
 * 走 MCP insert_tags 挂到 refs.data，与块文本分离。拖入模式不改块结构，只重挂标签，
 * 刷新各块子树即可。撤销时（录入模式）deleteBlock 删块 + dropState 摘 state，
 * （拖入模式）remove_tags 摘标签——根.children 由刷新仪式收口，与宿主命令轨迹一致。
 *
 * 配置（脚本顶部）：
 * - GROUPS：可配置多组，每组为 tag（标签名）、startProp/endProp（对应 time-log
 *   设置里该组的时间属性名，默认 Start time/End time）、color（组色）、label（UI 显示名）。
 *   空态点组药丸切换本次记录到哪组，选中记忆在本地。
 * - THEME：主渐变from/to，可个性化配色。
 * - DEFAULT_TASK / KEEP_HISTORY：默认任务名 / 任务名历史条数。
 *
 * 持久化：任务名开始即写入块文本（随记录永存），本地另存最近任务名历史与输入草稿；
 * 计时会话（blockId/blockIds/fromDrop/startedAtSec/tag/taskName）持久化，重开软件后
 * autoRun 加载自动恢复。
 */
const MCP_URL = "http://localhost:18672/mcp"
const GROUPS = [
  { tag: "Task",  startProp: "Start time", endProp: "End time",  color: "#7c5cff", label: "专注" },
  { tag: "Study", startProp: "开始时间",   endProp: "结束时间",  color: "#38bdf8", label: "学习" },
]
const DEFAULT_GROUP = 0
const DEFAULT_TASK = "专注"
const KEEP_HISTORY = 6
const THEME = { from: "#7c5cff", to: "#38bdf8" }

// ---- 运行态（脚本作用域；会话持久化在 localStorage，重开可恢复） ----
var session = { running: false, blockId: null, blockIds: [], fromDrop: false, startedAtSec: 0, tag: "", taskName: "" }
var lastJournalId = null
var selectedGroup = null
var draftName = ""
var lastDone = null
var ui = null
var tickId = null
var discardArmedAt = 0

// ---- localStorage（按库命名空间隔离） ----
function repoId() { return (orca && orca.state && orca.state.repo) || "" }
function lsKeys() {
  var r = repoId()
  return {
    session: "elegant-timer:session:" + r,
    history: "elegant-timer:history:" + r,
    draft: "elegant-timer:draft:" + r,
    group: "elegant-timer:group:" + r,
  }
}
function saveSession() { try { localStorage.setItem(lsKeys().session, JSON.stringify(session)) } catch (e) {} }
function loadSession() { try { var s = JSON.parse(localStorage.getItem(lsKeys().session) || "null"); if (s && s.running) return s } catch (e) {} return null }
function clearSession() { try { localStorage.removeItem(lsKeys().session) } catch (e) {} }
function loadHistory() { try { var a = JSON.parse(localStorage.getItem(lsKeys().history) || "[]"); return Array.isArray(a) ? a : [] } catch (e) { return [] } }
function pushHistory(name) { if (!name) return; try { var a = loadHistory().filter(function (x) { return x !== name }); a.unshift(name); if (a.length > KEEP_HISTORY) a = a.slice(0, KEEP_HISTORY); localStorage.setItem(lsKeys().history, JSON.stringify(a)) } catch (e) {} }
function removeHistory(name) { if (!name) return; try { var a = loadHistory().filter(function (x) { return x !== name }); localStorage.setItem(lsKeys().history, JSON.stringify(a)) } catch (e) {} }
function loadDraft() { try { return localStorage.getItem(lsKeys().draft) || "" } catch (e) { return "" } }
function saveDraft(v) { try { localStorage.setItem(lsKeys().draft, v) } catch (e) {} }
function loadGroupIndex() { try { return Number(localStorage.getItem(lsKeys().group)) } catch (e) { return DEFAULT_GROUP } }

function findGroup(tag) { for (var i = 0; i < GROUPS.length; i++) { if (GROUPS[i].tag === tag) return GROUPS[i] } return null }
function currentGroup() { return session.tag ? (findGroup(session.tag) || GROUPS[0]) : (selectedGroup || GROUPS[DEFAULT_GROUP] || GROUPS[0]) }

/* 拖入块的干净文本：优先拼 content 里 t==="t" 的片段（无标签尾巴），
 * 回退 b.text 并剥掉行尾 #Tag 尾巴（否则 taskName 会带尾标签，计时里再拼一次 #tag）。 */
function cleanBlockText(b) {
  if (!b) return ""
  var s = ""
  if (Array.isArray(b.content)) {
    for (var i = 0; i < b.content.length; i++) { var f = b.content[i]; if (f && f.t === "t" && f.v != null) s += String(f.v) }
  }
  if (!s && b.text) s = String(b.text)
  return s.trim().replace(/s*#S+s*$/, "").trim()
}

// ---- 时间工具 ----
function sec() { return Math.floor(Date.now() / 1000) }
function two(n) { return String(n).padStart(2, "0") }
function fmtHMS(total) { if (!isFinite(total) || total < 0) total = 0; var h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60; return two(h) + ":" + two(m) + ":" + two(s) }
function fmtTime(ts) { var d = new Date(ts * 1000); return two(d.getHours()) + ":" + two(d.getMinutes()) }

// ---- MCP 写路径（与 lets-time-log 同源，与编辑器焦点无关） ----
async function callTool(name, args) {
  var token = String((orca && orca.state && orca.state.settings ? orca.state.settings[50] : "") || "").trim() || "orca-note-mcp"
  var res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream", "Authorization": "Bearer " + token },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: name, arguments: args } }),
  })
  var text = await res.text()
  var data = null
  var line = text.split("\n").map(function (l) { return l.trim() }).find(function (l) { return l.indexOf("data:") === 0 })
  try { data = JSON.parse(line ? line.slice(5).trim() : text) } catch (e) {}
  if (!res.ok || (data && data.error)) throw new Error((data && data.error && data.error.message) || ("HTTP " + res.status))
  return data && data.result
}
/* MCP insert_markdown 建块后，新块是日记根的最后子块（position:lastChild），
 * get-block 日记根 → 取最后一个 children id。 */
async function journalLastChildId(jId) {
  try {
    var b = await orca.invokeBackend("get-block", jId)
    var ch = (b && b.children) || []
    if (ch.length) { var id = Number(ch[ch.length - 1]); if (Number.isInteger(id) && id > 0) return id }
  } catch (e) {}
  return null
}
/* 写后让编辑器立即看到新块/新标签（time-log 刷新仪式内联版，也适用于拖入的任意块）：
 * ① get-block-tree 拉整棵子树回写 state（触发 valtio 重渲染，与刷新面板同机制）；
 * ② get-block-tree 的 SQL 排除根 → 强制执行 get-block 拉根、回写根.children（含新块 id）。 */
async function refreshTree(rootId) {
  if (!rootId) return
  try {
    var tree = await orca.invokeBackend("get-block-tree", rootId)
    if (Array.isArray(tree)) { for (var i = 0; i < tree.length; i++) { var b = tree[i]; if (b && b.id != null) (orca.state.blocks)[b.id] = b } }
  } catch (e) {}
  try {
    var root = await orca.invokeBackend("get-block", rootId)
    if (root && root.id != null) (orca.state.blocks)[root.id] = root
  } catch (e) {}
}
function normVal(v) { if (v instanceof Date) return Math.floor(v.getTime() / 1000); if (typeof v === "number") return Math.floor(v); if (typeof v === "string") { var n = Number(v); if (v.trim() !== "" && !Number.isNaN(n)) return n } return v }
/* 读回某块某组标签的现有 refs 属性（合并待保留的其它自定义属性）。 */
async function readTagProps(blockId, g) {
  var props = {}
  try {
    var b = await orca.invokeBackend("get-block", blockId)
    var refs = (b && b.refs) || []
    for (var i = 0; i < refs.length; i++) { var r = refs[i]; if (r && r.alias === g.tag && r.data) { for (var j = 0; j < r.data.length; j++) { var p = r.data[j]; if (p && p.name) props[p.name] = normVal(p.value) } } }
  } catch (e) {}
  return props
}
/* remove+insert 重建某块某组标签（丢弃该标签本身再写回指定属性）。 */
async function writeTagProps(blockId, g, props) {
  var rid = repoId()
  await callTool("remove_tags", { repoId: rid, blockIds: [blockId], tags: [g.tag] })
  await callTool("insert_tags", { repoId: rid, blockIds: [blockId], tags: [{ name: g.tag, props: props }] })
}
/* 改块标签时间属性：Start/End 一律以调用方传入的权威秒值写入（读回仅用于保留其它属性），
 * 与 updateRecordTimes 同法（remove+insert 重建）。 */
async function patchBlockTimes(blockId, g, startSec, endSec) {
  var props = await readTagProps(blockId, g)
  props[g.startProp] = startSec
  props[g.endProp] = endSec
  await writeTagProps(blockId, g, props)
}
/* 拖入开始：块可能已带该标签（上一次完整记录）→ 覆盖 Start、删除旧 End，防 start>end 脏记录。 */
async function patchBlockStart(blockId, g, startSec) {
  var props = await readTagProps(blockId, g)
  props[g.startProp] = startSec
  delete props[g.endProp]
  await writeTagProps(blockId, g, props)
}
/* 拖入撤销：批量移除标签 + 摘 state + 刷新各块子树（块本体保留）。 */
async function undoDropTags(blockIds, tag) {
  for (var i = 0; i < blockIds.length; i++) {
    try { await callTool("remove_tags", { repoId: repoId(), blockIds: [blockIds[i]], tags: [tag] }) } catch (e) {}
    dropState(blockIds[i])
  }
  for (var i = 0; i < blockIds.length; i++) { await refreshTree(blockIds[i]) }
  refreshTimeLogNow()
}
async function deleteBlock(id) { if (!id) return; try { await callTool("delete_blocks", { repoId: repoId(), blockIds: [id] }) } catch (e) {} }
function resetRunning() { session = { running: false, blockId: null, blockIds: [], fromDrop: false, startedAtSec: 0, tag: "", taskName: "" }; clearSession(); if (ui) renderAll() }

// ---- 写后让 time-log 即时刷新（time-log 提供 hook；载荷带权威 start/end，不依赖回读） ----
function dropState(id) { try { delete (orca.state.blocks)[id] } catch (e) {} }
function refreshTimeLogNow(info) {
  var ok = false
  try { if (window.__orcaTimeLogRefresh) ok = window.__orcaTimeLogRefresh(info || undefined) } catch (e) {}
  // 快路径未命中（块不在 state / 无对应组）才延迟慢路径收口（依赖标签索引对账）
  if (!ok) setTimeout(function () { try { if (window.__orcaTimeLogRefresh) window.__orcaTimeLogRefresh() } catch (e) {} }, 1500)
}

// ---- 计时开始/结束 ----
async function startTimer() {
  if (session.running) return
  var name = (draftName || "").trim() || DEFAULT_TASK
  var g = currentGroup()
  var now = sec()
  try {
    var journal = await orca.invokeBackend("get-journal-block", new Date(now * 1000))
    if (!journal || journal.id == null) { orca.notify("warn", "无法定位今日日志"); return }
    session.running = true; session.startedAtSec = now; session.tag = g.tag; session.taskName = name; session.blockId = null
    lastJournalId = journal.id
    renderAll()
    // 建块走 MCP insert_markdown（弹窗/挂件上下文不定有编辑器焦点，insertBlock 会返回 null）。
    // MCP 不经 orca.state.blocks → 写后必须内联 time-log 刷新仪式（get-block-tree 拉树回写
    // state + 强制 get-block 拉根补 children），编辑器才看得见新块。
    await callTool("insert_markdown", { repoId: repoId(), refBlockId: journal.id, position: "lastChild", text: name + " #" + g.tag })
    var fresh = await journalLastChildId(journal.id)
    if (fresh == null) throw new Error("新块定位失败")
    // 时间属性仍走 MCP insert_tags（refs.data），与块文本分离，绝不内联进 text。
    var sp = {}; sp[g.startProp] = now
    await callTool("insert_tags", { repoId: repoId(), blockIds: [fresh], tags: [{ name: g.tag, props: sp }] })
    session.blockId = fresh; session.blockIds = [fresh]; session.fromDrop = false
    await refreshTree(journal.id)
    pushHistory(name); draftName = ""; saveDraft("")
    saveSession()
    renderAll()
    refreshTimeLogNow({ id: fresh, tag: g.tag, start: now, text: name })
    orca.notify("success", "开始:" + name + " · " + g.label, { title: "点此撤销", action: function () { resetRunning(); deleteBlock(fresh); dropState(fresh); refreshTree(lastJournalId); refreshTimeLogNow() } })
  } catch (err) {
    var gone = session.blockId
    resetRunning()
    if (gone) { try { await deleteBlock(gone) } catch (e) {} dropState(gone); refreshTree(lastJournalId); refreshTimeLogNow() }
    orca.notify("error", "开始失败: " + (err && err.message ? err.message : err))
  }
}
/* 拖入开始：直接在拖入的块（可多块）上打所选标签 + 写 Start，块本体即记录。
 * 与录入模式共享会话/UI/撤销语义，仅跳过建块与任务名写块这两个环节。 */
async function startTimerOnBlock(blockIds, name) {
  if (session.running) return
  var ids = (blockIds || []).filter(function (id) { return Number.isInteger(id) && id > 0 })
  if (!ids.length || !name) return
  var g = currentGroup()
  var now = sec()
  var tid = ids[0]
  try {
    session.running = true; session.startedAtSec = now; session.tag = g.tag; session.taskName = name; session.blockId = tid; session.blockIds = ids; session.fromDrop = true
    renderAll()
    for (var i = 0; i < ids.length; i++) { await patchBlockStart(ids[i], g, now) }
    for (var i = 0; i < ids.length; i++) { await refreshTree(ids[i]) }
    pushHistory(name); draftName = ""; saveDraft("")
    saveSession()
    renderAll()
    for (var i = 0; i < ids.length; i++) { refreshTimeLogNow({ id: ids[i], tag: g.tag, start: now, text: name }) }
    orca.notify("success", "开始:" + name + " · " + g.label, { title: "点此撤销", action: function () { resetRunning(); undoDropTags(ids, g.tag) } })
  } catch (err) {
    resetRunning()
    orca.notify("error", "开始失败: " + (err && err.message ? err.message : err))
  }
}
async function stopTimer() {
  if (!session.running) return
  var g = findGroup(session.tag) || GROUPS[0]
  var end = sec()
  var startAt = session.startedAtSec
  var dur = end - startAt
  var name = session.taskName
  var fromDrop = session.fromDrop
  var tids = (session.blockIds || []).slice()
  session.running = false
  renderAll()
  try {
    for (var i = 0; i < tids.length; i++) { await patchBlockTimes(tids[i], g, startAt, end) }
    for (var i = 0; i < tids.length; i++) { await refreshTree(tids[i]) }
    if (!fromDrop && lastJournalId) await refreshTree(lastJournalId)
    clearSession()
    lastDone = { name: name, tag: g.tag, dur: dur, end: end }
    session = { running: false, blockId: null, blockIds: [], fromDrop: false, startedAtSec: 0, tag: "", taskName: "" }
    renderAll()
    for (var i = 0; i < tids.length; i++) { refreshTimeLogNow({ id: tids[i], tag: g.tag, start: startAt, end: end, text: name }) }
    orca.notify("success", (name ? name + " · " : "") + fmtHMS(dur) + " · " + g.label, {
      title: "点此撤销",
      action: function () { if (fromDrop) { undoDropTags(tids, g.tag) } else { deleteBlock(tids[0]); dropState(tids[0]); refreshTree(lastJournalId); refreshTimeLogNow() } },
    })
  } catch (err) {
    session.running = true
    renderAll()
    orca.notify("error", "结束失败: " + (err && err.message ? err.message : err))
  }
}
function onDiscard() {
  if (!ui) return
  var confirmText = session.fromDrop ? "再次点击确认移除标签" : "再次点击确认删除"
  var restoreText = session.fromDrop ? "撤销计时标记(移除标签)" : "删除这条记录"
  var nowMs = Date.now()
  if (discardArmedAt && discardArmedAt > nowMs) { discardArmedAt = 0; discardTimer() }
  else {
    discardArmedAt = nowMs + 3000
    ui.discard.textContent = confirmText
    ui.discard.classList.add("ec-armed")
    setTimeout(function () { if (ui && ui.discard) { ui.discard.textContent = restoreText; ui.discard.classList.remove("ec-armed") } }, 3000)
  }
}
async function discardTimer() {
  if (!session.running) return
  var fromDrop = session.fromDrop
  var tids = (session.blockIds || []).slice()
  var tag = session.tag
  resetRunning()
  if (!tids.length) { orca.notify("info", "已删除这条记录"); return }
  if (fromDrop) {
    await undoDropTags(tids, tag)
    orca.notify("info", "已移除这块上的计时标记")
  } else {
    try { await deleteBlock(tids[0]) } catch (e) {}
    dropState(tids[0]); refreshTree(lastJournalId); refreshTimeLogNow()
    orca.notify("info", "已删除这条记录")
  }
}

// ---- UI 渲染 ----
function setArc(arc, dot, frac) {
  arc.style.strokeDashoffset = String(100 - frac * 100)
  dot.style.transform = "rotate(" + (frac * 360).toFixed(2) + "deg)"
}
function setRunningView() {
  var el = Math.max(0, sec() - session.startedAtSec)
  ui.time.textContent = fmtHMS(el)
  ui.task.textContent = session.taskName
  ui.groupLabel.textContent = (findGroup(session.tag) || GROUPS[0]).label
  ui.groupLabel.style.setProperty("--ec-color", (findGroup(session.tag) || GROUPS[0]).color)
  ui.startAt.textContent = "开始于 " + fmtTime(session.startedAtSec)
  if (ui.discard) ui.discard.textContent = session.fromDrop ? "撤销计时标记(移除标签)" : "删除这条记录"
  setArc(ui.runArc, ui.runDot, (el % 60) / 60)
}
function renderAll() {
  if (!ui) return
  ui.idle.style.display = session.running ? "none" : ""
  ui.run.style.display = session.running ? "" : "none"
  ui.root.style.setProperty("--ec-color", currentGroup().color)
  ui.root.style.setProperty("--ec-from", THEME.from)
  ui.root.style.setProperty("--ec-to", THEME.to)
  ui.input.value = draftName
  if (session.running) { setRunningView() }
  else {
    var d = new Date()
    ui.clock.textContent = two(d.getHours()) + ":" + two(d.getMinutes())
    ui.clockSec.textContent = ":" + two(d.getSeconds())
    setArc(ui.arc, ui.dot, d.getSeconds() / 60)
    renderPills()
    renderChips()
    ui.lastDone.textContent = lastDone ? "上次:" + (lastDone.name || "") + " · " + fmtHMS(lastDone.dur) : ""
  }
}
function renderPills() {
  ui.pills.innerHTML = ""
  var sel = currentGroup()
  for (var i = 0; i < GROUPS.length; i++) {
    var pill = document.createElement("button")
    pill.type = "button"
    pill.className = "ec-pill" + (GROUPS[i] === sel ? " ec-pill-on" : "")
    pill.style.setProperty("--ec-color", GROUPS[i].color)
    var dot = document.createElement("i")
    dot.className = "ec-pill-dot"
    pill.appendChild(dot)
    pill.appendChild(document.createTextNode(GROUPS[i].label))
    ;(function (idx) {
      pill.addEventListener("click", function () {
        selectedGroup = GROUPS[idx]
        saveGroup(idx)
        renderPills()
      })
    })(i)
    ui.pills.appendChild(pill)
  }
}
function saveGroup(idx) { try { localStorage.setItem(lsKeys().group, String(idx)) } catch (e) {} }
function renderChips() {
  ui.chips.innerHTML = ""
  var a = loadHistory()
  for (var i = 0; i < a.length; i++) {
    ;(function (name) {
      var chip = document.createElement("span")
      chip.className = "ec-chip"
      var label = document.createElement("span")
      label.className = "ec-chip-label"
      label.textContent = name
      label.addEventListener("click", function () { draftName = name; saveDraft(name); ui.input.value = name; ui.input.focus() })
      var del = document.createElement("button")
      del.type = "button"
      del.className = "ec-chip-del"
      del.title = "从历史中删除"
      del.textContent = "×"
      del.addEventListener("click", function (e) { e.stopPropagation(); removeHistory(name); renderChips() })
      chip.appendChild(label)
      chip.appendChild(del)
      ui.chips.appendChild(chip)
    })(a[i])
  }
}

function tick() {
  if (session.running) {
    var el = Math.max(0, sec() - session.startedAtSec)
    handle.setStatus(fmtHMS(el) + " · 进行中")
    if (ui) {
      ui.time.textContent = fmtHMS(el)
      setArc(ui.runArc, ui.runDot, (el % 60) / 60)
      // 秒跳一下：给数字一个轻微的弹动
      ui.time.classList.remove("ec-pop")
      void ui.time.offsetWidth
      ui.time.classList.add("ec-pop")
    }
  } else {
    var d = new Date()
    handle.setStatus("当前 " + two(d.getHours()) + ":" + two(d.getMinutes()))
    if (ui) {
      ui.clock.textContent = two(d.getHours()) + ":" + two(d.getMinutes())
      ui.clockSec.textContent = ":" + two(d.getSeconds())
      setArc(ui.arc, ui.dot, d.getSeconds() / 60)
    }
  }
}

function buildHtml() {
  return [
    '<div class="ec">',
    '<div class="ec-idle ec-view">',
    '<div class="ec-clockface">',
    '<svg viewBox="0 0 120 120">',
    '<path class="ec-track" d="M 60 6 A 54 54 0 1 1 59.999 6" pathLength="100"/>',
    '<path class="ec-arc" d="M 60 6 A 54 54 0 1 1 59.999 6" pathLength="100"/>',
    '<g class="ec-dotg"><circle class="ec-dot" cx="60" cy="6" r="4.5"/></g>',
    '</svg>',
    '<div class="ec-face">',
    '<div class="ec-clockrow">',
    '<div class="ec-clock"></div><div class="ec-clock-sec"></div>',
    '</div>',
    '</div>',
    '</div>',
    '<div class="ec-field">',
    '<input class="ec-input" maxlength="40" placeholder="要做什么?录入任务名作为块文本"/>',
    '<div class="ec-chips"></div>',
    '<div class="ec-pills-cap">记录到组</div>',
    '<div class="ec-pills"></div>',
    '<button type="button" class="ec-start">开始计时</button>',
    '<div class="ec-drop-hint"><span class="ec-drop-hint-icon">⤓</span>或把笔记块拖进本卡片，直接在该块上打标签开始计时</div>',
    '</div>',
    '<div class="ec-last"></div>',
    '</div>',
    '<div class="ec-run ec-view" style="display:none">',
    '<div class="ec-clockface">',
    '<svg viewBox="0 0 120 120">',
    '<path class="ec-track" d="M 60 6 A 54 54 0 1 1 59.999 6" pathLength="100"/>',
    '<path class="ec-arc" d="M 60 6 A 54 54 0 1 1 59.999 6" pathLength="100"/>',
    '<g class="ec-dotg"><circle class="ec-dot" cx="60" cy="6" r="4.5"/></g>',
    '</svg>',
    '<div class="ec-face">',
    '<div class="ec-time"></div><div class="ec-sub ec-start-at"></div>',
    '</div>',
    '</div>',
    '<div class="ec-task"></div>',
    '<div class="ec-group-label"></div>',
    '<button type="button" class="ec-jump">跳转到记录</button>',
    '<button type="button" class="ec-stop">结束</button>',
    '<button type="button" class="ec-discard">删除这条记录</button>',
    '</div>',
    '</div>',
  ].join("")
}

// ---- 样式（作用域到 .ec，避免污染） ----
var styleEl = document.createElement("style")
styleEl.dataset.role = "elegant-timer"
styleEl.textContent = `
.ec{--ec-color:#7c5cff;--ec-from:#7c5cff;--ec-to:#38bdf8;display:flex;height:100%;box-sizing:border-box;flex-direction:column;align-items:center;gap:14px;padding:16px 18px 22px;user-select:none;overflow-x:hidden;overflow-y:auto;scrollbar-width:none;animation:ec-in .32s ease}
.ec::-webkit-scrollbar{width:0;height:0}
@keyframes ec-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.ec-view{display:flex;flex-direction:column;align-items:center;width:100%;margin:auto 0;flex-shrink:0}
.ec-clockface{position:relative;--ec-d:min(56vw,176px);width:var(--ec-d);aspect-ratio:1;flex:none;border-radius:50%;overflow:hidden;filter:drop-shadow(0 18px 40px -22px var(--ec-color))}
.ec-clockface::before{content:"";position:absolute;inset:5%;border-radius:50%;background:radial-gradient(circle,rgba(124,92,255,.18),transparent 70%);filter:blur(12px);animation:ec-halo 5.5s ease-in-out infinite;pointer-events:none}
.ec-run .ec-clockface{--ec-d:min(40vw,132px)}
.ec-run{gap:12px;padding:14px 18px 20px}
.ec-idle{gap:11px}
.ec-clockface svg{position:absolute;inset:0;width:100%;height:100%}
.ec-track{fill:none;stroke:var(--orca-color-border-low);stroke-width:5;stroke-linecap:round}
.ec-arc{fill:none;stroke:var(--ec-color);stroke-width:5;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100;transition:stroke-dashoffset 1s linear}
.ec-dotg{transform-box:view-box;transform-origin:60px 60px;transition:transform 1s linear}
.ec-dotg .ec-dot{fill:var(--ec-color);filter:drop-shadow(0 0 6px var(--ec-color))}
.ec-face{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
.ec-clock,.ec-time{white-space:nowrap;font-variant-numeric:tabular-nums;font-feature-settings:"tnum";font-weight:700;line-height:1;letter-spacing:.5px;background-image:linear-gradient(135deg,var(--ec-from),var(--ec-to));-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;transition:transform .16s cubic-bezier(.2,.9,.3,1.4)}
.ec-clock{font-size:calc(var(--ec-d)*.21)}
.ec-time{font-size:calc(var(--ec-d)*.15)}
.ec-clockrow{display:flex;align-items:baseline;justify-content:center;gap:2px}
.ec-clock-sec{font-size:calc(var(--ec-d)*.07);color:var(--orca-color-text-3);font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:.5px}
.ec-run .ec-task{font-size:13px}
.ec-run .ec-stop{padding:9px 30px}
.ec-jump{position:relative;background:var(--orca-color-bg-1);color:var(--orca-color-text-2);border:1px solid var(--orca-color-border);border-radius:999px;padding:8px 22px;font-size:13px;font-weight:600;cursor:pointer;transition:all .18s}
.ec-jump::before{content:"↗";margin-right:6px;font-size:12px}
.ec-jump:hover{color:var(--ec-color);border-color:var(--ec-color);box-shadow:0 0 0 3px color-mix(in srgb, var(--ec-color) 12%, transparent)}
.ec-sub{font-size:12px;color:var(--orca-color-text-2)}
.ec-field{width:min(100%,252px);display:flex;flex-direction:column;gap:9px;align-items:center}
.ec-input{width:100%;background:var(--orca-color-bg-2);color:var(--orca-color-text-1);border:1px solid var(--orca-color-border);border-radius:12px;padding:9px 14px;font-size:14px;text-align:center;outline:none;box-sizing:border-box;transition:border-color .2s, box-shadow .2s}
.ec-input::placeholder{color:var(--orca-color-text-3);opacity:.5}
.ec-input:focus{border-color:var(--ec-color);box-shadow:0 0 0 3px color-mix(in srgb, var(--ec-color) 22%, transparent)}
.ec-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;width:100%}
.ec-chip{display:inline-flex;align-items:center;gap:3px;background:var(--orca-color-bg-2);color:var(--orca-color-text-2);border:1px solid var(--orca-color-border);border-radius:999px;padding:3px 8px 3px 11px;font-size:12px;cursor:pointer;transition:all .15s}
.ec-chip:hover{color:var(--orca-color-text-1);border-color:var(--ec-color)}
.ec-chip-label{line-height:1.4}
.ec-chip-del{appearance:none;background:none;border:none;padding:0 1px;margin:0;font-size:13px;line-height:1;color:var(--orca-color-text-3);cursor:pointer;opacity:0;transition:opacity .15s,color .15s}
.ec-chip:hover .ec-chip-del{opacity:.6}
.ec-chip-del:hover{color:#ff6b6b;opacity:1}
.ec-pills-cap{font-size:11px;color:var(--orca-color-text-3);letter-spacing:2px;margin-top:2px}
.ec-pills{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.ec-pill{display:inline-flex;align-items:center;gap:6px;background:var(--orca-color-bg-2);color:var(--orca-color-text-2);border:1px solid var(--orca-color-border);border-radius:999px;padding:5px 13px;font-size:13px;cursor:pointer;transition:all .18s}
.ec-pill:hover{color:var(--orca-color-text-1)}
.ec-pill-on{border-color:var(--ec-color);color:var(--orca-color-text-1);box-shadow:0 0 0 3px color-mix(in srgb, var(--ec-color) 14%, transparent)}
.ec-pill-dot{width:8px;height:8px;border-radius:50%;background:var(--ec-color)}
.ec-drop-hint{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--orca-color-text-3);line-height:1.4;text-align:center;opacity:.85}
.ec-drop-hint-icon{font-size:13px;line-height:1}
.ec-start,.ec-stop{position:relative;overflow:hidden;border:none;cursor:pointer;color:#fff;font-size:14px;font-weight:600;padding:11px 36px;border-radius:999px;background:linear-gradient(135deg,var(--ec-from),var(--ec-to));box-shadow:0 6px 20px -6px var(--ec-color);transition:transform .15s, box-shadow .2s;animation:ec-breathe 3.2s ease-in-out infinite;margin-top:6px}
.ec-start::after,.ec-stop::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);animation:ec-shimmer 2.6s linear infinite}
.ec-start:hover,.ec-stop:hover{transform:translateY(-1px);box-shadow:0 10px 26px -6px var(--ec-color)}
.ec-stop{background:linear-gradient(135deg,#ff6b6b,#f87171);animation:none}
.ec-task{font-size:14px;font-weight:600;color:var(--orca-color-text-1);max-width:min(88%,270px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ec-group-label{display:inline-flex;align-items:center;padding:3px 12px;border-radius:999px;font-size:12px;color:#fff;background:var(--ec-color);box-shadow:0 4px 14px -4px var(--ec-color)}
.ec-discard{background:none;border:none;color:var(--orca-color-text-3);font-size:12px;cursor:pointer;padding:5px 10px;border-radius:8px;transition:all .15s}
.ec-discard:hover{color:var(--orca-color-text-2)}
.ec-discard.ec-armed{color:#ff6b6b;font-weight:600}
.ec-last{font-size:12px;color:var(--orca-color-text-2);opacity:.8;min-height:16px;max-width:min(88%,270px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ec-pop{transform:scale(1.06)}
@keyframes ec-breathe{0%,100%{opacity:1}50%{opacity:.86}}
@keyframes ec-shimmer{to{left:120%}}
@keyframes ec-halo{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:.95;transform:scale(1.06)}}
`
document.head.appendChild(styleEl)

// ---- 侧边栏注册 ----
// 标题/文件夹跟随 #脚本 标签属性：displayName 改名、group 归入对应文件夹(不填则顶层)

// ---- 脚本配置（设置页「脚本配置」区表单化，无需改源码） ----
$inject.registerSettings(
  [
    { name: "defaultTask", label: "默认任务名", type: "text", default: DEFAULT_TASK },
    { name: "keepHistory", label: "任务名历史条数", type: "number", default: KEEP_HISTORY },
    { name: "themeFrom", label: "主题渐变起", type: "text", default: THEME.from },
    { name: "themeTo", label: "主题渐变止", type: "text", default: THEME.to },
  ],
  function (v) {
    if (ui && ui.root) {
      ui.root.style.setProperty("--ec-from", v.themeFrom || THEME.from)
      ui.root.style.setProperty("--ec-to", v.themeTo || THEME.to)
    }
  },
)

var handle = $inject.registerSidebarGroup({
  key: "elegant-timer",
  title: $inject.scriptName,
  icon: "ti ti-clock",
  parent: $inject.scriptGroup || undefined,
  status: "当前 00:00",
  render: buildHtml,
  onFocus: function (container) {
    ui = {
      root: container.querySelector(".ec"),
      idle: container.querySelector(".ec-idle"),
      run: container.querySelector(".ec-run"),
      jump: container.querySelector(".ec-jump"),
      clock: container.querySelector(".ec-clock"),
      clockSec: container.querySelector(".ec-clock-sec"),
      time: container.querySelector(".ec-time"),
      task: container.querySelector(".ec-task"),
      groupLabel: container.querySelector(".ec-group-label"),
      startAt: container.querySelector(".ec-start-at"),
      arc: container.querySelector(".ec-idle .ec-arc"),
      dot: container.querySelector(".ec-idle .ec-dotg"),
      runArc: container.querySelector(".ec-run .ec-arc"),
      runDot: container.querySelector(".ec-run .ec-dotg"),
      input: container.querySelector(".ec-input"),
      chips: container.querySelector(".ec-chips"),
      pills: container.querySelector(".ec-pills"),
      start: container.querySelector(".ec-start"),
      stop: container.querySelector(".ec-stop"),
      discard: container.querySelector(".ec-discard"),
      lastDone: container.querySelector(".ec-last"),
    }
    var sel = loadGroupIndex()
    selectedGroup = GROUPS[sel] || GROUPS[DEFAULT_GROUP]
    draftName = loadDraft()
    renderAll()
    ui.input.addEventListener("keydown", function (e) { if (e.key === "Enter") startTimer() })
    ui.input.addEventListener("input", function () { draftName = ui.input.value; saveDraft(draftName) })
    ui.start.addEventListener("click", function () { startTimer() })
    ui.jump.addEventListener("click", function () { if (session.blockId != null) orca.nav.goTo("block", { blockId: session.blockId }) })
    ui.stop.addEventListener("click", function () { stopTimer() })
    ui.discard.addEventListener("click", onDiscard)
    // 整挂件接收块拖拽：把笔记块拖进来 = 直接在拖入的块（可多块）上打所选标签计时，块本体即记录。
    var detachDrop = $inject.attachBlockDrop(container, function (blockIds) {
      var ids = (blockIds || []).filter(function (id) { return Number.isInteger(id) && id > 0 })
      if (!ids.length) return
      if (session.running) { orca.notify("info", "已有进行中的计时，请先结束"); return }
      orca.invokeBackend("get-blocks", ids).then(function (blocks) {
        var name = cleanBlockText(Array.isArray(blocks) && blocks.length ? blocks[0] : null)
        if (!name) { orca.notify("warn", "该块没有可用的文本"); return }
        startTimerOnBlock(ids, name)
      }).catch(function () { orca.notify("error", "读取块失败") })
    })
    tick()
    return function () { ui = null; try { detachDrop() } catch (e) {} }
  },
})
handle.setStatus("当前 " + fmtTime(sec()))

// ---- 引擎：常驻 1s（持续展示/计秒）；失焦也计时 ----
tickId = setInterval(tick, 1000)

// ---- 恢复会话：重开软件后继续展示进行中的计时 ----
;(async function () {
  try {
    var s = loadSession()
    if (s && s.running) {
      var ok = false
      try { var b = await orca.invokeBackend("get-block", s.blockId); ok = !!(b && !b.error) } catch (e) {}
      if (ok) {
        session.running = true; session.blockId = s.blockId; session.blockIds = Array.isArray(s.blockIds) && s.blockIds.length ? s.blockIds : [s.blockId]; session.fromDrop = !!s.fromDrop; session.startedAtSec = s.startedAtSec; session.tag = s.tag || ""; session.taskName = s.taskName || ""
        if (session.tag === "") session.tag = currentGroup().tag
        renderAll()
      } else { clearSession() }
    }
  } catch (e) {}
})()

// ---- 卸载清理 ----
$inject.onUnload(function () {
  clearInterval(tickId)
  handle.unregister()
  styleEl.remove()
})
