import { els } from "../core/dom.js";
import { state, workspacePanels } from "../core/state.js";
import { pathToDisplay, pathToKey, summarize, valueType } from "../core/utils.js";
import { setMobilePane, setPanelVisible, showToast, toggleResults } from "../core/ui.js";
import { rerenderTree, setSelectedPath } from "./tree.js";

export function toggleHighlight() {
  state.highlightAll = !state.highlightAll;
  els.btnHighlightAll.setAttribute("aria-pressed", String(state.highlightAll));

  if (state.highlightAll) {
    state.highlightedNodes.clear();
    state.search.results.forEach((result) => state.highlightedNodes.add(pathToKey(result.path)));
    els.btnHighlightAll.classList.add("active");
    els.btnHighlightAll.title = "取消高亮";
    showToast(`已高亮 ${state.search.results.length} 个匹配项`, "success");
  } else {
    state.highlightedNodes.clear();
    els.btnHighlightAll.classList.remove("active");
    els.btnHighlightAll.title = "高亮所有匹配";
    showToast("已取消高亮", "info");
  }
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
    els.resultsMeta.textContent = "输入关键词开始搜索";
    els.resultsList.innerHTML = "";
    updateSearchNavigation();
    return;
  }

  toggleResults(true, { persist: false });
  const suffix = running ? "（搜索中…）" : truncated ? "（已截断）" : "";
  const searchScope = [];
  if (state.search.searchKeys) searchScope.push("Key");
  if (state.search.searchValues) searchScope.push("Value");
  const scopeText = searchScope.length > 0 ? ` [${searchScope.join("+")}]` : "";
  els.resultsMeta.textContent = `关键字：${q}${scopeText}，命中：${results.length}${suffix}`;
  els.resultsList.innerHTML = "";

  results.forEach((result, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "result-item";
    item.dataset.index = String(index);
    const path = document.createElement("div");
    path.className = "result-path";
    path.textContent = pathToDisplay(result.path);
    const preview = document.createElement("div");
    preview.className = "result-preview";
    preview.textContent = result.preview;
    item.append(path, preview);
    item.addEventListener("click", () => focusPath(result.path, { selectResultIndex: index }));
    els.resultsList.appendChild(item);
  });
  updateSearchNavigation();
}

export function setSearchSelectedIndex(index) {
  const results = state.search.results;
  if (!results.length) {
    state.search.selectedIndex = -1;
    return;
  }
  const normalized = ((index % results.length) + results.length) % results.length;
  state.search.selectedIndex = normalized;
  focusPath(results[normalized].path, { selectResultIndex: normalized, scrollResults: true });
}

function focusPath(pathParts, options = {}) {
  for (let index = 0; index <= pathParts.length; index++) {
    state.expanded.add(pathToKey(pathParts.slice(0, index)));
  }
  rerenderTree({ keepSelection: false });
  setSelectedPath(pathParts);
  if (!workspacePanels.result) setPanelVisible("result", true);
  else setMobilePane("result");
  state.nodeIndex.get(pathToKey(pathParts))?.row?.scrollIntoView({ block: "center" });

  if (typeof options.selectResultIndex === "number") {
    const index = options.selectResultIndex;
    els.resultsList.querySelectorAll(".result-item").forEach((item) => {
      item.classList.toggle("selected", Number(item.dataset.index) === index);
    });
    const item = els.resultsList.querySelector(`.result-item[data-index="${index}"]`);
    if (options.scrollResults && item) item.scrollIntoView({ block: "nearest" });
  }
}

function makePreview(key, value) {
  const keyText = key ? String(key) : "";
  const type = valueType(value);
  const valueText = type === "string" ? value :
    type === "number" || type === "boolean" || type === "null" ? String(value) : summarize(value);
  const preview = keyText ? `${keyText}: ${valueText}` : valueText;
  return preview.length > 180 ? `${preview.slice(0, 180)}…` : preview;
}

export function startSearch(queryValue) {
  const query = String(queryValue || "").trim();
  state.search.q = query;
  state.search.running = false;
  state.search.results = [];
  state.search.selectedIndex = -1;
  state.search.truncated = false;
  renderResults();
  if (!query) return;

  const queryLower = query.toLowerCase();
  const maxResults = 500;
  const maxNodes = 250000;
  const results = [];
  const stack = [{ value: state.value, path: [], key: null }];
  let visited = 0;
  state.search.running = true;
  renderResults();

  const step = (deadline) => {
    const hasIdle = typeof deadline?.timeRemaining === "function";
    let budget = hasIdle ? Math.max(1, Math.floor(deadline.timeRemaining() / 2)) : 12;
    while (stack.length && budget > 0) {
      const current = stack.pop();
      if (!current) break;
      visited++;
      if (visited > maxNodes) {
        state.search.truncated = true;
        stack.length = 0;
        break;
      }

      const { value, path, key } = current;
      const type = valueType(value);
      const keyMatch = key !== null && String(key).toLowerCase().includes(queryLower);
      let valueMatch = false;
      if (type === "string") valueMatch = value.toLowerCase().includes(queryLower);
      else if (type === "number" || type === "boolean" || type === "null") {
        valueMatch = String(value).toLowerCase().includes(queryLower);
      }

      const shouldInclude = (state.search.searchKeys && keyMatch) || (state.search.searchValues && valueMatch);
      if (shouldInclude && results.length < maxResults) results.push({ path, preview: makePreview(key, value) });
      if (results.length >= maxResults) {
        state.search.truncated = true;
        stack.length = 0;
        break;
      }

      if (type === "array") {
        for (let index = value.length - 1; index >= 0; index--) {
          stack.push({ value: value[index], path: path.concat(index), key: index });
        }
      } else if (type === "object") {
        const keys = Object.keys(value);
        for (let index = keys.length - 1; index >= 0; index--) {
          const childKey = keys[index];
          stack.push({ value: value[childKey], path: path.concat(childKey), key: childKey });
        }
      }
      budget--;
    }

    state.search.results = results;
    state.search.running = stack.length > 0;
    renderResults();
    if (stack.length) schedule(step);
    else if (results.length) setSearchSelectedIndex(0);
    else showToast("未找到匹配项");
  };

  const schedule = (callback) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(callback, { timeout: 250 });
    else setTimeout(() => callback(null), 0);
  };
  schedule(step);
}
