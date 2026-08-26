// @inject-template-id: ai-fill-prop
/* AI 属性填充
 * 标签面板里，@ 开头的【文本】属性（textarea / 文本型 input）行首图标会被替换为 ✨：
 *   - 提示词写在 @ 属性的输入框里，支持 [属性名] 引用该块标签下其它属性的当前值
 *   - 点击行首 ✨（或输入框为空时自动取标签 schema 的默认值提示词）→ AI 生成 → 结果经宿主 API 写回该属性
 *   - @ 开头的非文本属性（数字/勾选/日期等）不装 ✨
 *
 * 使用：
 *   1. 给标签添加一个 @ 开头的文本属性（如 @AI），在其 schema 默认值里写提示词模板，
 *      或临时在面板输入框里手写；[属性名] 引用其它属性的当前值
 *   2. 点击块的标签打开面板，@ 行的图标已变为 ✨，点击生成
 *
 * 注意：需在 Orca 设置「AI 对话设置」中配置 AI；并在本脚本的标签属性里勾选
 * autoRun（启动即监听）。提示词里未被识别为属性名的 [括号内容] 会原样保留。
 */

const MARKER = "@";

/* 脚本级生命周期：abort() 一并摘掉所有 ✨ 点击监听与标签点击捕获，
 * 免去逐个 removeEventListener（需要保留 handler 引用，容易漏）。 */
const unloadController = new AbortController();

/* 宿主可能没带 tabler 的 ti-spin 动画——自带一份 keyframes，保证「生成中」转圈可见 */
const spinStyle = document.createElement("style");
spinStyle.textContent =
  "@keyframes lets-aifill-spin { to { transform: rotate(360deg); } }" +
  ".lets-aifill-spin { display: inline-block; animation: lets-aifill-spin 1.2s linear infinite; }";
document.head.appendChild(spinStyle);

/* 只有文本类控件算 AI 属性：textarea / 文本型 input。
 * 排除 number、checkbox、date 等非文本控件（「@」开头的非文本属性不装 ✨）。 */
function isTextControl(el) {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    const t = (el.getAttribute("type") || "text").toLowerCase();
    return t === "text" || t === "search" || t === "url" || t === "email";
  }
  return false;
}

/* 面板的所有行元素是菜单的直接子节点：icon / name / 控件依次排列 */
function groupRows(menu) {
  const rows = [];
  let cur = null;
  let prev = null;
  for (const el of menu.children) {
    if (el.classList && el.classList.contains("orca-tag-data-name")) {
      cur = { name: el.textContent.trim(), icon: prev, control: null };
      rows.push(cur);
    } else if (cur) {
      if (el.classList && el.classList.contains("orca-textarea") && !cur.control) {
        cur.control = el;
      } else if (
        el.tagName === "BUTTON" &&
        !(el.className || "").includes("orca-tag-data-reset") &&
        !cur.control
      ) {
        cur.control = el;
      }
    }
    prev = el;
  }
  return rows;
}

/* 标签面板不显示所属标签名，但面板由点击编辑器里的标签芯片触发——芯片上有
 * data-name（标签名）。捕获阶段记录最近一次点击的标签名，即可经
 * get-block-by-alias 直取该标签块的 @ 属性默认值。 */
let lastTagClick = null;
function captureTagClicks() {
  const handler = (e) => {
    const chip = e.target && e.target.closest
      ? e.target.closest(".orca-tag[data-name]")
      : null;
    if (!chip) return;
    // 同时记录被编辑的块 id：读真实属性值（多选/链接等）需要。
    let blockId = null;
    let el = chip;
    while (el && el !== document.body) {
      const idAttr =
        el.getAttribute &&
        (el.getAttribute("data-id") || el.getAttribute("data-block-id"));
      if (idAttr) {
        blockId = parseInt(idAttr, 10) || null;
        break;
      }
      if (el.id && /^block-d+$/.test(el.id)) {
        blockId = parseInt(el.id.slice("block-".length), 10);
        break;
      }
      el = el.parentElement;
    }
    lastTagClick = { name: chip.getAttribute("data-name"), blockId };
  };
  document.addEventListener("click", handler, {
    capture: true,
    signal: unloadController.signal,
  });
}

/* 属性值 → 字符串：多选数组用「、」连接，null/undefined → 空串，其余 String() 兜底。 */
function serializeValue(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join("、");
  if (typeof v === "string") return v;
  return String(v);
}

/* 读正在编辑块的 tag ref（含 .data 属性表）；读不到返回 null。 */
async function findTagRef(tagName) {
  if (!lastTagClick || !lastTagClick.blockId) return null;
  try {
    const b = await orca.invokeBackend("get-block", lastTagClick.blockId);
    if (!b || !Array.isArray(b.refs)) return null;
    return (
      b.refs.find(
        (r) => r.type === 2 && (r.alias === tagName || r.name === tagName),
      ) || null
    );
  } catch (e) {
    return null;
  }
}

/* 经宿主 API 写回 @ 属性值：setRefData(null, ref, [prop])。
 * 比 DOM 事件稳定——块数据更新后由面板重渲染，值真正落库。
 * 保留原属性 type / typeArgs（只改 value，类型不变）。 */
async function setRefValue(tagRef, propName, text) {
  const bare = propName.startsWith(MARKER) ? propName.slice(MARKER.length) : propName;
  const existing = (Array.isArray(tagRef.data) ? tagRef.data : []).find(
    (p) => p.name === bare || p.name === MARKER + bare,
  );
  const prop = {
    name: existing ? existing.name : propName,
    type: existing && typeof existing.type === "number" ? existing.type : 1,
    typeArgs: existing && existing.typeArgs ? existing.typeArgs : undefined,
    value: text,
  };
  await orca.commands.invokeEditorCommand("core.editor.setRefData", null, tagRef, [prop]);
}

/* 解析单个 [属性名]：一律读被编辑块的真实属性值序列化。
 * 读不到（块数据不可得 / 属性不存在）→ 保留原文 [name]，不静默兜底，便于排查。 */
function resolveRefValue(name, refData) {
  if (!refData) return "[" + name + "]";
  const bare = name.startsWith(MARKER) ? name.slice(MARKER.length) : name;
  const p = refData.find((x) => x.name === bare || x.name === MARKER + bare);
  return p && p.value != null ? serializeValue(p.value) : "[" + name + "]";
}

/* 顺序解析提示词里的所有 [引用]（可能有异步读块，不能用同步 replace 回调）。 */
async function resolveRefs(prompt, refData) {
  let out = "";
  let last = 0;
  const re = /\[([^\[\]]+)\]/g;
  let m;
  while ((m = re.exec(prompt))) {
    out += prompt.slice(last, m.index) + resolveRefValue(m[1], refData);
    last = m.index + m[0].length;
  }
  return out + prompt.slice(last);
}

async function findSchemaDefault(propName) {
  if (!lastTagClick || !lastTagClick.name) return null;
  try {
    // 注意：get-block-by-alias 返回的是块对象（含 properties），不是 id。
    const tagBlock = await orca.invokeBackend("get-block-by-alias", lastTagClick.name);
    if (!tagBlock || !Array.isArray(tagBlock.properties)) return null;
    // 属性名可能带/不带 @ 前缀（面板行名与存储名可能不一致），按裸名匹配兼容。
    const bare = propName.startsWith(MARKER) ? propName.slice(MARKER.length) : propName;
    const aiProp = tagBlock.properties.find(
      (p) =>
        p.typeArgs &&
        typeof p.typeArgs.default === "string" &&
        (p.name === propName || p.name === bare || p.name === MARKER + bare),
    );
    return aiProp ? aiProp.typeArgs.default : null;
  } catch (e) {
    return null;
  }
}

async function generateFor(row, menu) {
  const ta = isTextControl(row.control) ? row.control : null;
  let prompt = (ta ? ta.value : "").trim();
  if (!prompt) {
    // 输入框为空 → 取标签 schema 默认值提示词（仅用于生成，不写回输入框）。
    const def = await findSchemaDefault(row.name);
    if (def) prompt = def.trim();
  }
  if (!prompt) {
    orca.notify("warn", "先在 " + row.name + " 输入框写提示词，可用 [属性名] 引用其它属性");
    return;
  }
  const tagRef = await findTagRef(lastTagClick ? lastTagClick.name : "");
  const refData = tagRef && Array.isArray(tagRef.data) ? tagRef.data : null;
  prompt = await resolveRefs(prompt, refData);

  if (typeof $inject.aiChat !== "function") {
    orca.notify("error", "AI 未配置：请在 Orca 设置「AI 对话设置」中配置后重试");
    return;
  }

  try {
    orca.notify("info", "正在用 AI 生成「" + row.name + "」…");
    const out = await $inject.aiChat([{ role: "user", content: prompt }]);
    const text = String(out).trim().replace(/^\`\`\`[a-zA-Z0-9]*\n?|\`\`\`$/g, "");
    if (tagRef) {
      await setRefValue(tagRef, row.name, text);
      orca.notify("success", row.name + " 已生成");
    } else {
      orca.notify("error", "写入失败：找不到标签引用（" + row.name + "）");
    }
  } catch (err) {
    orca.notify("error", "AI 生成失败：" + (err && err.message ? err.message : err));
  }
}

/* 不新增节点（会挤压原生控件）——直接把 @ 行的行首图标改造成 ✨ 触发器。
 * 原图标类名存入 data-orig-class，卸载时还原。 */
function enhanceMenu(menu) {
  for (const row of groupRows(menu)) {
    if (!row.name.startsWith(MARKER) || !row.icon) continue;
    if (!isTextControl(row.control)) continue; // 非文本控件无法 AI 填充，不装 ✨
    if (row.icon.dataset.aiReady) continue;

    row.icon.dataset.aiReady = "1";
    row.icon.dataset.origClass = row.icon.className;
    row.icon.className = "orca-tag-data-propicon ti ti-sparkles";
    row.icon.title = "AI 生成：按提示词填充本属性（[属性名] 引用其它属性的当前值；空提示词时取标签默认值）";
    row.icon.style.cursor = "pointer";
    row.icon.style.color = "var(--orca-color-primary-7, #4f8ef7)";

    row.icon.addEventListener(
      "click",
      async (e) => {
        e.stopPropagation();
        if (row.icon.dataset.busy) return;
        row.icon.dataset.busy = "1";
        const origTitle = row.icon.title;
        row.icon.className = "orca-tag-data-propicon ti ti-loader-3 lets-aifill-spin";
        row.icon.title = "AI 生成中…";
        try {
          await generateFor(row, menu);
        } finally {
          row.icon.dataset.busy = "";
          // 面板可能在生成期间被关闭/重建：节点已不在文档时跳过还原
          if (row.icon.isConnected) {
            row.icon.className = "orca-tag-data-propicon ti ti-sparkles";
            row.icon.title = origTitle;
          }
        }
      },
      { signal: unloadController.signal },
    );
  }
}

function enhanceAll() {
  const menus = document.querySelectorAll(".orca-tag-data-menu");
  if (menus.length === 0) {
    // 面板已关闭：清掉上次的标签/块引用，避免脏数据残留到下次打开
    lastTagClick = null;
    return;
  }
  menus.forEach(enhanceMenu);
}

/* 全文档 observer 只作「面板出现/行变更」的信号：enhanceAll 每帧最多跑一次，
 * 避免大型 DOM 下每次 mutation 都全量扫描（面板未开时开销≈一帧一次类查询）。 */
let enhanceScheduled = false;
function scheduleEnhance() {
  if (enhanceScheduled) return;
  enhanceScheduled = true;
  requestAnimationFrame(() => {
    enhanceScheduled = false;
    enhanceAll();
  });
}

const popupObserver = new MutationObserver(() => scheduleEnhance());
popupObserver.observe(document.body, { childList: true, subtree: true });
captureTagClicks();
enhanceAll();

$inject.onUnload(() => {
  // 先 abort：所有 ✨ 点击监听、标签点击捕获随 signal 一并移除
  unloadController.abort();
  popupObserver.disconnect();
  spinStyle.remove();
  /* 还原被改造的行首图标（监听已随 signal 移除，只清 DOM 痕迹） */
  document
    .querySelectorAll(".orca-tag-data-propicon[data-ai-ready]")
    .forEach((ic) => {
      if (ic.dataset.origClass) ic.className = ic.dataset.origClass;
      delete ic.dataset.aiReady;
      delete ic.dataset.origClass;
      delete ic.dataset.busy;
    });
});
