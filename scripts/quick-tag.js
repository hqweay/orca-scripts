// @inject-template-id: quick-tag
/* 快捷打标签
 * 给当前光标所在块(或右键选中的块)打上标签。
 *
 * 默认属性值在本体标签属性面板中配置,打标签时自动带上。
 * 如需在打标签时附带「运行时计算 / AI 获取」的属性值,用 { name, props } 形式:
 *   props 可以是属性数组,也可以是 async (blockId) => 属性数组(可按块动态计算);
 *   value 可以是任意 JS 表达式,类型自动推断
 *   (文本/数字/布尔/Date=日期时间/数组=多选);AI 用 $inject.aiChat。
 * 触发方式:标签属性 shortcut(如 meta+l)/ contextMenu / headbar。
 * 注意:修改代码后需点击 headbar「重新注入」使快捷键生效。
 */
const TAGS = [
  "碎碎念",
  // 带属性:
  // {
  //   name: "项目",
  //   props: [
  //     { name: "完成于", value: new Date() },
  //     { name: "状态", value: "进行中" },
  //   ],
  // },
  // AI 获取属性值(需在 Orca 设置「AI 对话设置」中配置 AI):
  // {
  //   name: "读书",
  //   props: (() => {
  //     const book = "活着"   // 要插入的属性值,AI 提示词可动态引用它
  //     return [
  //       { name: "书名", value: book },
  //       {
  //         name: "摘要",
  //         value: (await $inject.aiChat([
  //           { role: "user", content: "给《" + book + "》写一句摘要" },
  //         ])).trim(),
  //       },
  //     ]
  //   })(),
  // },
  // 按块动态生成 props(比如根据块内容生成摘要):
  // {
  //   name: "笔记",
  //   props: async (blockId) => {
  //     const block = orca.state.blocks[blockId]
  //     const text = (block && block.content || []).map(f => f.v).join("")
  //     return [{
  //       name: "摘要",
  //       value: (await $inject.aiChat([
  //         { role: "user", content: "给这段内容写一句摘要: " + text.slice(0, 200) },
  //       ])).trim(),
  //     }]
  //   },
  // },
]

const targetIds = $inject.targetBlockIds.length > 0
  ? $inject.targetBlockIds
  : (() => {
      const cursor = orca.utils.getCursorDataFromSelection(window.getSelection())
      return cursor && cursor.anchor && cursor.anchor.blockId
        ? [cursor.anchor.blockId]
        : []
    })()

if (targetIds.length === 0) {
  orca.notify("warn", "请先聚焦编辑器或选中块")
  return
}

let count = 0
for (const blockId of targetIds) {
  for (const item of TAGS) {
    const name = typeof item === "string" ? item : item.name
    const props = typeof item === "string"
      ? []
      : typeof item.props === "function"
        ? await item.props(blockId)
        : (item.props || [])
    await $inject.applyTag(blockId, name, props)
    count++
  }
}
orca.notify("success", "已打上 " + count + " 个标签")
