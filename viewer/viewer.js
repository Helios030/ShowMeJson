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
  searchResultsPanel: $("#searchResultsPanel"),
  resultsDivider: $("#resultsDivider"),
  btnCopyPath: $("#btnCopyPath"),
  btnFetchUrl: $("#btnFetchUrl"),
  fetchDialog: $("#fetchDialog"),
  fetchUrl: $("#fetchUrl"),
  btnCloseFetch: $("#btnCloseFetch"),
  btnCancelFetch: $("#btnCancelFetch"),
  btnConfirmFetch: $("#btnConfirmFetch"),
  btnConvert: $("#btnConvert"),
  convertDialog: $("#convertDialog"),
  convertFormats: $("#convertFormats"),
  convertOutput: $("#convertOutput"),
  btnCloseConvert: $("#btnCloseConvert"),
  btnCopyConvert: $("#btnCopyConvert"),
  btnDownloadConvert: $("#btnDownloadConvert"),
  btnDiff: $("#btnDiff"),
  diffDialog: $("#diffDialog"),
  diffA: $("#diffA"),
  diffB: $("#diffB"),
  diffResult: $("#diffResult"),
  diffSummary: $("#diffSummary"),
  btnRunDiff: $("#btnRunDiff"),
  btnCloseDiff: $("#btnCloseDiff"),
  btnHistory: $("#btnHistory"),
  historyDialog: $("#historyDialog"),
  historyList: $("#historyList"),
  historySummary: $("#historySummary"),
  btnCloseHistory: $("#btnCloseHistory"),
  btnClearHistory: $("#btnClearHistory"),
  btnMore: $("#btnMore"),
  moreMenu: $("#moreMenu")
};

// 历史记录配置：最多保留 20 条；单条超过 1MB 不入库（保证可重新载入）
const HISTORY_KEY = "showmejson_history";
const HISTORY_MAX = 20;
const HISTORY_ITEM_MAX_BYTES = 1024 * 1024;

// 用户偏好持久化（与主题一致，统一走 localStorage）
const PREFS_KEY = "showmejson-prefs";
const THEME_NAMES = Object.freeze({
  dark: "暗夜蓝",
  light: "雾白",
  blue: "海盐蓝",
  green: "森林绿",
  purple: "暮光紫",
  sunset: "日落橙"
});

const prefs = (function loadPrefs() {
  try {
    return Object.assign({}, JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"));
  } catch (_) {
    return {};
  }
})();

function savePrefs(patch) {
  Object.assign(prefs, patch);
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (_) {}
}

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
  currentTheme: "dark",
  parsedStringPaths: new Set(),
  convertFormat: "yaml"
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
  if (els.resultsDivider) {
    els.resultsDivider.classList.toggle("show", show);
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

function jsonHighlight(text) {
  const t = String(text || "");
  if (t.length > 2 * 1024 * 1024) return escapeHtml(t);
  const tokenPattern = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?=\s*:)|"(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|[{}\[\],:])/g;
  let html = "";
  let lastIndex = 0;
  let match;

  while ((match = tokenPattern.exec(t)) !== null) {
    const token = match[0];
    html += escapeHtml(t.slice(lastIndex, match.index));

    if (token.startsWith('"')) {
      const isKey = t.slice(tokenPattern.lastIndex).trimStart().startsWith(":");
      html += `<span class="${isKey ? "k" : "v-str"}">${escapeHtml(token)}</span>`;
    } else if (token === "true" || token === "false") {
      html += `<span class="v-bool">${token}</span>`;
    } else if (token === "null") {
      html += `<span class="v-null">${token}</span>`;
    } else if (/^-?\d/.test(token)) {
      html += `<span class="v-num">${escapeHtml(token)}</span>`;
    } else {
      html += `<span class="json-punctuation">${escapeHtml(token)}</span>`;
    }

    lastIndex = tokenPattern.lastIndex;
  }

  html += escapeHtml(t.slice(lastIndex));
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
  const res = await chrome.runtime.sendMessage({ type: "JSONFMT_VIEWER_GET_PAYLOAD", id });
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

  if (els.btnCopyPath) els.btnCopyPath.disabled = !pathParts;
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

  // 复制按钮点击事件：优先用渲染时记录的有效值（兼容内嵌 JSON 解析）
  copyBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const k = pathToKey(pathParts);
    const node = state.nodeIndex.get(k);
    const jsonValue = node ? node.value : getNodeValue(pathParts);
    const jsonString = JSON.stringify(jsonValue, null, 2);
    const ok = await copyText(jsonString);
    showToast(ok ? "已复制层级内容" : "复制失败");
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

  const key = pathToKey(pathParts);

  // 内嵌 JSON 字符串：可解析时支持「就地展开为对象/数组」
  const canParseString =
    typeof value === "string" && window.JsonTools.tryParseJsonString(value) !== null;
  const isParsedString = canParseString && state.parsedStringPaths.has(key);
  const effectiveValue = isParsedString ? window.JsonTools.tryParseJsonString(value) : value;

  const expandable = isExpandable(effectiveValue);
  const expanded = expandable && getExpanded(pathParts);

  const keyLabel = pathParts.length === 0 ? "(root)" : typeof keyName === "number" ? `[${keyName}]` : String(keyName);
  const typeLabel = (() => {
    const t = valueType(effectiveValue);
    if (t === "array" || t === "object") return `(${summarize(effectiveValue)})`;
    return "";
  })();
  const valueLabel = expandable
    ? `<span class="t">${escapeHtml(summarize(effectiveValue))}</span>`
    : renderPrimitiveLabel(effectiveValue);

  const { row, twisty } = makeRow({
    keyLabel,
    valueLabel,
    typeLabel,
    pathParts,
    expandable,
    expanded
  });

  // 内嵌 JSON 解析开关
  if (canParseString) {
    const parseBtn = document.createElement("button");
    parseBtn.className = "json-expand-btn" + (isParsedString ? " active" : "");
    parseBtn.textContent = isParsedString ? "{} 已解析" : "{} 解析";
    parseBtn.title = "把这段 JSON 字符串解析为对象/数组";
    parseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.parsedStringPaths.has(key)) {
        state.parsedStringPaths.delete(key);
        state.expanded.delete(key);
      } else {
        state.parsedStringPaths.add(key);
        state.expanded.add(key);
      }
      rerenderTree({ keepSelection: true });
    });
    row.appendChild(parseBtn);
  }

  const childrenEl = document.createElement("div");
  childrenEl.className = "children";
  childrenEl.classList.toggle("hidden", !expanded);

  if (expanded) ensureChildrenRendered(effectiveValue, pathParts, childrenEl);

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

  state.nodeIndex.set(key, { row, childrenEl, value: effectiveValue, pathParts });

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
    savePrefs({ sortKeys: state.sortKeys });
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

  // 复制选中节点路径
  els.btnCopyPath.addEventListener("click", async () => {
    if (!state.selectedPath) {
      showToast("请先在树中选择一个节点", "info");
      return;
    }
    const ok = await copyText(pathToDisplay(state.selectedPath));
    showToast(ok ? "已复制路径" : "复制失败");
  });

  // 从 URL 拉取
  els.btnFetchUrl.addEventListener("click", showFetchDialog);
  els.btnCloseFetch.addEventListener("click", () => closeModal(els.fetchDialog));
  els.btnCancelFetch.addEventListener("click", () => closeModal(els.fetchDialog));
  els.btnConfirmFetch.addEventListener("click", confirmFetch);
  els.fetchDialog.querySelector(".modal-backdrop").addEventListener("click", () => closeModal(els.fetchDialog));
  els.fetchUrl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmFetch();
    if (e.key === "Escape") closeModal(els.fetchDialog);
  });

  // 转换 / 导出
  els.btnConvert.addEventListener("click", showConvertDialog);
  els.btnCloseConvert.addEventListener("click", () => closeModal(els.convertDialog));
  els.convertDialog.querySelector(".modal-backdrop").addEventListener("click", () => closeModal(els.convertDialog));
  els.convertFormats.querySelectorAll(".segment-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.convertFormats.querySelectorAll(".segment-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.convertFormat = btn.dataset.format;
      renderConvert();
    });
  });
  els.btnCopyConvert.addEventListener("click", async () => {
    const ok = await copyText(els.convertOutput.textContent);
    showToast(ok ? "已复制" : "复制失败");
  });
  els.btnDownloadConvert.addEventListener("click", downloadConvert);

  // JSON 对比
  els.btnDiff.addEventListener("click", showDiffDialog);
  els.btnCloseDiff.addEventListener("click", () => closeModal(els.diffDialog));
  els.diffDialog.querySelector(".modal-backdrop").addEventListener("click", () => closeModal(els.diffDialog));
  els.btnRunDiff.addEventListener("click", runDiff);

  // 历史记录
  els.btnHistory.addEventListener("click", showHistoryDialog);
  els.btnCloseHistory.addEventListener("click", () => closeModal(els.historyDialog));
  els.historyDialog.querySelector(".modal-backdrop").addEventListener("click", () => closeModal(els.historyDialog));
  els.btnClearHistory.addEventListener("click", clearHistory);

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
    savePrefs({ searchKeys: state.search.searchKeys });
    // 如果有搜索词，重新搜索
    if (state.search.q) {
      startSearch(state.search.q);
    }
  });

  els.searchValues.addEventListener("change", (e) => {
    state.search.searchValues = e.target.checked;
    savePrefs({ searchValues: state.search.searchValues });
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

    // Escape 关闭打开的弹窗与下拉菜单
    if (e.key === "Escape") {
      [els.fetchDialog, els.convertDialog, els.diffDialog, els.historyDialog].forEach((m) => {
        if (m && !m.classList.contains("hidden")) closeModal(m);
      });
      if (els.moreMenu && !els.moreMenu.classList.contains("hidden")) toggleMoreMenu(false);
    }
  });

  // 分割线拖拽
  setupPaneDivider();
  setupResultsDivider();

  // 拖拽 .json 文件打开
  setupDragDrop();

  // 更多功能菜单 + 即时悬停提示
  setupMoreMenu();
  setupTooltips();
}

function formatJson() {
  const text = els.rawContent.textContent || els.rawContent.innerText || "";
  try {
    if (!text.trim()) {
      updateStatus("空内容", "warning");
      updateFormatStatus("无数据", "warning");
      return;
    }

    const parsed = window.JsonTools.looseParseJson(text);

    state.rawText = text;
    state.value = parsed.value;
    state.prettyText = JSON.stringify(state.value, null, 2);
    state.parsedStringPaths.clear();

    hideError();
    state.isRawContentDirty = false;

    // 更新左侧语法高亮
    updateRawContentHighlight(text);

    // 更新状态
    updateStatus(parsed.repaired ? "已自动修复" : "有效 JSON", parsed.repaired ? "warning" : "success");
    updateSizeInfo(formatBytes(new Blob([text]).size));
    updateFormatStatus("已格式化", "success");

    // 重新渲染树
    state.expanded.clear();
    state.expanded.add(pathToKey([]));
    rerenderTree({ keepSelection: false });

    if (parsed.repaired && parsed.repairs && parsed.repairs.length) {
      showToast(`已自动修复：${parsed.repairs.join("、")}`, "warning", 2600);
    } else {
      showToast("JSON 格式化成功");
    }

    // 记录历史（防抖，避免编辑过程频繁写入）
    scheduleHistory(state.prettyText, state.sourceUrl);
  } catch (e) {
    const loc = window.JsonTools.locateJsonError(text, e);
    const where = loc.line > 0 ? `（第 ${loc.line} 行，第 ${loc.column} 列）` : "";
    showError(`JSON 解析失败${where}：${loc.message}`);
    updateStatus("无效 JSON", "error");
    updateFormatStatus(loc.line > 0 ? `第 ${loc.line} 行出错` : "解析错误", "error");
    els.treeRoot.innerHTML = "";
    showRawError(text, loc);
  }
}

// 解析失败时在左侧定位并高亮出错的那一行
function showRawError(text, loc) {
  if (!loc || loc.line < 1) {
    els.rawContent.classList.remove("highlighted");
    els.rawContent.textContent = text;
    return;
  }
  const lines = text.split("\n");
  els.rawContent.classList.remove("highlighted");
  els.rawContent.innerHTML = lines
    .map((line, idx) => {
      const safe = escapeHtml(line) || "&nbsp;";
      return idx + 1 === loc.line ? `<span class="error-line">${safe}</span>` : safe;
    })
    .join("\n");
  const marker = els.rawContent.querySelector(".error-line");
  marker?.scrollIntoView({ block: "center" });
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
    els.rawContent.innerHTML = jsonHighlight(formatted);
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
  const nextTheme = Object.hasOwn(THEME_NAMES, themeName) ? themeName : "dark";

  // 更新状态
  state.currentTheme = nextTheme;

  // 更新 DOM 属性
  document.documentElement.setAttribute('data-theme', nextTheme);

  // 更新活动状态
  document.querySelectorAll('.theme-card').forEach(card => {
    card.classList.remove('active');
  });
  document.querySelector(`.theme-card[data-theme="${nextTheme}"]`)?.classList.add('active');

  // 保存到本地存储
  localStorage.setItem('showmejson-theme', nextTheme);

  // 显示提示
  showToast(`已切换到${THEME_NAMES[nextTheme]}`, "success");
}

function loadTheme() {
  const savedTheme = localStorage.getItem('showmejson-theme') || 'dark';
  switchTheme(savedTheme);
}

// 用文本加载并格式化（供拉取/拖拽/粘贴复用）
function loadJsonText(text, sourceLabel) {
  els.rawContent.textContent = String(text || "");
  state.rawText = String(text || "");
  state.isRawContentDirty = true;
  if (sourceLabel) {
    state.sourceUrl = sourceLabel;
    els.sourceUrl.textContent = sourceLabel;
  }
  formatJson();
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

// ---- 从 URL 拉取 ----
function showFetchDialog() {
  els.fetchUrl.value = "";
  openModal(els.fetchDialog);
  setTimeout(() => els.fetchUrl.focus(), 100);
}

async function confirmFetch() {
  const url = els.fetchUrl.value.trim();
  if (!url) {
    showToast("请输入 URL", "error");
    return;
  }
  showToast("正在拉取…", "info", 4000);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    closeModal(els.fetchDialog);
    loadJsonText(text, url);
  } catch (e) {
    showToast(`拉取失败：${String(e?.message || e)}`, "error", 3000);
  }
}

// ---- 转换 / 导出 ----
function renderConvert() {
  if (!state.value && state.value !== 0) {
    els.convertOutput.textContent = "暂无可转换的 JSON";
    return;
  }
  let out = "";
  try {
    if (state.convertFormat === "yaml") out = window.JsonTools.toYaml(state.value);
    else if (state.convertFormat === "csv") out = window.JsonTools.toCsv(state.value);
    else out = window.JsonTools.toTypeScript(state.value, "Root");
  } catch (e) {
    out = `转换失败：${String(e?.message || e)}`;
  }
  els.convertOutput.textContent = out;
}

function showConvertDialog() {
  if (!state.value && state.value !== 0) {
    showToast("请先格式化有效的 JSON", "error");
    return;
  }
  renderConvert();
  openModal(els.convertDialog);
}

function downloadConvert() {
  const ext = state.convertFormat === "ts" ? "ts" : state.convertFormat;
  const mime =
    state.convertFormat === "csv" ? "text/csv" : state.convertFormat === "ts" ? "text/plain" : "text/yaml";
  const blob = new Blob([els.convertOutput.textContent || ""], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `export.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- JSON 对比 ----
function showDiffDialog() {
  els.diffA.value = state.prettyText || "";
  els.diffB.value = "";
  els.diffResult.innerHTML = "";
  els.diffSummary.textContent = "";
  openModal(els.diffDialog);
  setTimeout(() => els.diffB.focus(), 100);
}

function diffValueText(v) {
  if (v === undefined) return "—";
  const s = JSON.stringify(v);
  return s && s.length > 120 ? s.slice(0, 120) + "…" : s;
}

function runDiff() {
  let a;
  let b;
  try {
    a = window.JsonTools.looseParseJson(els.diffA.value).value;
  } catch (e) {
    showToast("A 解析失败：" + String(e?.message || e), "error", 3000);
    return;
  }
  try {
    b = window.JsonTools.looseParseJson(els.diffB.value).value;
  } catch (e) {
    showToast("B 解析失败：" + String(e?.message || e), "error", 3000);
    return;
  }

  const diffs = window.JsonTools.jsonDiff(a, b);
  els.diffResult.innerHTML = "";

  if (!diffs.length) {
    els.diffResult.innerHTML = `<div class="diff-empty">两段 JSON 完全一致</div>`;
    els.diffSummary.textContent = "无差异";
    return;
  }

  const tagText = { added: "新增", removed: "删除", changed: "修改" };
  const counts = { added: 0, removed: 0, changed: 0 };

  for (const d of diffs) {
    counts[d.type]++;
    const row = document.createElement("div");
    row.className = `diff-row ${d.type}`;

    const tag = document.createElement("span");
    tag.className = "diff-tag";
    tag.textContent = tagText[d.type];

    const path = document.createElement("span");
    path.className = "diff-path";
    path.textContent = pathToDisplay(d.path);

    const vals = document.createElement("span");
    vals.className = "diff-vals";
    if (d.type === "changed") vals.textContent = `${diffValueText(d.a)} → ${diffValueText(d.b)}`;
    else if (d.type === "added") vals.textContent = diffValueText(d.b);
    else vals.textContent = diffValueText(d.a);

    row.appendChild(tag);
    row.appendChild(path);
    row.appendChild(vals);
    els.diffResult.appendChild(row);
  }

  els.diffSummary.textContent = `新增 ${counts.added} · 删除 ${counts.removed} · 修改 ${counts.changed}`;
}

// ---- 拖拽 .json 文件打开 ----
function setupDragDrop() {
  ["dragenter", "dragover"].forEach((ev) =>
    document.addEventListener(ev, (e) => {
      e.preventDefault();
    })
  );
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadJsonText(String(reader.result || ""), file.name);
    reader.readAsText(file);
  });
}

// ---- 历史记录 ----
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

function getHistory() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(HISTORY_KEY, (data) => {
        resolve(Array.isArray(data?.[HISTORY_KEY]) ? data[HISTORY_KEY] : []);
      });
    } catch (_) {
      resolve([]);
    }
  });
}

function setHistory(list) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [HISTORY_KEY]: list }, () => resolve());
    } catch (_) {
      resolve();
    }
  });
}

async function recordHistory(jsonText, sourceUrl) {
  const text = String(jsonText || "");
  if (!text.trim()) return;
  const bytes = new Blob([text]).size;
  if (bytes > HISTORY_ITEM_MAX_BYTES) return; // 过大不入库，保证可重新载入

  const hash = hashString(text);
  const list = await getHistory();
  if (list[0] && list[0].hash === hash) return; // 与最近一条相同则跳过

  const filtered = list.filter((it) => it.hash !== hash);
  filtered.unshift({
    id: `${Date.now()}_${hash}`,
    hash,
    ts: Date.now(),
    sourceUrl: sourceUrl || state.sourceUrl || "",
    size: bytes,
    preview: text.replace(/\s+/g, " ").trim().slice(0, 160),
    jsonText: text
  });
  await setHistory(filtered.slice(0, HISTORY_MAX));
}

function scheduleHistory(jsonText, sourceUrl) {
  clearTimeout(scheduleHistory._t);
  scheduleHistory._t = setTimeout(() => recordHistory(jsonText, sourceUrl), 1500);
}

function formatHistoryTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function renderHistory() {
  const list = await getHistory();
  els.historyList.innerHTML = "";

  if (!list.length) {
    els.historyList.innerHTML = `<div class="history-empty">暂无历史记录</div>`;
    els.historySummary.textContent = "";
    return;
  }

  els.historySummary.textContent = `共 ${list.length} 条`;

  for (const item of list) {
    const row = document.createElement("div");
    row.className = "history-item";

    const main = document.createElement("div");
    main.className = "history-main";

    const preview = document.createElement("div");
    preview.className = "history-preview";
    preview.textContent = item.preview || "(空)";

    const meta = document.createElement("div");
    meta.className = "history-meta";
    const time = document.createElement("span");
    time.textContent = formatHistoryTime(item.ts);
    const size = document.createElement("span");
    size.textContent = formatBytes(item.size || 0);
    meta.appendChild(time);
    meta.appendChild(size);
    if (item.sourceUrl) {
      const src = document.createElement("span");
      src.className = "history-source";
      src.textContent = item.sourceUrl;
      meta.appendChild(src);
    }

    main.appendChild(preview);
    main.appendChild(meta);

    const del = document.createElement("button");
    del.className = "history-del";
    del.textContent = "✕";
    del.title = "删除此条";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteHistoryItem(item.id);
    });

    row.appendChild(main);
    row.appendChild(del);
    row.addEventListener("click", () => {
      closeModal(els.historyDialog);
      loadJsonText(item.jsonText, item.sourceUrl);
      showToast("已载入历史记录");
    });

    els.historyList.appendChild(row);
  }
}

async function deleteHistoryItem(id) {
  const list = await getHistory();
  await setHistory(list.filter((it) => it.id !== id));
  renderHistory();
}

async function clearHistory() {
  await setHistory([]);
  renderHistory();
  showToast("历史已清空");
}

function showHistoryDialog() {
  openModal(els.historyDialog);
  renderHistory();
}

// ---- 更多功能下拉菜单 ----
function toggleMoreMenu(show) {
  const willShow = typeof show === "boolean" ? show : els.moreMenu.classList.contains("hidden");
  els.moreMenu.classList.toggle("hidden", !willShow);
}

function setupMoreMenu() {
  els.btnMore.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMoreMenu();
  });

  // 点击菜单项后收起
  els.moreMenu.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => toggleMoreMenu(false));
  });

  // 点击外部收起
  document.addEventListener("click", (e) => {
    if (els.moreMenu.classList.contains("hidden")) return;
    if (!els.moreMenu.contains(e.target) && !els.btnMore.contains(e.target)) {
      toggleMoreMenu(false);
    }
  });
}

// ---- 即时悬停提示（替代原生 title 的延迟）----
function setupTooltips() {
  const tip = document.createElement("div");
  tip.className = "app-tooltip hidden";
  document.body.appendChild(tip);

  // 把工具栏按钮的 title 转为 data-tip，避免与原生提示重复
  document.querySelectorAll(".topbar [title]").forEach((el) => {
    el.dataset.tip = el.getAttribute("title");
    el.removeAttribute("title");
  });

  let current = null;

  const show = (el) => {
    current = el;
    tip.textContent = el.dataset.tip;
    tip.classList.remove("hidden");
    const r = el.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(6, Math.min(left, window.innerWidth - tr.width - 6));
    tip.style.left = `${left}px`;
    tip.style.top = `${r.bottom + 6}px`;
  };

  const hide = () => {
    current = null;
    tip.classList.add("hidden");
  };

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el && el !== current) show(el);
  });

  document.addEventListener("mouseout", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) hide();
  });

  // 滚动或点击时隐藏，避免残留
  document.addEventListener("scroll", hide, true);
  document.addEventListener("click", hide, true);
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
      if (els.leftPane?.style.flex) savePrefs({ leftPaneFlex: els.leftPane.style.flex });
    }
  });
}

function setupResultsDivider() {
  if (!els.resultsDivider || !els.searchResultsPanel) return;
  let isDragging = false;

  els.resultsDivider.addEventListener("mousedown", (e) => {
    isDragging = true;
    els.resultsDivider.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const container = document.querySelector(".main-container");
    const rect = container.getBoundingClientRect();
    // 面板靠右，宽度 = 容器右边缘到鼠标的距离；左侧至少给格式化视图留 400px
    const newWidth = Math.max(240, Math.min(rect.right - e.clientX, rect.width - 400));
    els.searchResultsPanel.style.flex = `0 0 ${newWidth}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      els.resultsDivider.classList.remove("dragging");
      document.body.style.cursor = "";
      if (els.searchResultsPanel?.style.flex) savePrefs({ resultsPanelFlex: els.searchResultsPanel.style.flex });
    }
  });
}

async function init() {
  bindEvents();

  // 加载保存的主题
  loadTheme();

  // 应用持久化偏好
  if (typeof prefs.sortKeys === "boolean") {
    state.sortKeys = prefs.sortKeys;
    els.toggleSort.checked = prefs.sortKeys;
  }
  if (typeof prefs.searchKeys === "boolean") els.searchKeys.checked = prefs.searchKeys;
  if (typeof prefs.searchValues === "boolean") els.searchValues.checked = prefs.searchValues;
  if (prefs.leftPaneFlex && els.leftPane) els.leftPane.style.flex = prefs.leftPaneFlex;
  if (prefs.resultsPanelFlex && els.searchResultsPanel) els.searchResultsPanel.style.flex = prefs.resultsPanelFlex;

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
