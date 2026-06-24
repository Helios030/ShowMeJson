const $ = (sel) => document.querySelector(sel);

const els = {
  sourceUrl: $("#sourceUrl"),
  jsonStatus: $("#jsonStatus"),
  jsonSize: $("#jsonSize"),
  formatStatus: $("#formatStatus"),
  treeRoot: $("#treeRoot"),
  panelTree: $("#panelTree"),
  searchInput: $("#searchInput"),
  btnClearSearch: $("#btnClearSearch"),
  btnPrev: $("#btnPrev"),
  btnNext: $("#btnNext"),
  btnFormat: $("#btnFormat"),
  resultsMeta: $("#resultsMeta"),
  resultsList: $("#resultsList"),
  btnClear: $("#btnClear"),
  btnPaste: $("#btnPaste"),
  btnCopyRaw: $("#btnCopyRaw"),
  btnCopyPretty: $("#btnCopyPretty"),
  btnHighlightAll: $("#btnHighlightAll"),
  toggleSort: $("#toggleSort"),
  btnExpandAll: $("#btnExpandAll"),
  btnExpand2: $("#btnExpand2"),
  btnCollapseAll: $("#btnCollapseAll"),
  btnSave: $("#btnSave"),
  searchKeys: $("#searchKeys"),
  searchValues: $("#searchValues"),
  btnSettings: $("#btnSettings"),
  settingsModal: $("#settingsModal"),
  btnCloseSettings: $("#btnCloseSettings"),
  currentIndex: $("#currentIndex"),
  totalCount: $("#totalCount"),
  saveDialog: $("#saveDialog"),
  saveFilename: $("#saveFilename"),
  btnCancelSave: $("#btnCancelSave"),
  btnConfirmSave: $("#btnConfirmSave"),
  toast: $("#toast"),
  errorBox: $("#errorBox"),
  rawContent: $("#rawContent"),
  paneDivider: $("#paneDivider"),
  leftPane: $(".left-pane"),
  rightPane: $(".right-pane"),
  searchResultsPanel: $("#searchResultsPanel")
};

const state = {
  mode: "manual",
  sourceUrl: "",
  rawText: "",
  value: null,
  prettyText: "",
  showPanel: "tree",
  sortKeys: false,
  expanded: new Set(),
  selectedPath: null,
  nodeIndex: new Map(),
  arrayRenderCount: new Map(),
  search: {
    q: "",
    running: false,
    results: [],
    selectedIndex: -1,
    truncated: false,
    searchKeys: true,
    searchValues: true
  },
  showResults: false,
  isRawContentDirty: false,
  highlightAll: false,
  highlightedNodes: new Set(),
  currentTheme: "dark"
};

function showToast(text, type = "info", ms = 1600) {
  els.toast.textContent = String(text || "");
  els.toast.className = "toast toast-" + type;
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => {
    els.toast.classList.add("hidden");
  }, ms);
}

function showError(text) {
  els.errorBox.textContent = String(text || "");
  els.errorBox.classList.remove("hidden");
}

function hideError() {
  els.errorBox.classList.add("hidden");
}

function updateStatus(status, type = "info") {
  if (els.jsonStatus) {
    els.jsonStatus.textContent = status;
    els.jsonStatus.className = `status-badge status-${type}`;
  }
}

function updateSizeInfo(text) {
  if (els.jsonSize) {
    els.jsonSize.textContent = text;
  }
}

function updateFormatStatus(status, type = "info") {
  if (els.formatStatus) {
    els.formatStatus.textContent = status;
    els.formatStatus.className = `status-badge status-${type}`;
  }
}

function toggleResults(show) {
  state.showResults = show;
  if (els.searchResultsPanel) {
    els.searchResultsPanel.classList.toggle("show", show);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function saveAsJsonFile(content, filename = 'data.json') {
  // 创建 Blob 对象
  const blob = new Blob([content], { type: 'application/json' });

  // 创建下载链接
  const url = URL.createObjectURL(blob);

  // 创建临时链接并触发下载
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // 清理
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function generateFilename() {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
  const source = state.sourceUrl ? new URL(state.sourceUrl).hostname : 'json';
  return `${source}_${timestamp}.json`;
}

function showSaveDialog() {
  if (!state.prettyText) {
    showToast("没有可保存的内容", "error");
    return;
  }

  // 设置默认文件名
  const defaultFilename = generateFilename();
  els.saveFilename.value = defaultFilename.replace('.json', '');

  // 显示对话框
  els.saveDialog.classList.remove('hidden');

  // 聚焦文件名输入框
  setTimeout(() => {
    els.saveFilename.focus();
    els.saveFilename.select();
  }, 100);
}

function hideSaveDialog() {
  els.saveDialog.classList.add('hidden');
}

function confirmSave() {
  const filename = els.saveFilename.value.trim();
  if (!filename) {
    showToast("请输入文件名", "error");
    els.saveFilename.focus();
    return;
  }

  // 获取选择的保存内容类型
  const contentType = document.querySelector('input[name="contentType"]:checked').value;
  const content = contentType === 'pretty' ? state.prettyText : state.rawText;

  try {
    const fullFilename = filename.endsWith('.json') ? filename : filename + '.json';
    saveAsJsonFile(content, fullFilename);
    hideSaveDialog();
    showToast(`已保存为 ${fullFilename}`, "success");
  } catch (e) {
    showToast("保存失败：" + e.message, "error");
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function highlightJson(text) {
  if (!text) return '';

  // 简单的 JSON 语法高亮
  return text
    // 字符串
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="json-string">"$1"</span>')
    // 数字
    .replace(/\b(-?\d+\.?\d*([eE][+-]?\d+)?|0[xX][0-9a-fA-F]+)\b/g, '<span class="json-number">$&</span>')
    // 布尔值
    .replace(/\b(true|false)\b/g, '<span class="json-boolean">$&</span>')
    // null
    .replace(/\bnull\b/g, '<span class="json-null">$&</span>')
    // 括号和逗号冒号
    .replace(/([{}[\],:])/g, '<span class="json-punctuation">$1</span>');
}

function jsonHighlight(text) {
  const t = String(text || "");
  if (t.length > 2 * 1024 * 1024) return escapeHtml(t);
  const html = escapeHtml(t).replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
    (m) => {
      if (m.startsWith('"') && m.endsWith(":")) return `<span class="k">${m}</span>`;
      if (m.startsWith('"')) return `<span class="v-str">${m}</span>`;
      if (m === "true" || m === "false") return `<span class="v-bool">${m}</span>`;
      if (m === "null") return `<span class="v-null">${m}</span>`;
      return `<span class="v-num">${m}</span>`;
    }
  );
  return html;
}

function getQueryParams() {
  const url = new URL(location.href);
  return {
    id: url.searchParams.get("id") || "",
    mode: url.searchParams.get("mode") || "page"
  };
}

async function getPayload(id) {
  console.log('[ShowMeJson] 请求 payload，ID:', id);
  const res = await chrome.runtime.sendMessage({ type: "JSONFMT_VIEWER_GET_PAYLOAD", id });
  console.log('[ShowMeJson] payload 响应:', res);
  if (!res?.ok) throw new Error(res?.error || "读取数据失败");
  return res.payload;
}

function pathToKey(pathParts) {
  return pathParts.map((p) => String(p)).join("\u0001");
}

// 根据路径获取 JSON 值
function getNodeValue(pathParts) {
  if (!pathParts || pathParts.length === 0) {
    return state.value;
  }

  let current = state.value;
  for (const part of pathParts) {
    if (current === null || current === undefined) {
      return null;
    }

    if (Array.isArray(current)) {
      if (typeof part === 'number' && part >= 0 && part < current.length) {
        current = current[part];
      } else {
        return null;
      }
    } else if (typeof current === 'object') {
      if (typeof part === 'string' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  return current;
}

function pathToDisplay(pathParts) {
  if (!pathParts || pathParts.length === 0) return "$";
  let out = "$";
  for (const part of pathParts) {
    if (typeof part === "number") {
      out += `[${part}]`;
      continue;
    }
    const s = String(part);
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s)) out += `.${s}`;
    else out += `[${JSON.stringify(s)}]`;
  }
  return out;
}

function valueType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function isExpandable(v) {
  if (v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return false;
}

function summarize(v) {
  const t = valueType(v);
  if (t === "array") return `Array(${v.length})`;
  if (t === "object") return `Object(${Object.keys(v).length})`;
  if (t === "string") {
    const s = v.length > 80 ? `${v.slice(0, 80)}…` : v;
    return JSON.stringify(s);
  }
  if (t === "number" || t === "boolean") return String(v);
  if (t === "null") return "null";
  return String(v);
}

function setSelectedPath(pathParts) {
  state.selectedPath = pathParts;
  const key = pathToKey(pathParts);

  // 高亮当前选中的行
  if (state.selectedPath) {
    els.treeRoot.querySelectorAll(".row").forEach(row => {
      row.classList.remove("selected");
    });
    const selectedRow = els.treeRoot.querySelector(`[data-key="${key}"]`);
    if (selectedRow) {
      selectedRow.classList.add("selected");
    }
  }
}

async function copyText(text) {
  const t = String(text || "");
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch { }
  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function setPanel(panel) {
  state.showPanel = panel;
}


function toggleExpanded(pathParts, shouldExpand) {
  const key = pathToKey(pathParts);
  if (shouldExpand) state.expanded.add(key);
  else state.expanded.delete(key);
}

function getExpanded(pathParts) {
  return state.expanded.has(pathToKey(pathParts));
}

function clearTreeIndex() {
  state.nodeIndex.clear();
  state.arrayRenderCount.clear();
}

function makeRow({ keyLabel, valueLabel, typeLabel, pathParts, expandable, expanded }) {
  const row = document.createElement("div");
  row.className = "row";

  // 添加 data-key 属性用于同步选中
  const key = pathToKey(pathParts);
  row.setAttribute('data-key', key);

  // 检查是否需要高亮
  if (state.highlightedNodes.has(key)) {
    row.classList.add("highlight");
  }

  // 检查是否是当前选中的搜索结果
  const { selectedIndex, results } = state.search;
  if (selectedIndex >= 0 && selectedIndex < results.length) {
    const selectedResult = results[selectedIndex];
    const selectedKey = pathToKey(selectedResult.path);
    if (key === selectedKey) {
      row.classList.add("highlight", "active");
    }
  }

  row.addEventListener("click", () => setSelectedPath(pathParts));

  const twisty = document.createElement("div");
  twisty.className = "twisty";
  if (!expandable) twisty.classList.add("empty");
  twisty.textContent = expanded ? "−" : "+";

  const keySpan = document.createElement("span");
  keySpan.className = "k";
  keySpan.textContent = keyLabel;

  const colon = document.createElement("span");
  colon.className = "t";
  colon.textContent = ":";

  const valueSpan = document.createElement("span");
  valueSpan.className = "t";
  valueSpan.innerHTML = valueLabel;

  const typeSpan = document.createElement("span");
  typeSpan.className = "t";
  typeSpan.textContent = typeLabel ? ` ${typeLabel}` : "";

  // 添加复制按钮
  const copyBtn = document.createElement("div");
  copyBtn.className = "copy-btn";
  copyBtn.title = "复制此层级及子集内容";
  copyBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1M8 5a2 2 0 0 0 2 2h2a2 2 0 0 0-2-2M8 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 0h2a2 2 0 0 1 2 2v3m2 4H10m0 0l3-3m-3 3l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  // 复制按钮点击事件
  copyBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const key = pathToKey(pathParts);
    const node = state.nodeIndex.get(key);
    if (node) {
      const jsonValue = getNodeValue(pathParts);
      const jsonString = JSON.stringify(jsonValue, null, 2);
      const ok = await copyText(jsonString);
      showToast(ok ? "已复制层级内容" : "复制失败");
    }
  });

  row.appendChild(twisty);
  row.appendChild(keySpan);
  row.appendChild(colon);
  row.appendChild(valueSpan);
  row.appendChild(typeSpan);
  row.appendChild(copyBtn);

  return { row, twisty, copyBtn };
}

function renderPrimitiveLabel(v) {
  const t = valueType(v);
  if (t === "string") return `<span class="v-str">${escapeHtml(JSON.stringify(v))}</span>`;
  if (t === "number") return `<span class="v-num">${escapeHtml(String(v))}</span>`;
  if (t === "boolean") return `<span class="v-bool">${escapeHtml(String(v))}</span>`;
  if (t === "null") return `<span class="v-null">null</span>`;
  return `<span class="t">${escapeHtml(String(v))}</span>`;
}

function ensureChildrenRendered(nodeValue, pathParts, childrenEl) {
  const t = valueType(nodeValue);
  childrenEl.innerHTML = "";

  if (t === "array") {
    const total = nodeValue.length;
    const key = pathToKey(pathParts);
    const already = state.arrayRenderCount.get(key) || 0;
    const step = 200;
    const next = Math.min(total, already + step);
    state.arrayRenderCount.set(key, next);
    for (let i = 0; i < next; i++) {
      const childPath = pathParts.concat([i]);
      childrenEl.appendChild(renderNode(i, nodeValue[i], childPath));
    }
    if (next < total) {
      const more = document.createElement("div");
      more.className = "row";
      more.style.cursor = "pointer";
      more.style.padding = "6px 0";
      more.innerHTML = `<span class="t">加载更多…</span> <span class="t">(${next}/${total})</span>`;
      more.addEventListener("click", (e) => {
        e.stopPropagation();
        ensureChildrenRendered(nodeValue, pathParts, childrenEl);
      });
      childrenEl.appendChild(more);
    }
    return;
  }

  if (t === "object") {
    let keys = Object.keys(nodeValue);
    if (state.sortKeys) keys = keys.slice().sort((a, b) => a.localeCompare(b));
    for (const k of keys) {
      const childPath = pathParts.concat([k]);
      childrenEl.appendChild(renderNode(k, nodeValue[k], childPath));
    }
  }
}

function renderNode(keyName, value, pathParts) {
  const node = document.createElement("div");
  node.className = "node";

  const expandable = isExpandable(value);
  const expanded = expandable && getExpanded(pathParts);

  const keyLabel = pathParts.length === 0 ? "(root)" : typeof keyName === "number" ? `[${keyName}]` : String(keyName);
  const typeLabel = (() => {
    const t = valueType(value);
    if (t === "array" || t === "object") return `(${summarize(value)})`;
    return "";
  })();
  const valueLabel = expandable ? `<span class="t">${escapeHtml(summarize(value))}</span>` : renderPrimitiveLabel(value);

  const { row, twisty } = makeRow({
    keyLabel,
    valueLabel,
    typeLabel,
    pathParts,
    expandable,
    expanded
  });

  const childrenEl = document.createElement("div");
  childrenEl.className = "children";
  childrenEl.classList.toggle("hidden", !expanded);

  if (expanded) ensureChildrenRendered(value, pathParts, childrenEl);

  if (expandable) {
    const toggle = (e) => {
      e.stopPropagation();
      const isOpen = getExpanded(pathParts);
      toggleExpanded(pathParts, !isOpen);
      rerenderTree({ keepSelection: true });
    };
    twisty.addEventListener("click", toggle);
    row.addEventListener("dblclick", toggle);
  }

  node.appendChild(row);
  node.appendChild(childrenEl);

  const key = pathToKey(pathParts);
  state.nodeIndex.set(key, { row, childrenEl, value, pathParts });

  return node;
}

function rerenderTree({ keepSelection }) {
  const selected = keepSelection ? state.selectedPath : null;
  const expandedBefore = new Set(state.expanded);
  clearTreeIndex();
  state.expanded = expandedBefore;

  els.treeRoot.innerHTML = "";
  const rootPath = [];
  state.expanded.add(pathToKey(rootPath));
  els.treeRoot.appendChild(renderNode("(root)", state.value, rootPath));
  if (selected) setSelectedPath(selected);
}

function collapseAll() {
  state.expanded = new Set([pathToKey([])]);
  rerenderTree({ keepSelection: true });
}

function expandToDepth(maxDepth) {
  const rootPath = [];
  const maxNodes = 5000;
  let expandedCount = 0;

  state.expanded = new Set([pathToKey(rootPath)]);
  const stack = [{ value: state.value, path: rootPath, depth: 0 }];

  while (stack.length) {
    const cur = stack.pop();
    if (!cur) break;
    if (cur.depth >= maxDepth) continue;
    const v = cur.value;
    if (!isExpandable(v)) continue;

    const key = pathToKey(cur.path);
    state.expanded.add(key);
    expandedCount++;
    if (expandedCount > maxNodes) break;

    if (Array.isArray(v)) {
      const lim = Math.min(v.length, 200);
      for (let i = lim - 1; i >= 0; i--) {
        stack.push({ value: v[i], path: cur.path.concat([i]), depth: cur.depth + 1 });
      }
    } else {
      const keys = Object.keys(v);
      for (let i = keys.length - 1; i >= 0; i--) {
        const k = keys[i];
        stack.push({ value: v[k], path: cur.path.concat([k]), depth: cur.depth + 1 });
      }
    }
  }

  rerenderTree({ keepSelection: true });
  if (expandedCount > maxNodes) showToast("数据较大，已限制展开范围");
}

function toggleHighlight() {
  state.highlightAll = !state.highlightAll;

  if (state.highlightAll) {
    // 高亮所有匹配项
    state.highlightedNodes.clear();
    state.search.results.forEach(result => {
      const key = pathToKey(result.path);
      state.highlightedNodes.add(key);
    });
    els.btnHighlightAll.classList.add('active');
    els.btnHighlightAll.title = '取消高亮';
    showToast(`已高亮 ${state.search.results.length} 个匹配项`, "success");
  } else {
    // 取消高亮
    state.highlightedNodes.clear();
    els.btnHighlightAll.classList.remove('active');
    els.btnHighlightAll.title = '高亮所有匹配';
    showToast("已取消高亮", "info");
  }

  // 重新渲染树以应用/移除高亮
  rerenderTree({ keepSelection: true });
}

function updateSearchNavigation() {
  const { results, selectedIndex } = state.search;
  const total = results.length;
  const current = selectedIndex >= 0 && selectedIndex < total ? selectedIndex + 1 : 0;

  els.currentIndex.textContent = current;
  els.totalCount.textContent = total;

  els.btnPrev.disabled = total === 0 || selectedIndex <= 0;
  els.btnNext.disabled = total === 0 || selectedIndex >= total - 1;
}

function renderResults() {
  const { q, results, running, truncated } = state.search;

  if (!q) {
    toggleResults(false);
    els.resultsMeta.textContent = "未搜索";
    els.resultsList.innerHTML = "";
    updateSearchNavigation();
    return;
  }

  // 显示搜索结果面板
  toggleResults(true);

  const suffix = running ? "（搜索中…）" : truncated ? "（已截断）" : "";
  const searchScope = [];
  if (state.search.searchKeys) searchScope.push("Key");
  if (state.search.searchValues) searchScope.push("Value");
  const scopeText = searchScope.length > 0 ? ` [${searchScope.join("+")}]` : "";
  els.resultsMeta.textContent = `关键字：${q}${scopeText}，命中：${results.length}${suffix}`;
  els.resultsList.innerHTML = "";

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const item = document.createElement("div");
    item.className = "result-item";
    item.dataset.index = String(i);

    const path = document.createElement("div");
    path.className = "result-path";
    path.textContent = pathToDisplay(r.path);

    const preview = document.createElement("div");
    preview.className = "result-preview";
    preview.textContent = r.preview;

    item.appendChild(path);
    item.appendChild(preview);
    item.addEventListener("click", () => focusPath(r.path, { selectResultIndex: i }));
    els.resultsList.appendChild(item);
  }

  updateSearchNavigation();
}

function setSearchSelectedIndex(i) {
  const results = state.search.results;
  if (!results.length) {
    state.search.selectedIndex = -1;
    return;
  }
  const idx = ((i % results.length) + results.length) % results.length;
  state.search.selectedIndex = idx;
  focusPath(results[idx].path, { selectResultIndex: idx, scrollResults: true });
}

function focusPath(pathParts, opts = {}) {
  const chain = [];
  for (let i = 0; i <= pathParts.length; i++) chain.push(pathParts.slice(0, i));
  for (const p of chain) state.expanded.add(pathToKey(p));
  rerenderTree({ keepSelection: false });

  setSelectedPath(pathParts);
  const node = state.nodeIndex.get(pathToKey(pathParts));
  node?.row?.scrollIntoView({ block: "center" });

  if (typeof opts.selectResultIndex === "number") {
    const idx = opts.selectResultIndex;
    const item = els.resultsList.querySelector(`.result-item[data-index="${idx}"]`);
    if (opts.scrollResults && item) item.scrollIntoView({ block: "nearest" });
  }
}

function makePreview(key, value) {
  const keyStr = key ? String(key) : "";
  const v = valueType(value);
  const valStr =
    v === "string" ? value :
      v === "number" || v === "boolean" || v === "null" ? String(value) :
        summarize(value);
  const preview = keyStr ? `${keyStr}: ${valStr}` : valStr;
  return preview.length > 180 ? `${preview.slice(0, 180)}…` : preview;
}

function startSearch(q) {
  const query = String(q || "").trim();
  console.log('[ShowMeJson] 开始搜索:', query);
  console.log('[ShowMeJson] 搜索选项:', { searchKeys: state.search.searchKeys, searchValues: state.search.searchValues });
  console.log('[ShowMeJson] 当前数据:', state.value);

  state.search.q = query;
  state.search.running = false;
  state.search.results = [];
  state.search.selectedIndex = -1;
  state.search.truncated = false;
  renderResults();
  if (!query) return;

  const qLower = query.toLowerCase();
  const maxResults = 500;
  const maxNodes = 250000;
  let visited = 0;
  const results = [];

  state.search.running = true;
  renderResults();

  const stack = [{ value: state.value, path: [], key: null }];

  const step = (deadline) => {
    const hasIdle = typeof deadline?.timeRemaining === "function";
    let budget = hasIdle ? Math.max(1, Math.floor(deadline.timeRemaining() / 2)) : 12;
    while (stack.length && budget > 0) {
      const cur = stack.pop();
      if (!cur) break;
      visited++;
      if (visited > maxNodes) {
        state.search.truncated = true;
        stack.length = 0;
        break;
      }

      const { value, path, key } = cur;
      const t = valueType(value);
      const keyMatch = key !== null && String(key).toLowerCase().includes(qLower);
      let valMatch = false;

      if (t === "string") valMatch = value.toLowerCase().includes(qLower);
      else if (t === "number" || t === "boolean" || t === "null") valMatch = String(value).toLowerCase().includes(qLower);

      // 根据搜索选项判断是否匹配
      const shouldInclude =
        (state.search.searchKeys && keyMatch) ||
        (state.search.searchValues && valMatch);

      if (shouldInclude && results.length < maxResults) {
        console.log('[ShowMeJson] 找到匹配:', { key, value, keyMatch, valMatch, shouldInclude });
        results.push({ path, preview: makePreview(key, value) });
      }
      if (results.length >= maxResults) {
        state.search.truncated = true;
        stack.length = 0;
        break;
      }

      if (t === "array") {
        for (let i = value.length - 1; i >= 0; i--) {
          stack.push({ value: value[i], path: path.concat([i]), key: i });
        }
      } else if (t === "object") {
        const keys = Object.keys(value);
        for (let i = keys.length - 1; i >= 0; i--) {
          const k = keys[i];
          stack.push({ value: value[k], path: path.concat([k]), key: k });
        }
      }

      budget--;
    }

    state.search.results = results;
    state.search.running = stack.length > 0;
    renderResults();

    if (stack.length) schedule(step);
    else {
      if (results.length) setSearchSelectedIndex(0);
      else showToast("未找到匹配项");
    }
  };

  const schedule = (fn) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 250 });
    else setTimeout(() => fn(null), 0);
  };

  schedule(step);
}

function bindEvents() {
  // 格式化按钮
  els.btnFormat.addEventListener("click", formatJson);

  // 清空按钮
  els.btnClear.addEventListener("click", clearContent);

  // 粘贴功能 - 立即格式化显示
  els.btnPaste.addEventListener("click", () => {
    showToast("请使用 Ctrl+V 粘贴 JSON 内容", "info", 3000);
  });

  els.rawContent.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    if (text) {
      state.rawText = text;
      state.isRawContentDirty = true;
      // 立即格式化并高亮显示
      updateRawContentHighlight(text);
      // 延迟格式化右侧，确保左侧已经更新
      setTimeout(() => formatJson(), 100);
    }
  });

  // 展开控制按钮
  els.btnExpandAll.addEventListener("click", () => expandToDepth(999));
  els.btnExpand2.addEventListener("click", () => expandToDepth(2));
  els.btnCollapseAll.addEventListener("click", () => collapseAll());

  // 排序开关
  els.toggleSort.addEventListener("change", () => {
    state.sortKeys = !!els.toggleSort.checked;
    rerenderTree({ keepSelection: true });
  });

  // 原始内容输入事件 - 实时更新高亮
  els.rawContent.addEventListener("input", () => {
    const text = els.rawContent.textContent;
    state.rawText = text;
    state.isRawContentDirty = true;
    updateRawContentHighlight(text);
    // 延迟格式化右侧，避免频繁更新
    clearTimeout(els.rawContent.formatTimeout);
    els.rawContent.formatTimeout = setTimeout(() => formatJson(), 500);
  });


  // 设置弹框功能
  els.btnSettings.addEventListener("click", showSettings);
  els.btnCloseSettings.addEventListener("click", hideSettings);

  // 主题选项点击事件
  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const theme = card.getAttribute('data-theme');
      switchTheme(theme);
    });
  });

  function switchTheme(themeName) {
    if (!themeName) return;

    // 更新状态
    state.currentTheme = themeName;

    // 更新 DOM 属性
    document.documentElement.setAttribute('data-theme', themeName);

    // 更新活动状态
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.remove('active');
    });
    document.querySelector(`[data-theme="${themeName}"]`)?.classList.add('active');

    // 保存到本地存储
    localStorage.setItem('showmejson-theme', themeName);

    // 显示提示
    const themeNames = {
      dark: '深色主题',
      light: '浅色主题',
      blue: '蓝色主题',
      green: '绿色主题'
    };
    showToast(`已切换到${themeNames[themeName]}`, "success");
  }

  function loadTheme() {
    const savedTheme = localStorage.getItem('showmejson-theme') || 'dark';
    switchTheme(savedTheme);
  }

  loadTheme();

  // 点击背景关闭设置弹框
  els.settingsModal.addEventListener('click', (e) => {
    if (e.target === els.settingsModal || e.target.classList.contains('modal-backdrop')) {
      hideSettings();
    }
  });

  // ESC 键关闭设置弹框
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.settingsModal.classList.contains('show')) {
      hideSettings();
    }
  });

  // 保存功能
  els.btnSave.addEventListener("click", showSaveDialog);

  // 保存对话框事件
  els.btnConfirmSave.addEventListener("click", confirmSave);
  els.btnCancelSave.addEventListener("click", hideSaveDialog);

  // 按回车确认保存
  els.saveFilename.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmSave();
    }
    if (e.key === "Escape") {
      hideSaveDialog();
    }
  });

  // 点击背景关闭对话框
  els.saveDialog.querySelector('.modal-backdrop').addEventListener("click", hideSaveDialog);


  els.btnCopyRaw.addEventListener("click", async () => {
    const ok = await copyText(state.rawText);
    showToast(ok ? "已复制原始 JSON" : "复制失败");
  });

  els.btnCopyPretty.addEventListener("click", async () => {
    const ok = await copyText(state.prettyText);
    showToast(ok ? "已复制格式化 JSON" : "复制失败");
  });

  // 搜索功能
  els.searchInput.addEventListener("input", (e) => {
    // 实时搜索，使用防抖
    clearTimeout(els.searchInput.searchTimeout);
    els.searchInput.searchTimeout = setTimeout(() => {
      startSearch(els.searchInput.value);
    }, 300);
  });

  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      clearTimeout(els.searchInput.searchTimeout);
      startSearch(els.searchInput.value);
    }
    if (e.key === "Escape") {
      clearTimeout(els.searchInput.searchTimeout);
      els.searchInput.value = "";
      startSearch("");
    }
  });

  // 搜索清空按钮
  els.btnClearSearch.addEventListener("click", () => {
    els.searchInput.value = "";
    els.searchInput.focus();
    startSearch("");
  });

  // 高亮按钮
  els.btnHighlightAll.addEventListener("click", toggleHighlight);

  // 搜索选项事件
  els.searchKeys.addEventListener("change", (e) => {
    state.search.searchKeys = e.target.checked;
    // 如果有搜索词，重新搜索
    if (state.search.q) {
      startSearch(state.search.q);
    }
  });

  els.searchValues.addEventListener("change", (e) => {
    state.search.searchValues = e.target.checked;
    // 如果有搜索词，重新搜索
    if (state.search.q) {
      startSearch(state.search.q);
    }
  });

  // 搜索导航按钮
  els.btnPrev.addEventListener("click", () => {
    setSearchSelectedIndex(state.search.selectedIndex - 1);
  });

  els.btnNext.addEventListener("click", () => {
    setSearchSelectedIndex(state.search.selectedIndex + 1);
  });

  // 全局快捷键支持
  document.addEventListener("keydown", (e) => {
    // Ctrl+S 保存
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      els.btnSave.click();
    }

    // Ctrl+F 聚焦搜索框
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      els.searchInput.focus();
      els.searchInput.select();
    }

    // Escape 清空搜索
    if (e.key === "Escape" && document.activeElement === els.searchInput) {
      els.btnClearSearch.click();
    }
  });

  // 分割线拖拽
  setupPaneDivider();
}

function formatJson() {
  try {
    const text = els.rawContent.textContent || els.rawContent.innerText || "";
    if (!text.trim()) {
      updateStatus("空内容", "warning");
      updateFormatStatus("无数据", "warning");
      return;
    }

    state.rawText = text;
    state.value = JSON.parse(text);
    state.prettyText = JSON.stringify(state.value, null, 2);

    hideError();
    state.isRawContentDirty = false;

    // 更新左侧语法高亮
    updateRawContentHighlight(text);

    // 更新状态
    updateStatus("有效 JSON", "success");
    updateSizeInfo(formatBytes(new Blob([text]).size));
    updateFormatStatus("已格式化", "success");

    // 重新渲染树
    state.expanded.clear();
    state.expanded.add(pathToKey([]));
    rerenderTree({ keepSelection: false });

    showToast("JSON 格式化成功");
  } catch (e) {
    showError(`JSON 解析失败：${String(e?.message || e)}`);
    updateStatus("无效 JSON", "error");
    updateFormatStatus("解析错误", "error");
    els.treeRoot.innerHTML = "";

    // 即使解析失败，也尝试高亮
    updateRawContentHighlight(text);
  }
}

function updateRawContentHighlight(text) {
  if (!text || !text.trim()) {
    els.rawContent.classList.remove('highlighted');
    els.rawContent.textContent = '';
    return;
  }

  try {
    // 尝试解析为 JSON
    const parsed = JSON.parse(text);
    // 格式化并高亮显示
    const formatted = JSON.stringify(parsed, null, 2);
    els.rawContent.classList.add('highlighted');
    els.rawContent.innerHTML = highlightJson(escapeHtml(formatted));
  } catch (e) {
    // 解析失败，显示原始文本但尝试高亮
    els.rawContent.classList.remove('highlighted');
    els.rawContent.textContent = text;
  }
}

function getLeftSelectionPath() {
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  const selectedText = range.toString().trim();
  if (!selectedText) return null;

  // 获取选中的文本在原始 JSON 中的位置
  const rawText = els.rawContent.textContent || "";
  const startIndex = rawText.indexOf(selectedText);
  if (startIndex === -1) return null;

  // 简单的路径检测逻辑
  // 这里需要更复杂的解析来准确定位 JSON 路径
  // 先实现一个基础版本
  return detectJsonPathFromSelection(rawText, selectedText, startIndex);
}

function detectJsonPathFromSelection(rawText, selectedText, startIndex) {
  // 这是一个简化的路径检测，实际需要更复杂的 JSON 解析
  // 先尝试检测是否是键名
  const beforeText = rawText.substring(0, startIndex);
  const afterText = rawText.substring(startIndex + selectedText.length);

  // 检查是否在字符串中
  const beforeQuote = beforeText.lastIndexOf('"');
  const afterQuote = afterText.indexOf('"');

  if (beforeQuote !== -1 && afterQuote !== -1) {
    // 可能是键名或字符串值
    const possibleKey = beforeText.substring(beforeQuote + 1);
    if (possibleKey.includes('":')) {
      // 这是键名
      const keyName = possibleKey.split('":')[0];
      return [keyName];
    }
  }

  // 默认返回 null，表示无法确定路径
  return null;
}

function showSettings() {
  els.settingsModal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function hideSettings() {
  els.settingsModal.classList.remove('show');
  document.body.style.overflow = '';
}

function switchTheme(themeName) {
  if (!themeName) return;

  // 更新状态
  state.currentTheme = themeName;

  // 更新 DOM 属性
  document.documentElement.setAttribute('data-theme', themeName);

  // 更新活动状态
  document.querySelectorAll('.theme-card').forEach(card => {
    card.classList.remove('active');
  });
  document.querySelector(`[data-theme="${themeName}"]`)?.classList.add('active');

  // 保存到本地存储
  localStorage.setItem('showmejson-theme', themeName);

  // 显示提示
  const themeNames = {
    dark: '深色主题',
    light: '浅色主题',
    blue: '蓝色主题',
    green: '绿色主题'
  };
  showToast(`已切换到${themeNames[themeName]}`, "success");
}

function loadTheme() {
  const savedTheme = localStorage.getItem('showmejson-theme') || 'dark';
  switchTheme(savedTheme);
}

function clearContent() {
  els.rawContent.textContent = "";
  els.rawContent.classList.remove('highlighted');
  state.rawText = "";
  state.value = null;
  state.prettyText = "";
  state.isRawContentDirty = false;

  hideError();
  updateStatus("未加载", "info");
  updateSizeInfo("");
  updateFormatStatus("", "info");
  els.treeRoot.innerHTML = "";

  showToast("内容已清空");
}

function setupPaneDivider() {
  let isDragging = false;

  els.paneDivider.addEventListener("mousedown", (e) => {
    isDragging = true;
    els.paneDivider.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const container = document.querySelector(".main-container");
    const containerWidth = container.offsetWidth;
    const newWidth = Math.max(300, Math.min(e.clientX, containerWidth - 400));
    const percentage = (newWidth / containerWidth) * 100;

    if (els.leftPane) {
      els.leftPane.style.flex = `0 0 ${percentage}%`;
    }
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      els.paneDivider.classList.remove("dragging");
      document.body.style.cursor = "";
    }
  });
}

async function init() {
  bindEvents();

  // 加载保存的主题
  loadTheme();

  // 同步搜索选项状态
  state.search.searchKeys = els.searchKeys.checked;
  state.search.searchValues = els.searchValues.checked;

  const { id, mode } = getQueryParams();
  state.mode = mode || "manual";

  // 检查是否有传入的数据
  if (id) {
    try {
      const payload = await getPayload(id);
      if (!payload?.jsonText) {
        showError("数据不存在或已过期");
        return;
      }

      // 填充数据
      const jsonText = String(payload.jsonText);
      els.rawContent.textContent = jsonText;
      state.sourceUrl = payload.sourceUrl || "";
      els.sourceUrl.textContent = state.sourceUrl;

      // 应用语法高亮
      updateRawContentHighlight(jsonText);

      // 自动格式化
      formatJson();
      showToast(state.mode === "selection" ? "已从选中文本格式化" : "已加载 JSON 数据");
    } catch (e) {
      showError(String(e?.message || e));
    }
  } else {
    // 手动模式，显示初始状态
    updateStatus("准备就绪", "info");
    updateFormatStatus("等待输入", "info");

    // 显示使用提示
    setTimeout(() => {
      showToast("提示：使用 Ctrl+V 粘贴 JSON 内容，或通过右键菜单格式化选中文本。插件不会自动检测页面内容。", "info", 5000);
    }, 1000);
  }
}

init();

