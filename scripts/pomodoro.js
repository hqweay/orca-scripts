// @inject-template-id: pomodoro
/* 小番茄钟
 * 在侧边栏「更多」tab 注册「小番茄钟」组，聚焦后整栏渲染一个番茄钟：
 * 25 分钟专注 / 5 分钟休息，可开始/暂停/重置，记录完成的番茄数。
 *
 * 计时状态放在脚本作用域（聚焦/失焦时都保留），渲染回调只负责展示：
 * 失焦后计时继续，回到聚焦视图自动恢复显示。
 * 引擎（setInterval）在脚本存活期间常驻，脚本卸载时清理。
 *
 * 生效:插入后默认不启用,在 #脚本 标签属性勾选 autoRun 后点击 headbar「重新注入」。
 * 在 #脚本 标签属性填 group(如「效率工具」)可把挂件归入对应文件夹,不填则顶层。
 * 提示:本脚本用 $inject.registerSidebarGroup 的 render 模式展示挂件内容;
 * 默认已勾选 sidebar,重新注入后「更多」tab 同时有加载/卸载开关条目(无需可取消勾选),两者可共存。
 * 每完成一个专注周期,写一条记录到今日日志末尾(或下方 RECORD_TARGET 配置的块)。
 */
const WORK_SEC = 25 * 60
const BREAK_SEC = 5 * 60
const PHASE_LABEL = { work: "专注中", break: "休息中" }

// 记录位置:留空 = 写入今日日志;填块 ID(如 "123")或块别名(如 "番茄记录")= 写入该块末尾
const RECORD_TARGET = ""

let phase = "work"        // work | break
let remaining = WORK_SEC
let running = false
let doneCount = 0
let ui = null             // 当前聚焦视图的 UI 引用（未聚焦时为 null）
let timerId = null

// ---- 样式(作用域到 .pomo,避免污染侧边栏) ----
const styleEl = document.createElement("style")
styleEl.dataset.role = "pomo"
styleEl.textContent = `
  .pomo { display:flex; flex-direction:column; align-items:center; gap:var(--orca-spacing-md); padding:var(--orca-spacing-xl) 0; user-select:none }
  .pomo-time { font-size:44px; font-weight:700; font-variant-numeric:tabular-nums; line-height:1 }
  .pomo-phase { font-size:var(--orca-fontsize-sm); padding:2px 10px; border-radius:999px }
  .pomo-phase.work { background:rgba(255,107,107,.15); color:#ff6b6b }
  .pomo-phase.break { background:rgba(87,199,138,.15); color:#57c78a }
  .pomo-btns { display:flex; gap:var(--orca-spacing-sm) }
  .pomo-btn { padding:var(--orca-spacing-xs) var(--orca-spacing-md); border:1px solid var(--orca-color-border); border-radius:var(--orca-radius-sm); background:var(--orca-color-bg-2); color:var(--orca-color-text-1); cursor:pointer; font-size:var(--orca-fontsize-sm) }
  .pomo-btn:hover { background:var(--orca-color-selection) }
  .pomo-count { font-size:var(--orca-fontsize-sm); color:var(--orca-color-text-2) }
`
document.head.appendChild(styleEl)

function fmt(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0")
}

function switchPhase(next) {
  phase = next
  remaining = phase === "work" ? WORK_SEC : BREAK_SEC
  if (phase === "work") orca.notify("info", "休息结束,开始专注吧")
  else orca.notify("success", "专注完成,休息一下吧")
  renderAll()
}

// 专注完成 → 写一条记录（今日日志末尾 / RECORD_TARGET 块末尾）
async function recordPomodoro() {
  try {
    let target = null
    if (RECORD_TARGET) {
      target = /^\d+$/.test(RECORD_TARGET)
        ? await orca.invokeBackend("get-block", Number(RECORD_TARGET))
        : await orca.invokeBackend("get-block-by-alias", RECORD_TARGET)
      if (!target) {
        orca.notify("warn", "记录块未找到: " + RECORD_TARGET)
        return
      }
    } else {
      target = await orca.invokeBackend("get-journal-block", new Date())
      if (!target) return
    }
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, "0")
    const mm = String(now.getMinutes()).padStart(2, "0")
    await orca.commands.invokeEditorCommand(
      "core.editor.batchInsertText",
      null, target, "lastChild",
      "🍅 完成一个番茄钟 " + hh + ":" + mm,
    )
  } catch (e) {
    console.error("[pomodoro] 记录失败", e)
  }
}

function tick() {
  if (!running) return
  remaining -= 1
  if (remaining <= 0) {
    if (phase === "work") {
      doneCount += 1
      recordPomodoro() // fire-and-forget，不阻塞计时
    }
    switchPhase(phase === "work" ? "break" : "work")
    return
  }
  renderAll()
}

function renderAll() {
  // 挂件快照：行内状态小字（失焦时也更新，瞄一眼架子就知道状态）
  const status = running
    ? PHASE_LABEL[phase]
    : (remaining >= (phase === "work" ? WORK_SEC : BREAK_SEC) ? "未开始" : "已暂停")
  handle.setStatus(fmt(remaining) + " · " + status)
  if (!ui) return
  ui.time.textContent = fmt(remaining)
  ui.phase.textContent = PHASE_LABEL[phase]
  ui.phase.className = "pomo-phase " + phase
  ui.toggle.textContent = running ? "暂停" : "开始"
  ui.count.textContent = "已完成 " + doneCount + " 个番茄"
}

// ---- 引擎:脚本存活期间常驻,失焦也计时;卸载时清理 ----
timerId = setInterval(tick, 1000)

// ---- 注册「小番茄钟」组(render 模式:聚焦时整栏渲染) ----
// 标题/文件夹跟随 #脚本 标签属性:displayName 改名、group 归入对应文件夹(不填则顶层)
const handle = $inject.registerSidebarGroup({
  key: "pomodoro",
  title: $inject.scriptName,
  icon: "ti ti-clock",
  parent: $inject.scriptGroup || undefined,
  status: "25:00 · 未开始",
  render: () => [
    '<div class="pomo">',
    '<div class="pomo-time">' + fmt(remaining) + '</div>',
    '<div class="pomo-phase ' + phase + '">' + PHASE_LABEL[phase] + '</div>',
    '<div class="pomo-btns">',
    '<button type="button" class="pomo-btn pomo-toggle">' + (running ? "暂停" : "开始") + '</button>',
    '<button type="button" class="pomo-btn pomo-reset">重置</button>',
    '</div>',
    '<div class="pomo-count">已完成 ' + doneCount + ' 个番茄</div>',
    '</div>'
  ].join(""),
  // 聚焦注入后运行：取元素引用（实时刷新）并绑监听
  onFocus: (container) => {
    ui = {
      time: container.querySelector(".pomo-time"),
      phase: container.querySelector(".pomo-phase"),
      toggle: container.querySelector(".pomo-toggle"),
      reset: container.querySelector(".pomo-reset"),
      count: container.querySelector(".pomo-count"),
    }
    ui.toggle.addEventListener("click", () => {
      running = !running
      renderAll()
    })
    ui.reset.addEventListener("click", () => {
      running = false
      remaining = phase === "work" ? WORK_SEC : BREAK_SEC
      renderAll()
    })
    return () => { ui = null }
  },
})

// ---- 卸载清理 ----
$inject.onUnload(() => {
  clearInterval(timerId)
  handle.unregister()
  styleEl.remove()
})
