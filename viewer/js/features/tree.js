import { els } from "../core/dom.js";
import { state } from "../core/state.js";
import { copyText, escapeHtml, isExpandable, pathToDisplay, pathToKey, summarize, valueType } from "../core/utils.js";
import { setTreeViewState, showToast } from "../core/ui.js";

function getNodeValue(pathParts) {
  if (!pathParts || pathParts.length === 0) return state.value;
  let current = state.value;
  for (const part of pathParts) {
    if (current === null || current === undefined) return null;
    if (Array.isArray(current)) {
      if (typeof part === "number" && part >= 0 && part < current.length) current = current[part];
      else return null;
    } else if (typeof current === "object") {
      if (typeof part === "string" && part in current) current = current[part];
      else return null;
    } else return null;
  }
  return current;
}

export function setSelectedPath(pathParts) {
  state.selectedPath = pathParts;
  const key = pathParts ? pathToKey(pathParts) : "";
  els.treeRoot.querySelectorAll(".row").forEach((row) => {
    row.classList.remove("selected");
    row.setAttribute("aria-selected", "false");
  });

  if (state.selectedPath) {
    const selectedRow = els.treeRoot.querySelector(`[data-key="${key}"]`);
    if (selectedRow) {
      selectedRow.classList.add("selected");
      selectedRow.setAttribute("aria-selected", "true");
    }
  }

  els.selectedPath.textContent = pathParts ? pathToDisplay(pathParts) : "未选择节点";
  els.btnCopyPath.disabled = !pathParts;
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
  row.tabIndex = 0;
  row.setAttribute("role", "treeitem");
  row.setAttribute("aria-selected", "false");

  const key = pathToKey(pathParts);
  row.dataset.key = key;
  if (state.highlightedNodes.has(key)) row.classList.add("highlight");

  const { selectedIndex, results } = state.search;
  if (selectedIndex >= 0 && selectedIndex < results.length) {
    const selectedKey = pathToKey(results[selectedIndex].path);
    if (key === selectedKey) row.classList.add("highlight", "active");
  }

  row.addEventListener("click", () => setSelectedPath(pathParts));
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedPath(pathParts);
    }
  });

  const twisty = document.createElement("button");
  twisty.type = "button";
  twisty.tabIndex = -1;
  twisty.className = "twisty";
  if (!expandable) twisty.classList.add("empty");
  twisty.textContent = expanded ? "−" : "+";
  twisty.setAttribute("aria-label", expanded ? "折叠节点" : "展开节点");
  if (expandable) twisty.setAttribute("aria-expanded", String(expanded));

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

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "copy-btn";
  copyBtn.title = "复制此节点内容";
  copyBtn.setAttribute("aria-label", `复制 ${keyLabel} 节点内容`);
  copyBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1M8 5a2 2 0 0 0 2 2h2a2 2 0 0 0-2-2M8 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 0h2a2 2 0 0 1 2 2v3m2 4H10m0 0l3-3m-3 3l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  copyBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    const node = state.nodeIndex.get(key);
    const jsonValue = node ? node.value : getNodeValue(pathParts);
    const ok = await copyText(JSON.stringify(jsonValue, null, 2));
    showToast(ok ? "已复制节点内容" : "复制失败", ok ? "success" : "error");
  });

  row.append(twisty, keySpan, colon, valueSpan, typeSpan, copyBtn);
  return { row, twisty };
}

function renderPrimitiveLabel(value) {
  const type = valueType(value);
  if (type === "string") return `<span class="v-str">${escapeHtml(JSON.stringify(value))}</span>`;
  if (type === "number") return `<span class="v-num">${escapeHtml(String(value))}</span>`;
  if (type === "boolean") return `<span class="v-bool">${escapeHtml(String(value))}</span>`;
  if (type === "null") return `<span class="v-null">null</span>`;
  return `<span class="t">${escapeHtml(String(value))}</span>`;
}

function ensureChildrenRendered(nodeValue, pathParts, childrenEl) {
  const type = valueType(nodeValue);
  childrenEl.innerHTML = "";

  if (type === "array") {
    const total = nodeValue.length;
    const key = pathToKey(pathParts);
    const already = state.arrayRenderCount.get(key) || 0;
    const next = Math.min(total, already + 200);
    state.arrayRenderCount.set(key, next);
    for (let index = 0; index < next; index++) {
      childrenEl.appendChild(renderNode(index, nodeValue[index], pathParts.concat(index)));
    }
    if (next < total) {
      const more = document.createElement("div");
      more.className = "row";
      more.style.cursor = "pointer";
      more.style.padding = "6px 0";
      more.innerHTML = `<span class="t">加载更多…</span> <span class="t">(${next}/${total})</span>`;
      more.addEventListener("click", (event) => {
        event.stopPropagation();
        ensureChildrenRendered(nodeValue, pathParts, childrenEl);
      });
      childrenEl.appendChild(more);
    }
    return;
  }

  if (type === "object") {
    let keys = Object.keys(nodeValue);
    if (state.sortKeys) keys = keys.slice().sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      childrenEl.appendChild(renderNode(key, nodeValue[key], pathParts.concat(key)));
    }
  }
}

function renderNode(keyName, value, pathParts) {
  const node = document.createElement("div");
  node.className = "node";
  const key = pathToKey(pathParts);
  const canParseString = typeof value === "string" && window.JsonTools.tryParseJsonString(value) !== null;
  const isParsedString = canParseString && state.parsedStringPaths.has(key);
  const effectiveValue = isParsedString ? window.JsonTools.tryParseJsonString(value) : value;
  const expandable = isExpandable(effectiveValue);
  const expanded = expandable && getExpanded(pathParts);
  const keyLabel = pathParts.length === 0 ? "(root)" : typeof keyName === "number" ? `[${keyName}]` : String(keyName);
  const valueLabel = expandable
    ? `<span class="t">${escapeHtml(summarize(effectiveValue))}</span>`
    : renderPrimitiveLabel(effectiveValue);

  const { row, twisty } = makeRow({ keyLabel, valueLabel, typeLabel: "", pathParts, expandable, expanded });

  if (canParseString) {
    const parseBtn = document.createElement("button");
    parseBtn.className = "json-expand-btn" + (isParsedString ? " active" : "");
    parseBtn.textContent = isParsedString ? "{} 已解析" : "{} 解析";
    parseBtn.title = "把这段 JSON 字符串解析为对象/数组";
    parseBtn.addEventListener("click", (event) => {
      event.stopPropagation();
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
    const toggle = (event) => {
      event.stopPropagation();
      const shouldRestoreFocus = event.type === "keydown" || document.activeElement === twisty;
      toggleExpanded(pathParts, !getExpanded(pathParts));
      rerenderTree({ keepSelection: true });
      if (shouldRestoreFocus) state.nodeIndex.get(key)?.row?.focus();
    };
    twisty.addEventListener("click", toggle);
    row.addEventListener("dblclick", toggle);
    row.addEventListener("keydown", (event) => {
      const isOpen = getExpanded(pathParts);
      if ((event.key === "ArrowRight" && !isOpen) || (event.key === "ArrowLeft" && isOpen)) {
        event.preventDefault();
        toggle(event);
      }
    });
  }

  node.append(row, childrenEl);
  state.nodeIndex.set(key, { row, childrenEl, value: effectiveValue, pathParts });
  return node;
}

export function rerenderTree({ keepSelection }) {
  const selected = keepSelection ? state.selectedPath : null;
  const expandedBefore = new Set(state.expanded);
  clearTreeIndex();
  state.expanded = expandedBefore;
  els.treeRoot.innerHTML = "";
  state.expanded.add(pathToKey([]));
  els.treeRoot.appendChild(renderNode("(root)", state.value, []));
  if (selected) setSelectedPath(selected);
  setTreeViewState("ready");
}

export function collapseAll() {
  state.expanded = new Set([pathToKey([])]);
  rerenderTree({ keepSelection: true });
}

export function expandToDepth(maxDepth) {
  const maxNodes = 5000;
  let expandedCount = 0;
  state.expanded = new Set([pathToKey([])]);
  const stack = [{ value: state.value, path: [], depth: 0 }];

  while (stack.length) {
    const current = stack.pop();
    if (!current || current.depth >= maxDepth || !isExpandable(current.value)) continue;
    const key = pathToKey(current.path);
    state.expanded.add(key);
    expandedCount++;
    if (expandedCount > maxNodes) break;

    if (Array.isArray(current.value)) {
      const limit = Math.min(current.value.length, 200);
      for (let index = limit - 1; index >= 0; index--) {
        stack.push({ value: current.value[index], path: current.path.concat(index), depth: current.depth + 1 });
      }
    } else {
      const keys = Object.keys(current.value);
      for (let index = keys.length - 1; index >= 0; index--) {
        const keyName = keys[index];
        stack.push({ value: current.value[keyName], path: current.path.concat(keyName), depth: current.depth + 1 });
      }
    }
  }

  rerenderTree({ keepSelection: true });
  if (expandedCount > maxNodes) showToast("数据较大，已限制展开范围");
}
