// @inject-template-id: paste-block-ref
/* 粘贴选中文本为块引用
 * 把「剪贴板里复制的块」转为块引用,插入到当前光标处,锚文本 = 当前选中的文字。
 *
 * 用法:
 *   1. 先在任意处 ⌘C 复制一个块(宿主写入 web orca/{repoId} 剪贴板载荷);
 *   2. 回到目标位置,选中一段文字(或把光标放到位);
 *   3. 触发脚本:sidetool 编辑器工具栏按钮 / 快捷键 alt+v。
 *
 * 效果:选中的那段文字原地折叠成指向「复制块」的引用,显示文案不变。
 *
 * 注意:
 *   - navigator.clipboard.read() 需要用户激活(transient activation)。
 *     快捷键(宿主 orca.shortcuts)触发时可能抛 NotAllowedError,
 *     这时请改用工具栏按钮触发。
 *   - 跨仓库复制的块会被拒绝(块引用是库内概念)。
 *   - 无选区时锚文本回退为复制块自身的干净文本(取自载荷 fragments)。
 */
let payload = null
try {
  const items = await navigator.clipboard.read()
  for (const it of items) {
    const type = it.types.find((t) => t.startsWith("web orca/"))
    if (type) { payload = JSON.parse(await (await it.getType(type)).text()); break }
  }
} catch (e) {
  orca.notify("warn", "无法读取剪贴板:快捷键触发缺少用户激活,请改用工具栏按钮")
  return
}
if (!payload || !Array.isArray(payload.blocks) || payload.blocks.length === 0) {
  orca.notify("warn", "剪贴板里没有复制的块:先 ⌘C 复制一个块")
  return
}
if (payload.repoId !== orca.state.repo) {
  orca.notify("warn", "复制的块来自其他仓库,无法插入引用")
  return
}
const blockId = payload.blocks[0]

// 锚文本:当前选区文字优先,否则取复制块的干净文本
let anchor = (window.getSelection() || { toString: () => "" }).toString().trim()
if (!anchor) {
  const frags = Array.isArray(payload.fragments) ? payload.fragments : []
  anchor = frags.filter((f) => f.t === "t").map((f) => f.v).join("").trim()
}
if (!anchor) {
  const block = await orca.invokeBackend("get-block", blockId)
  anchor = ((block && block.content) || []).filter((f) => f.t === "t").map((f) => f.v).join("").trim()
}

const cursor = orca.utils.getCursorDataFromSelection(window.getSelection())
if (!cursor || !cursor.anchor || !cursor.anchor.blockId) {
  orca.notify("warn", "请先聚焦编辑器,把光标放到插入位置")
  return
}
await orca.commands.invokeEditorCommand("core.editor.insertFragments", cursor, [{ t: "r", v: blockId, a: anchor }])
orca.notify("success", "已插入块引用")
