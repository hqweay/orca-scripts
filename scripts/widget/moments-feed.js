// @inject-template-id: moments-feed
// 用途: 朋友圈式「碎碎念」侧边栏挂件：AI 回复、连续对话、心情分类、每周总结、长按重回复

(function () {
  'use strict';

  const SSN_TAG = '碎碎念';
  const AI_TAG = 'AI Result';
  const MOODS = ['开心', 'emo', '平静', '焦虑', '疲惫'];
  const MOOD_ICONS = { 开心: '😄', emo: '😢', 平静: '😌', 焦虑: '😰', 疲惫: '😪' };

  // ================= 样式 =================
  const styleEl = document.createElement('style');
  styleEl.textContent = `
.ssn-widget{box-sizing:border-box;display:flex;flex-direction:column;gap:10px;padding:10px 12px 28px;font-size:13px;color:var(--orca-fg,var(--orca-text,#2b2b2b));line-height:1.5;}
.ssn-widget *{box-sizing:border-box;}
.ssn-widget button{font-family:inherit;}
.ssn-toolbar{position:sticky;top:0;z-index:5;display:flex;flex-direction:column;gap:6px;padding:4px 0 8px;background:var(--orca-bg,#fff);}
.ssn-tb-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.ssn-seg{display:inline-flex;gap:2px;padding:2px;border-radius:8px;background:var(--orca-bg-2,rgba(128,128,128,.08));}
.ssn-btn{border:1px solid var(--orca-border,#e4e4e4);background:var(--orca-bg-2,rgba(128,128,128,.08));color:var(--orca-fg,var(--orca-text,#2b2b2b));border-radius:8px;padding:4px 10px;font-size:12px;line-height:1.5;cursor:pointer;}
.ssn-btn:hover{opacity:.85;}
.ssn-btn.active{background:var(--orca-primary,var(--orca-accent,#4f6ef7));border-color:var(--orca-primary,var(--orca-accent,#4f6ef7));color:var(--orca-accent-fg,#fff);opacity:1;}
.ssn-seg .ssn-btn{border:none;background:transparent;border-radius:6px;}
.ssn-seg .ssn-btn.active{background:var(--orca-primary,var(--orca-accent,#4f6ef7));color:var(--orca-accent-fg,#fff);}
.ssn-ico{padding:4px 9px;font-size:13px;}
.ssn-summary{border:1px solid var(--orca-border,#e4e4e4);border-radius:12px;overflow:hidden;background:var(--orca-bg-2,rgba(128,128,128,.05));}
.ssn-summary-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;font-weight:600;font-size:12.5px;cursor:pointer;user-select:none;}
.ssn-summary-ops{display:inline-flex;gap:4px;}
.ssn-mini{border:1px solid var(--orca-border,#e4e4e4);background:transparent;color:var(--orca-muted,var(--orca-secondary,#8a8a8a));border-radius:6px;font-size:11px;padding:1px 6px;cursor:pointer;}
.ssn-summary-body{padding:2px 10px 10px;white-space:pre-wrap;word-break:break-word;font-size:12.5px;line-height:1.7;}
.ssn-view{display:flex;flex-direction:column;gap:14px;}
.ssn-day{display:flex;flex-direction:column;gap:10px;}
.ssn-day-title{font-size:12px;color:var(--orca-muted,var(--orca-secondary,#8a8a8a));letter-spacing:.5px;}
.ssn-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.ssn-grid .ssn-actions{display:none;}
.ssn-mood-group{display:flex;flex-direction:column;gap:10px;}
.ssn-mood-title{font-size:12px;color:var(--orca-muted,var(--orca-secondary,#8a8a8a));}
.ssn-card{position:relative;background:var(--orca-card-bg,var(--orca-bg-2,rgba(128,128,128,.06)));border:1px solid var(--orca-border,#e4e4e4);border-radius:12px;padding:10px 12px;cursor:pointer;transition:box-shadow .15s ease,transform .15s ease;animation:ssnIn .3s ease both;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;}
.ssn-card:hover{box-shadow:0 2px 10px var(--orca-shadow,rgba(0,0,0,.08));transform:translateY(-1px);}
@keyframes ssnIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
.ssn-text{white-space:pre-wrap;word-break:break-word;line-height:1.65;}
.ssn-meta{display:flex;align-items:center;gap:10px;margin-top:8px;font-size:11px;color:var(--orca-muted,var(--orca-secondary,#8a8a8a));}
.ssn-thread-badge{cursor:pointer;background:var(--orca-bg-2,rgba(128,128,128,.1));border-radius:999px;padding:1px 8px;}
.ssn-thread{margin-top:10px;border-top:1px dashed var(--orca-border,#e4e4e4);padding-top:8px;display:flex;flex-direction:column;gap:8px;}
.ssn-thread-empty{font-size:12px;color:var(--orca-muted,var(--orca-secondary,#8a8a8a));}
.ssn-reply{border-left:2px solid var(--orca-border,#e4e4e4);padding:4px 0 4px 10px;display:flex;flex-direction:column;gap:4px;}
.ssn-reply.lv2{margin-left:8px;}
.ssn-reply-text{font-size:12.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;}
.ssn-reply-meta{font-size:11px;color:var(--orca-muted,var(--orca-secondary,#8a8a8a));display:flex;gap:8px;align-items:center;}
.ssn-rreply{border:none;background:none;color:var(--orca-primary,var(--orca-accent,#4f6ef7));font-size:11px;padding:0;cursor:pointer;}
.ssn-rreply:disabled{opacity:.6;cursor:wait;}
.ssn-reply-more{font-size:11px;color:var(--orca-muted,var(--orca-secondary,#8a8a8a));}
.ssn-actions{margin-top:8px;display:flex;gap:8px;}
.ssn-reply-btn{border:1px solid var(--orca-border,#e4e4e4);background:var(--orca-bg-2,rgba(128,128,128,.06));color:var(--orca-fg,var(--orca-text,#2b2b2b));border-radius:8px;padding:3px 10px;font-size:12px;cursor:pointer;}
.ssn-reply-btn:disabled{opacity:.6;cursor:wait;}
.ssn-longmenu{display:flex;gap:6px;margin-top:8px;}
.ssn-lm-btn{border:1px solid var(--orca-primary,var(--orca-accent,#4f6ef7));color:var(--orca-primary,var(--orca-accent,#4f6ef7));background:transparent;border-radius:8px;padding:3px 10px;font-size:12px;cursor:pointer;}
.ssn-empty{text-align:center;color:var(--orca-muted,var(--orca-secondary,#8a8a8a));padding:36px 0;line-height:1.8;}
.ssn-hint{text-align:center;color:var(--orca-muted,var(--orca-secondary,#8a8a8a));padding:30px 0;font-size:12px;}
.ssn-view[hidden],.ssn-summary[hidden],.ssn-empty[hidden],.ssn-thread[hidden],.ssn-longmenu[hidden]{display:none!important;}
`;
  document.head.appendChild(styleEl);

  // ================= 状态 =================
  const state = {
    blocks: [],
    blocksById: new Map(),
    aiMap: new Map(),
    moodSets: {},
    view: 'feed',
    sort: 'modified',
    root: null,
    generating: new Set(),
    longTimer: null,
    longActive: false,
    longCard: null,
  };
  let refreshing = false;
  let refreshQueued = false;
  let cleanupFns = [];

  // ================= 工具 =================
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function parseTime(v) {
    if (v == null) return 0;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v >= 1e12 ? v : v * 1000;
    const d = new Date(v);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function fmtTime(v) {
    const t = parseTime(v);
    if (!t) return '';
    const d = new Date(t);
    const now = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return `今天 ${hh}:${mm}`;
    if (d.toDateString() === new Date(now.getTime() - 86400000).toDateString()) return `昨天 ${hh}:${mm}`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
  }

  function fmtShortDate(v) {
    const t = parseTime(v);
    if (!t) return '';
    const d = new Date(t);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  // ================= 数据加载 =================
  async function loadAll() {
    const [ssn, ai] = await Promise.all([
      orca.invokeBackend('get-blocks-with-tags', [SSN_TAG]),
      orca.invokeBackend('get-blocks-with-tags', [AI_TAG]),
    ]);
    state.blocks = ssn || [];
    state.blocksById = new Map(state.blocks.map((b) => [b.id, b]));
    state.aiMap = new Map((ai || []).map((b) => [b.id, b]));
    const moodSets = {};
    await Promise.all(MOODS.map(async (m) => {
      const bs = await orca.invokeBackend('get-blocks-with-tags', [m]);
      moodSets[m] = new Set((bs || []).map((b) => b.id));
    }));
    state.moodSets = moodSets;
  }

  async function refresh() {
    if (refreshing) { refreshQueued = true; return; }
    refreshing = true;
    try {
      await loadAll();
      renderAll();
      handle.setStatus(`${state.blocks.length} 条碎碎念`);
    } catch (err) {
      console.error('[碎碎念挂件]', err);
      orca.notify('warn', '加载碎碎念失败：' + (err && err.message ? err.message : err));
    } finally {
      refreshing = false;
      if (refreshQueued) { refreshQueued = false; refresh(); }
    }
  }

  // ================= 渲染 =================
  function sortedList() {
    const arr = [...state.blocks];
    if (state.sort === 'random') {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    } else {
      arr.sort((a, b) => parseTime(a[state.sort] ?? a.modified) - parseTime(b[state.sort] ?? b.modified));
      if (state.sort === 'modified') arr.reverse();
    }
    return arr;
  }

  function cardHTML(b, i = 0) {
    const raw = b.text == null ? '' : String(b.text);
    const text = raw.trim();
    const wc = raw.replace(/\s/g, '').length;
    const l1 = (b.children || []).filter((cid) => state.aiMap.has(cid));
    const badge = l1.length ? `<span class="ssn-thread-badge" data-thread="${b.id}" title="查看对话">💬 ${l1.length}</span>` : '';
    return `
    <div class="ssn-card" data-id="${b.id}" style="animation-delay:${Math.min(i * 25, 400)}ms">
      <div class="ssn-card-main">
        <div class="ssn-text">${esc(text || '（空白）')}</div>
        <div class="ssn-meta">
          <span class="ssn-time">${fmtTime(b.modified)}</span>
          <span class="ssn-wc">${wc} 字</span>
          ${badge}
        </div>
        <div class="ssn-thread" hidden></div>
        <div class="ssn-actions">
          <button class="ssn-reply-btn" data-id="${b.id}">🤖 回复</button>
        </div>
        <div class="ssn-longmenu" hidden>
          <button class="ssn-lm-btn" data-lm="append" data-id="${b.id}">追加回复</button>
          <button class="ssn-lm-btn" data-lm="overwrite" data-id="${b.id}">覆盖上次</button>
        </div>
      </div>
    </div>`;
  }

  function feedHTML(list) {
    const startToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const groups = { today: [], yesterday: [], earlier: [] };
    for (const b of list) {
      const t = parseTime(b.modified);
      if (t >= startToday) groups.today.push(b);
      else if (t >= startToday - 86400000) groups.yesterday.push(b);
      else groups.earlier.push(b);
    }
    let html = '';
    for (const [k, label] of [['today', '今天'], ['yesterday', '昨天'], ['earlier', '更早']]) {
      if (!groups[k].length) continue;
      html += `<div class="ssn-day"><div class="ssn-day-title">${label} · ${groups[k].length}</div>${groups[k].map((b, i) => cardHTML(b, i)).join('')}</div>`;
    }
    return html || '<div class="ssn-hint">没有碎碎念～</div>';
  }

  function gridHTML(list) {
    return `<div class="ssn-grid">${list.map((b, i) => cardHTML(b, i)).join('')}</div>`;
  }

  function moodHTML(list) {
    const groups = MOODS.map((m) => ({ mood: m, blocks: [] }));
    const none = [];
    for (const b of list) {
      const hits = MOODS.filter((m) => state.moodSets[m] && state.moodSets[m].has(b.id));
      if (hits.length) hits.forEach((m) => groups.find((g) => g.mood === m).blocks.push(b));
      else none.push(b);
    }
    let html = '';
    for (const g of groups) {
      if (!g.blocks.length) continue;
      html += `<div class="ssn-mood-group"><div class="ssn-mood-title">${MOOD_ICONS[g.mood] || '💬'} ${g.mood} · ${g.blocks.length}</div>${g.blocks.map((b, i) => cardHTML(b, i)).join('')}</div>`;
    }
    if (none.length) html += `<div class="ssn-mood-group"><div class="ssn-mood-title">🤔 未分类 · ${none.length}</div>${none.map((b, i) => cardHTML(b, i)).join('')}</div>`;
    return html || '<div class="ssn-hint">没有碎碎念～</div>';
  }

  function renderThread(rootId) {
    const rootB = state.blocksById.get(rootId);
    const l1 = ((rootB && rootB.children) || []).filter((cid) => state.aiMap.has(cid));
    if (!l1.length) return '<div class="ssn-thread-empty">还没有回复</div>';
    return l1.map((cid) => bubbleHTML(state.aiMap.get(cid), 1)).join('');
  }

  function bubbleHTML(b, level) {
    if (!b) return '';
    const kids = (b.children || []).filter((cid) => state.aiMap.has(cid));
    let inner = '';
    if (level === 1) {
      inner = kids.map((cid) => bubbleHTML(state.aiMap.get(cid), 2)).join('');
    } else if (kids.length) {
      const deeper = countDeeper(kids);
      if (deeper > 0) inner = `<div class="ssn-reply-more">还有 ${deeper} 条</div>`;
    }
    return `
    <div class="ssn-reply lv${level}">
      <div class="ssn-reply-text">${esc(b.text || '')}</div>
      <div class="ssn-reply-meta">
        <span>${fmtTime(b.modified)}</span>
        <button class="ssn-rreply" data-parent="${b.id}">回复</button>
      </div>
      ${inner}
    </div>`;
  }

  function countDeeper(ids, depth = 0) {
    if (depth > 10) return ids.length;
    let n = 0;
    for (const id of ids) {
      const b = state.aiMap.get(id);
      if (!b) continue;
      const kids = (b.children || []).filter((cid) => state.aiMap.has(cid));
      n += kids.length + countDeeper(kids, depth + 1);
    }
    return n;
  }

  function renderAll() {
    const root = state.root;
    if (!root) return;
    const list = sortedList();
    root.querySelector('.ssn-view-feed').innerHTML = feedHTML(list);
    root.querySelector('.ssn-view-grid').innerHTML = gridHTML(list);
    root.querySelector('.ssn-view-mood').innerHTML = moodHTML(list);
    const empty = root.querySelector('.ssn-empty');
    if (empty) empty.hidden = list.length > 0;
    state.generating.forEach((id) => setGeneratingUI(id, true));
  }

  // ================= 交互 =================
  function setGeneratingUI(id, on) {
    if (on) state.generating.add(id); else state.generating.delete(id);
    const root = state.root;
    if (!root) return;
    root.querySelectorAll(`.ssn-reply-btn[data-id="${id}"]`).forEach((b) => {
      b.disabled = on;
      b.textContent = on ? '思考中…' : '🤖 回复';
    });
    root.querySelectorAll(`.ssn-rreply[data-parent="${id}"]`).forEach((b) => {
      b.disabled = on;
      b.textContent = on ? '思考中…' : '回复';
    });
  }

  function switchView(v) {
    const root = state.root;
    if (!root) return;
    state.view = v;
    root.querySelectorAll('.ssn-btn-views').forEach((x) => x.classList.toggle('active', x.dataset.view === v));
    root.querySelector('.ssn-view-feed').hidden = v !== 'feed';
    root.querySelector('.ssn-view-grid').hidden = v !== 'grid';
    root.querySelector('.ssn-view-mood').hidden = v !== 'mood';
  }

  function showLongMenu(card) {
    hideLongMenu();
    state.longCard = card;
    const m = card.querySelector('.ssn-longmenu');
    if (m) m.hidden = false;
  }
  function hideLongMenu() {
    if (state.longCard) {
      const m = state.longCard.querySelector('.ssn-longmenu');
      if (m) m.hidden = true;
      state.longCard = null;
    }
  }

  function handlePointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const card = e.target.closest('.ssn-card');
    if (state.longCard && card !== state.longCard && !e.target.closest('.ssn-longmenu')) hideLongMenu();
    clearTimeout(state.longTimer);
    state.longTimer = null;
    if (!card) return;
    state.longActive = false;
    state.longTimer = setTimeout(() => {
      state.longActive = true;
      showLongMenu(card);
    }, 500);
  }

  function handleClick(e) {
    const lmBtn = e.target.closest('.ssn-lm-btn');
    if (lmBtn) {
      e.stopPropagation();
      const card = lmBtn.closest('.ssn-card');
      const ssnId = Number(card.dataset.id);
      hideLongMenu();
      doReply(ssnId, lmBtn.dataset.lm, ssnId);
      return;
    }
    if (e.target.closest('.ssn-longmenu')) { e.stopPropagation(); return; }

    const replyBtn = e.target.closest('.ssn-reply-btn');
    if (replyBtn) {
      hideLongMenu();
      const id = Number(replyBtn.dataset.id);
      doReply(id, 'append', id);
      return;
    }

    const rReply = e.target.closest('.ssn-rreply');
    if (rReply) {
      hideLongMenu();
      const card = rReply.closest('.ssn-card');
      const ssnId = Number(card.dataset.id);
      doReply(ssnId, 'append', Number(rReply.dataset.parent));
      return;
    }

    const badge = e.target.closest('.ssn-thread-badge');
    if (badge) {
      hideLongMenu();
      toggleThread(badge);
      return;
    }

    const card = e.target.closest('.ssn-card');
    if (card) {
      if (state.longActive) { state.longActive = false; return; }
      hideLongMenu();
      orca.nav.goTo('block', { blockId: Number(card.dataset.id) });
      return;
    }
    hideLongMenu();
  }

  function toggleThread(badge) {
    const id = Number(badge.dataset.thread);
    const card = badge.closest('.ssn-card');
    const threadEl = card.querySelector('.ssn-thread');
    if (!threadEl.hidden) { threadEl.hidden = true; return; }
    threadEl.hidden = false;
    if (threadEl.dataset.loaded === String(id)) return;
    threadEl.dataset.loaded = String(id);
    threadEl.innerHTML = renderThread(id);
  }

  // ================= AI 回复 =================
  async function genReplyText(context) {
    const sys = '你是用户的好朋友。用温暖、口语化、1-3 句话回复 TA 的碎碎念，带共情，不用敬语，不解释自己在做什么。回复文本末尾用【心情:xxx】标注情绪，取值只能是：开心/emo/平静/焦虑/疲惫。';
    const raw = await $inject.aiChat([{ role: 'system', content: sys }, { role: 'user', content: context || '（空白碎碎念）' }]);
    const str = String(raw == null ? '' : raw);
    const m = str.match(/【心情:([^】]+)】/);
    const text = str.replace(/【心情:[^】]*】/g, '').trim();
    let mood = null;
    if (m && MOODS.includes(m[1].trim())) mood = m[1].trim();
    return { text, mood };
  }

  async function doReply(ssnId, mode, parentId) {
    const block = state.blocksById.get(ssnId);
    if (!block || state.generating.has(parentId)) return;
    setGeneratingUI(parentId, true);
    try {
      const context = parentId !== ssnId && state.aiMap.get(parentId)
        ? `TA 的碎碎念：${block.text || ''}\n\n你之前的回复：${state.aiMap.get(parentId).text || ''}\n\n请顺着这个话题自然接一句。`
        : (block.text || '');
      const { text, mood } = await genReplyText(context);
      if (!text) throw new Error('AI 返回为空');

      if (mode === 'overwrite') {
        const parentBlock = state.blocksById.get(parentId) || state.aiMap.get(parentId);
        const kids = ((parentBlock && parentBlock.children) || []).filter((cid) => state.aiMap.has(cid));
        if (kids.length) await orca.commands.invokeEditorCommand('core.editor.deleteBlocks', null, kids);
      }

      const ref = orca.state.blocks[parentId];
      if (ref) {
        const newId = await orca.commands.invokeEditorCommand('core.editor.insertBlock', null, ref, 'lastChild', [{ t: 't', v: text }]);
        if (newId) await $inject.applyTag(newId, AI_TAG);
        if (mood) await $inject.applyTag(ssnId, mood);
        orca.notify('success', '已回复并标记为 AI Result');
      } else {
        const cursor = orca.utils.getCursorDataFromSelection(window.getSelection());
        const anchor = cursor && cursor.anchor && cursor.anchor.blockId ? orca.state.blocks[cursor.anchor.blockId] : null;
        if (anchor) {
          await orca.commands.invokeEditorCommand('core.editor.batchInsertText', cursor, anchor, 'after', `回复 @碎碎念：${text}`);
          if (mood) await $inject.applyTag(ssnId, mood);
          orca.notify('success', '已回复（该块不在当前文档，插入到光标处）');
        } else {
          orca.notify('warn', '该块不在当前文档，请先在编辑区点击放置光标');
        }
      }
    } catch (err) {
      console.error('[碎碎念挂件]', err);
      orca.notify('warn', '回复生成失败：' + (err && err.message ? err.message : err));
    } finally {
      setGeneratingUI(parentId, false);
      await refresh();
    }
  }

  // ================= 每周总结 =================
  async function buildSummaryText() {
    const weekAgo = Date.now() - 7 * 86400000;
    const recent = state.blocks
      .filter((b) => parseTime(b.modified) >= weekAgo)
      .sort((a, b) => parseTime(a.modified) - parseTime(b.modified))
      .slice(0, 50);
    if (!recent.length) return '最近 7 天还没有碎碎念～去记录一些吧 ✨';
    const lines = [`近 7 天共 ${recent.length} 条碎碎念：`];
    for (const b of recent) {
      lines.push(`【${fmtShortDate(b.modified)}】${String(b.text || '').trim()}`);
      const l1 = (b.children || []).filter((cid) => state.aiMap.has(cid));
      for (const cid of l1) {
        const r = state.aiMap.get(cid);
        if (r && r.text) lines.push(`  - 朋友回复：${String(r.text).trim()}`);
      }
    }
    const sys = '你是用户的好朋友。根据下面近 7 天的碎碎念和你们的对话，写一篇口语化的一周小结：先一句整体感受，再列 2-4 个亮点或变化，最后一句鼓励。200 字以内，不用敬语，不要 Markdown 标题，直接分段。';
    return await $inject.aiChat([{ role: 'system', content: sys }, { role: 'user', content: lines.join('\n') }]);
  }

  async function runSummary() {
    const root = state.root;
    if (!root) return;
    const panel = root.querySelector('.ssn-summary');
    const body = root.querySelector('.ssn-summary-body');
    panel.hidden = false;
    body.textContent = '正在生成本周总结…';
    try {
      body.textContent = await buildSummaryText();
    } catch (err) {
      body.textContent = '生成失败：' + (err && err.message ? err.message : err);
      orca.notify('warn', '本周总结生成失败');
    }
  }

  // ================= 挂件注册 =================
  let handle = null;
  handle = $inject.registerSidebarGroup({
    key: 'ssn-moments-feed',
    title: $inject.scriptName,
    icon: 'ti ti-mood-smile',
    parent: $inject.scriptGroup || undefined,
    status: '加载中…',
    render: () => {
      const vAct = (v) => (state.view === v ? ' active' : '');
      const sAct = (s) => (state.sort === s ? ' active' : '');
      return `
      <div class="ssn-widget">
        <div class="ssn-toolbar">
          <div class="ssn-tb-row">
            <div class="ssn-seg">
              <button class="ssn-btn ssn-btn-views${vAct('feed')}" data-view="feed">朋友圈</button>
              <button class="ssn-btn ssn-btn-views${vAct('grid')}" data-view="grid">网格</button>
              <button class="ssn-btn ssn-btn-views${vAct('mood')}" data-view="mood">按心情</button>
            </div>
          </div>
          <div class="ssn-tb-row">
            <div class="ssn-seg">
              <button class="ssn-btn ssn-btn-sort${sAct('modified')}" data-sort="modified">最新</button>
              <button class="ssn-btn ssn-btn-sort${sAct('created')}" data-sort="created">最早</button>
              <button class="ssn-btn ssn-btn-sort${sAct('random')}" data-sort="random">随机</button>
            </div>
            <button class="ssn-btn ssn-ico" data-act="refresh" title="刷新">⟳</button>
            <button class="ssn-btn" data-act="summary">本周总结</button>
          </div>
        </div>
        <div class="ssn-summary" hidden>
          <div class="ssn-summary-head" data-act="summary-toggle">
            <span>📊 本周总结</span>
            <span class="ssn-summary-ops">
              <button class="ssn-mini" data-act="summary-reg">重新生成</button>
              <button class="ssn-mini" data-act="summary-close">✕</button>
            </span>
          </div>
          <div class="ssn-summary-body"></div>
        </div>
        <div class="ssn-empty" hidden>还没有碎碎念～<br>给块打上「碎碎念」标签，点 ⟳ 刷新</div>
        <div class="ssn-view ssn-view-feed"><div class="ssn-hint">加载中…</div></div>
        <div class="ssn-view ssn-view-grid" hidden></div>
        <div class="ssn-view ssn-view-mood" hidden></div>
      </div>`;
    },
    onFocus: (container) => {
      state.root = container;

      container.querySelectorAll('.ssn-btn-views').forEach((btn) => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
      });
      container.querySelectorAll('.ssn-btn-sort').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.sort = btn.dataset.sort;
          container.querySelectorAll('.ssn-btn-sort').forEach((x) => x.classList.toggle('active', x === btn));
          renderAll();
        });
      });
      container.querySelector('[data-act="refresh"]').addEventListener('click', refresh);
      container.querySelector('[data-act="summary"]').addEventListener('click', runSummary);
      container.querySelector('[data-act="summary-reg"]').addEventListener('click', runSummary);
      container.querySelector('[data-act="summary-close"]').addEventListener('click', (e) => {
        e.stopPropagation();
        container.querySelector('.ssn-summary').hidden = true;
      });
      container.querySelector('[data-act="summary-toggle"]').addEventListener('click', (e) => {
        if (e.target.closest('.ssn-mini')) return;
        const p = container.querySelector('.ssn-summary');
        p.hidden = !p.hidden;
      });

      const onClick = (e) => handleClick(e);
      const onDown = (e) => handlePointerDown(e);
      const onUp = () => { clearTimeout(state.longTimer); state.longTimer = null; };
      const onCtx = (e) => { if (e.target.closest('.ssn-card')) e.preventDefault(); };

      container.addEventListener('click', onClick);
      container.addEventListener('pointerdown', onDown, true);
      container.addEventListener('pointerup', onUp, true);
      container.addEventListener('pointercancel', onUp, true);
      container.addEventListener('contextmenu', onCtx);

      cleanupFns = [
        () => container.removeEventListener('click', onClick),
        () => container.removeEventListener('pointerdown', onDown, true),
        () => container.removeEventListener('pointerup', onUp, true),
        () => container.removeEventListener('pointercancel', onUp, true),
        () => container.removeEventListener('contextmenu', onCtx),
      ];

      refresh();

      return () => {
        clearTimeout(state.longTimer);
        state.longTimer = null;
        state.longActive = false;
        state.longCard = null;
        cleanupFns.forEach((fn) => { try { fn(); } catch (e) {} });
        cleanupFns = [];
        state.root = null;
      };
    },
  });

  $inject.onUnload(() => {
    clearTimeout(state.longTimer);
    handle.unregister();
    styleEl.remove();
  });
})();
