// @inject-template-id: workbench-layout-sidetool
/* 工作台布局：侧边栏一键打开
 * 在编辑器侧边栏加一个按钮,点击直接打开工作台并切换到指定布局。
 *
 * 示例:
 *   1. 先在工作台顶部「布局」菜单保存一个布局(如「工作」);
 *   2. 把下面 LAYOUT_NAME 改成那个布局的名字;
 *   3. 勾选 #脚本 标签属性的 sidetool(模板已默认勾选),点 headbar「重新注入」;
 *   4. 编辑器侧边栏出现按钮,点击即打开工作台并切到该布局。
 *
 * 想在其它入口复用这段逻辑(快捷键 / 右键菜单 / 顶部栏 / 侧边栏 / AI 脚本),
 * 把「if (typeof window.workbench...) {...}」这一段复制过去,改 LAYOUT_NAME 即可。
 * 想一键打开「当前布局」而不是切布局,可改调用 orca.commands.invokeEditorCommand
 * 打开工作台命令(见工作台插件注册的「打开工作台」),这里默认演示切指定布局。
 */
const LAYOUT_NAME = "工作" // ← 改成你要打开的布局名(工作台「布局」菜单里保存的名字)

if (typeof window.workbench === "undefined" || typeof window.workbench.applyLayout !== "function") {
  orca.notify("warn", "未检测到工作台插件,请先启用「工作台」再使用本脚本")
} else {
  var r = window.workbench.applyLayout(LAYOUT_NAME)
  orca.notify(
    r.ok ? "success" : "error",
    r.ok ? "已打开工作台布局「" + r.name + "」" : "切换失败:" + (r.reason || "")
  )
}
