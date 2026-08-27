// @inject-template-id: font-color
/* 全局字体颜色
 * 在侧边栏「更多」tab 注册「全局字体颜色」挂件：从色盘/自定义颜色选色，
 * 实时改变整个应用的文字颜色，选择保存在 localStorage，卸载后自动还原。
 *
 * 范式：静态 HTML + 全局动作 → document 事件委托 + localStorage 持久化，
 * 不依赖 onFocus 容器引用，切 tab 重渲染后依然生效（与番茄钟的 onFocus 范式对照）。
 *
 * 生效:插入后默认不启用,在 #脚本 标签属性勾选 autoRun 后点击 headbar「重新注入」。
 * 在 #脚本 标签属性填 group(如「外观」)可把挂件归入对应文件夹,不填则顶层。
 * 默认已勾选 sidebar,重新注入后「更多」tab 同时有加载/卸载开关条目(无需可取消勾选)。
 */
const KEY = "orca.global-font-color"
const STYLE_ID = "orca-global-font-color-style"
let current = localStorage.getItem(KEY) || null

const PALETTE = [
  "#111111", "#3b3b3b", "#6b7280", "#9ca3af",
  "#e5484d", "#f76b15", "#f5a524", "#f7d154",
  "#86efac", "#30a46c", "#12a594", "#0091ff",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#d946ef", "#ec4899", "#f43f5e", "#7c3aed",
]

// 识别「文字类」CSS 变量(--orca-text / foreground / font / fg / ink)，避开背景/边框/强调色
const INCLUDE_TEXT = /(text|foreground|font|fg|ink)/i
const EXCLUDE_TEXT = /(background|bg|border|shadow|outline|accent|brand|hover|active|disabled|selection|placeholder|focus|surface|panel|card|menu|input|button|icon|tooltip)/i
const IS_COLOR = /^(#(?:[\da-f]{3,8})|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(|transparent|currentcolor|[a-z]+)$/i

function collectTextVars() {
  const found = new Set()
  const roots = [document.documentElement, document.body]
  roots.forEach((el) => {
    const cs = getComputedStyle(el)
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i]
      if (!name.startsWith("--") || !INCLUDE_TEXT.test(name) || EXCLUDE_TEXT.test(name)) continue
      const val = cs.getPropertyValue(name).trim().toLowerCase()
      if (val && IS_COLOR.test(val)) found.add(name)
    }
  })
  return [...found]
}

function getStyleEl() {
  let el = document.getElementById(STYLE_ID)
  if (!el) {
    el = document.createElement("style")
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  return el
}

function applyColor(hex) {
  const vars = collectTextVars()
  let css = ":root{\n"
  vars.forEach((v) => { css += v + ":" + hex + " !important;\n" })
  css += "}\nhtml,body{color:" + hex + " !important}\n"
  getStyleEl().textContent = css
  current = hex
  localStorage.setItem(KEY, hex)
  handle.setStatus("字体色: " + hex.toUpperCase())
  syncUI()
}

function resetColor() {
  const el = document.getElementById(STYLE_ID)
  if (el) el.remove()
  current = null
  localStorage.removeItem(KEY)
  handle.setStatus("跟随主题")
  syncUI()
}

function syncUI() {
  const label = document.querySelector("[data-fg-hex]")
  if (label) label.textContent = current ? current.toUpperCase() : "跟随主题"
  const input = document.getElementById("orca-fg-input")
  if (input) input.value = current || "#111111"
  document.querySelectorAll("[data-fg-pick]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-fg-pick") === current)
  })
}

// 事件委托:绑在 document 上，切 tab 重渲染后依然生效
function onDocClick(e) {
  const t = e.target
  if (!t || !t.closest) return
  const pick = t.closest("[data-fg-pick]")
  if (pick) { applyColor(pick.getAttribute("data-fg-pick")); return }
  if (t.closest("[data-fg-reset]")) resetColor()
}
function onDocInput(e) {
  if (e.target && e.target.id === "orca-fg-input") applyColor(e.target.value)
}
document.addEventListener("click", onDocClick)
document.addEventListener("input", onDocInput)

// 挂件 UI 样式（用主题变量，不硬编码色值）
const uiStyle = document.createElement("style")
uiStyle.id = "orca-global-font-color-ui"
uiStyle.textContent = [
  ".orca-fg{display:flex;flex-direction:column;gap:10px;padding:12px 14px}",
  ".orca-fg-title{font-size:13px;font-weight:600;color:var(--orca-text-color,inherit)}",
  ".orca-fg-grid{display:flex;flex-wrap:wrap;gap:8px}",
  ".orca-fg-swatch{width:26px;height:26px;border-radius:50%;border:1px solid var(--orca-border-color,rgba(128,128,128,.35));padding:0;cursor:pointer}",
  ".orca-fg-swatch:hover{transform:scale(1.15)}",
  ".orca-fg-swatch.active{outline:2px solid var(--orca-accent-color,#3b82f6);outline-offset:2px}",
  ".orca-fg-custom{display:flex;align-items:center;gap:8px}",
  ".orca-fg-custom input[type=color]{width:34px;height:26px;padding:0;border:1px solid var(--orca-border-color,rgba(128,128,128,.35));border-radius:6px;background:transparent;cursor:pointer}",
  ".orca-fg-hex{font-size:12px;opacity:.75}",
  ".orca-fg-reset{align-self:flex-start;font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid var(--orca-border-color,rgba(128,128,128,.35));background:transparent;color:var(--orca-text-color,inherit);cursor:pointer}",
  ".orca-fg-hint{font-size:11px;opacity:.55}",
].join("\n")
document.head.appendChild(uiStyle)

function render() {
  return [
    '<div class="orca-fg">',
    '<div class="orca-fg-title">全局字体颜色</div>',
    '<div class="orca-fg-grid">',
    PALETTE.map((c) => '<button type="button" class="orca-fg-swatch' + (current === c ? " active" : "") + '" data-fg-pick="' + c + '" style="background:' + c + '" title="' + c + '"></button>').join(""),
    '</div>',
    '<div class="orca-fg-custom">',
    '<input type="color" id="orca-fg-input" value="' + (current || "#111111") + '" title="自定义颜色">',
    '<span class="orca-fg-hex" data-fg-hex>' + (current ? current.toUpperCase() : "跟随主题") + '</span>',
    '</div>',
    '<button type="button" class="orca-fg-reset" data-fg-reset>恢复默认(跟随主题)</button>',
    '<div class="orca-fg-hint">点击色块实时改变应用文字颜色,选择保存在本地,卸载后自动还原</div>',
    '</div>',
  ].join("")
}

// ---- 注册挂件(render 模式:聚焦时整栏渲染) ----
const handle = $inject.registerSidebarGroup({
  key: "global-font-color",
  title: $inject.scriptName,
  icon: "ti ti-palette",
  parent: $inject.scriptGroup || undefined,
  status: current ? "字体色: " + current.toUpperCase() : "跟随主题",
  render,
})

if (current) applyColor(current)

// ---- 卸载清理 ----
$inject.onUnload(() => {
  document.removeEventListener("click", onDocClick)
  document.removeEventListener("input", onDocInput)
  handle.unregister()
  const s = document.getElementById(STYLE_ID); if (s) s.remove()
  const u = document.getElementById("orca-global-font-color-ui"); if (u) u.remove()
})
