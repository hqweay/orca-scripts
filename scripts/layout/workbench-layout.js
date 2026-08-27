// @inject-template-id: workbench-layout
/* 工作台布局切换
 * 在侧边栏「更多」tab 注册「工作台布局」组,列出工作台里保存的布局,点击名称即可切换。
 *
 * 工作台顶部「布局」菜单负责保存/删除;本脚本只负责展示与切换。
 * 想放到别处(快捷键 / 右键菜单 / 顶部栏 / AI 生成脚本等任意入口),直接用:
 *   window.workbench.applyLayout("布局名")   // 切换
 *   window.workbench.listLayouts()           // 列出 { id, name }
 * 工作台插件未启用时这些接口不存在,脚本开头已做守卫。
 *
 * 生效:插入后默认不启用,在 #脚本 标签属性勾选 autoRun 后点击 headbar「重新注入」。
 */
if (typeof window.workbench === "undefined" || typeof window.workbench.applyLayout !== "function") {
  orca.notify("warn", "未检测到工作台插件,请先启用「工作台」再使用本脚本")
} else {
  function buildEntries() {
    return window.workbench.listLayouts().map(function (l) {
      return {
        key: l.id,
        title: l.name,
        onClick: function () {
          var r = window.workbench.applyLayout(l.name)
          orca.notify(
            r.ok ? "success" : "error",
            r.ok ? "已切换到工作台布局「" + r.name + "」" : "切换失败:" + (r.reason || "")
          )
        },
      }
    })
  }

  var handle = $inject.registerSidebarGroup({
    key: "workbench-layouts",
    title: "工作台布局",
    icon: "ti ti-layout-dashboard",
    entries: buildEntries(),
    emptyHint: "还没有保存过工作台布局,去工作台顶部「布局」菜单保存一个吧。",
  })

  // 布局数据变化时刷新条目列表
  var sig = window.workbench.listLayouts().map(function (l) { return l.id }).join(",")
  var unsub = window.workbench.subscribeLayouts(function () {
    var next = window.workbench.listLayouts().map(function (l) { return l.id }).join(",")
    if (next === sig) return
    sig = next
    handle.setEntries(buildEntries())
  })

  $inject.onUnload(function () { handle.unregister(); unsub() })
}
