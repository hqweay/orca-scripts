/* 互链双端（自愈版）
 * ⌘C 复制块 A → 光标落块 B → 触发脚本 → A/B 互相追加指向对方的块链接。
 *
 * A 的识别：
 * 1. 常驻 copy 捕获（主）：复制那一刻读选区所在块 id，无需剪贴板权限；
 * 2. 剪贴板载荷（兜底）：web orca/{repoId} 载荷解析（快捷键触发可能缺用户激活）。
 *
 * 用法：给本脚本配快捷键（默认 meta+shift+l）或 sidetool 按钮触发。
 * 注意：跨仓库复制的块会拒绝（块链接是库内概念）。
 */
let aId = null
let copyHandler = null

function blockLink(repo, id) {
  return "orca-note://" + repo + "/block?blockId=" + id
}

function readBlock(id) {
  const n = Number(id)
  if (orca.state && orca.state.blocks) {
    const b = orca.state.blocks[n] || orca.state.blocks[String(n)]
    if (b && Array.isArray(b.content)) {
      return Promise.resolve({ id: n, content: b.content.map((f) => ({ ...f })) })
    }
  }
  return orca.invokeBackend("get-block", n)
}

function textOf(content) {
  return (Array.isArray(content) ? content : [])
    .filter((f) => f && f.t === "t")
    .map((f) => String(f.v ?? ""))
    .join("")
    .trim()
}

// 链接锚文本：块文本摘要，超长截断
function labelOf(content, id) {
  const s = textOf(content).replace(/\s+/g, " ").trim()
  return s ? (s.length > 24 ? s.slice(0, 24) + "…" : s) : "#" + id
}

function hasLink(content, repo, id) {
  const url = blockLink(repo, id)
  return (content || []).some((f) => f && f.t === "l" && f.l === url)
}

function appendLink(content, repo, refId, label) {
  if (content.length > 0) content.push({ t: "t", v: " " })
  content.push({ t: "l", v: label, l: blockLink(repo, refId) })
}

// 常驻复制捕获：复制非块内容时清空，防止上一次 A 残留误连
if (!copyHandler) {
  copyHandler = () => {
    const c = orca.utils.getCursorDataFromSelection(window.getSelection())
    aId = c && c.anchor && c.anchor.blockId ? Number(c.anchor.blockId) : null
  }
  document.addEventListener("copy", copyHandler, true)
  $inject.onUnload(() => {
    document.removeEventListener("copy", copyHandler, true)
    copyHandler = null
    aId = null
  })
}

async function resolveA() {
  // 主：复制捕获（零权限、即时）
  if (aId != null) return aId
  // 兜底：剪贴板载荷
  try {
    const items = await navigator.clipboard.read()
    for (const it of items) {
      const type = it.types.find((t) => t.startsWith("web orca/"))
      if (!type) continue
      const d = JSON.parse(await (await it.getType(type)).text())
      if (d.repoId && d.repoId !== orca.state.repo) {
        orca.notify("warn", "复制的块来自其他仓库，无法互链")
        return null
      }
      const ids = (d.blocks || []).map(Number)
      if (ids.length > 0) return ids[0]
    }
  } catch (e) {
    /* 无剪贴板权限（快捷键触发）：静默，靠复制捕获 */
  }
  return null
}

async function main() {
  const repo = orca.state.repo || ""
  const a = await resolveA()
  if (!a) return orca.notify("warn", "未捕获到复制块 A：请先 ⌘C 复制块 A")

  const cursor = orca.utils.getCursorDataFromSelection(window.getSelection())
  const b = cursor && cursor.anchor && cursor.anchor.blockId
  if (!b) return orca.notify("warn", "请先把光标放到块 B 内")
  if (Number(a) === Number(b)) return orca.notify("warn", "A 与 B 是同一个块")

  const [blkA, blkB] = await Promise.all([readBlock(a), readBlock(b)])
  if (!blkA || !blkB) return orca.notify("warn", "读取块失败")

  const aContent = (blkA.content || []).map((f) => ({ ...f }))
  const bContent = (blkB.content || []).map((f) => ({ ...f }))
  let n = 0
  if (!hasLink(aContent, repo, b)) {
    appendLink(aContent, repo, b, "--> " + labelOf(bContent, b))
    n++
  }
  if (!hasLink(bContent, repo, a)) {
    appendLink(bContent, repo, a, "<-- " + labelOf(aContent, a))
    n++
  }
  if (n === 0) return orca.notify("info", "A ↔ B 已互链过，无需重复")

  await orca.commands.invokeGroup(async () => {
    await orca.commands.invokeEditorCommand(
      "core.editor.setBlocksContent",
      null,
      [
        { id: a, content: aContent },
        { id: b, content: bContent },
      ],
    )
  })
  orca.notify("success", "已互链 A ↔ B")
  aId = null // 用完即弃：防止未复制时误连上一次的 A
}

main()
