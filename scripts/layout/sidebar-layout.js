// @inject-template-id: sidebar-layout
/* 侧边栏切换布局 + 定时自动切换
 * 在侧边栏「更多」tab 里注册「布局」组,列出已保存的布局,点击名称即可切换。
 *
 * v2 新增:布局切换计划表——在设置页「脚本配置」里按「HH:MM=布局名」每行一条
 * 配置(如 09:00=工作),到点自动切换;修改配置即时生效,无需重注入。
 *
 * 布局数据即 Orca 顶部栏「布局」菜单所用的同一份数据(orca.state.settings[1002]);
 * 本脚本只负责展示与切换,保存/删除请到顶部栏菜单里操作。
 * 生效:插入后默认不启用,在 #脚本 标签属性勾选 autoRun 后点击 headbar「重新注入」。
 * 若同时安装了 Orca Layout Manager 插件,请勿再启用本脚本。
 */
const JOURNAL_TO_TODAY_DEFAULT = true // 切换过去后日期一律换为今天(可在设置页改)

// ---- 布局数据 ----
function getLayouts() {
  const raw = orca.state.settings[1002]
  return raw && typeof raw === "object" && raw.layouts ? raw.layouts : {}
}

// ---- 把一份布局快照变成一棵全新的面板树 ----
function freshId() { return Math.random().toString(36).slice(2, 12) }
function cloneValue(v) {
  if (v == null) return v
  if (v instanceof Date) return new Date(v.getTime())
  if (Array.isArray(v)) return v.map(cloneValue)
  if (typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = cloneValue(v[k]); return o }
  return v
}
function isView(panel) { return panel.children == null }
function startOfToday() {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}
function remapView(panel) {
  const viewArgs = cloneValue(panel.viewArgs)
  const toToday = $inject.config().journalToToday !== false
  if ((toToday || JOURNAL_TO_TODAY_DEFAULT) && panel.view === "journal") {
    return { ...panel, viewArgs: { ...viewArgs, date: startOfToday() } }
  }
  return { ...panel, viewArgs }
}
function rebuildTree(panel, idMap) {
  const id = freshId()
  idMap.set(panel.id, id)
  if (isView(panel)) return { ...remapView(panel), id }
  return { ...panel, id, children: panel.children.map((c) => rebuildTree(c, idMap)) }
}
function firstViewId(panel) {
  if (isView(panel)) return panel.id
  for (const child of panel.children) {
    const id = firstViewId(child)
    if (id != null) return id
  }
  return null
}
function swapLayout(saved) {
  if (!saved || !saved.panels) return false
  const idMap = new Map()
  const tree = rebuildTree(saved.panels, idMap)
  const focus = idMap.get(saved.activePanel) ?? firstViewId(tree)
  if (focus == null) return false
  orca.state.panelBackHistory.length = 0
  orca.state.panelForwardHistory.length = 0
  Object.assign(orca.state.panels, {
    id: tree.id, direction: tree.direction, children: tree.children, height: tree.height,
  })
  orca.state.activePanel = focus
  return true
}
function applyLayoutByName(name) {
  const saved = getLayouts()[name]
  if (!saved) { orca.notify("warn", "布局不存在: " + name); return false }
  const ok = swapLayout(saved)
  orca.notify(ok ? "success" : "error", "已切换到布局 " + name)
  return ok
}

// ---- 条目构建 ----
function buildEntries() {
  const layouts = getLayouts()
  return Object.keys(layouts)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      key: name,
      title: name,
      onClick: () => applyLayoutByName(name),
    }))
}

// ---- 定时切换计划表(设置页可配) ----
function parseSchedule(text) {
  return String(text || "")
    .split(/[;\n]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\d{1,2}:\d{2})\s*=\s*(.+)$/)
      return m ? { time: m[1].padStart(5, "0"), layout: m[2].trim() } : null
    })
    .filter(Boolean)
}

let armedKeys = []
function rearmSchedules(values) {
  for (const k of armedKeys) $inject.schedule.cancel(k)
  armedKeys = []
  for (const rule of parseSchedule(values.schedule)) {
    const key = "sl:" + rule.time + ":" + rule.layout
    $inject.schedule.daily(rule.time, () => applyLayoutByName(rule.layout), key)
    armedKeys.push(key)
  }
}

// ---- 注册「布局」组 ----
const handle = $inject.registerSidebarGroup({
  key: "layouts",
  title: "布局",
  icon: "ti ti-layout-filled",
  entries: buildEntries(),
  emptyHint: "还没有保存过布局,去顶部栏「… → 布局」保存一个吧。",
})

// 布局数据变化时刷新条目列表
let listSig = Object.keys(getLayouts()).sort().join(",")
const unsubData = window.Valtio.subscribe(orca.state.settings, () => {
  const sig = Object.keys(getLayouts()).sort().join(",")
  if (sig === listSig) return
  listSig = sig
  handle.setEntries(buildEntries())
})

// ---- 脚本配置:定时切换计划表 ----
$inject.registerSettings(
  [
    {
      name: "schedule",
      label: "切换计划(每行一条: HH:MM=布局名)",
      type: "text",
      default: "",
    },
    {
      name: "journalToToday",
      label: "切布局后日记日期换为今天",
      type: "boolean",
      default: true,
    },
  ],
  (values) => rearmSchedules(values),
)

// 启动时按已保存配置布防
rearmSchedules($inject.config())

// ---- 卸载清理 ----
$inject.onUnload(() => {
  handle.unregister()
  unsubData()
  for (const k of armedKeys) $inject.schedule.cancel(k)
})
