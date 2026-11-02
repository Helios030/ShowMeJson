import { els } from "../core/dom.js";
import { state } from "../core/state.js";
import { escapeHtml, formatBytes, jsonHighlight, pathToKey } from "../core/utils.js";
import { hideError, setMobilePane, setTreeViewState, showError, showToast, updateFormatStatus, updateSizeInfo, updateStatus } from "../core/ui.js";
import { rerenderTree, setSelectedPath } from "./tree.js";
import { startSearch } from "./search.js";
import { scheduleHistory } from "./history.js";

export function formatJson({ silent = false } = {}) {
  const text = els.rawContent.textContent || els.rawContent.innerText || "";
  try {
    if (!text.trim()) {
      state.rawText = "";
      state.value = null;
      state.prettyText = "";
      els.treeRoot.innerHTML = "";
      setSelectedPath(null);
      setTreeViewState("empty");
      hideError();
      updateStatus("准备就绪", "info");
      updateFormatStatus("等待输入", "info");
      updateSizeInfo("");
      if (!silent) showToast("请先输入 JSON 内容", "info");
      return;
    }

    const parsed = window.JsonTools.looseParseJson(text);
    state.rawText = text;
    state.value = parsed.value;
    state.prettyText = JSON.stringify(state.value, null, 2);
    state.parsedStringPaths.clear();
    state.isRawContentDirty = false;

    hideError();
    if (document.activeElement !== els.rawContent) updateRawContentHighlight(text);
    updateStatus(parsed.repaired ? "已自动修复" : "有效 JSON", parsed.repaired ? "warning" : "success");
    updateSizeInfo(formatBytes(new Blob([text]).size));
    updateFormatStatus("已格式化", "success");

    setSelectedPath(null);
    state.expanded.clear();
    state.expanded.add(pathToKey([]));
    rerenderTree({ keepSelection: false });

    if (!silent) {
      if (parsed.repaired && parsed.repairs?.length) {
        showToast(`已自动修复：${parsed.repairs.join("、")}`, "warning", 2600);
      } else {
        showToast("JSON 格式化成功", "success");
      }
    }
    scheduleHistory(state.prettyText, state.sourceUrl);
  } catch (error) {
    const location = window.JsonTools.locateJsonError(text, error);
    const where = location.line > 0 ? `（第 ${location.line} 行，第 ${location.column} 列）` : "";
    showError(`JSON 解析失败${where}：${location.message}`);
    updateStatus("无效 JSON", "error");
    updateFormatStatus(location.line > 0 ? `第 ${location.line} 行出错` : "解析错误", "error");
    els.treeRoot.innerHTML = "";
    setSelectedPath(null);
    setTreeViewState("error");
    if (document.activeElement !== els.rawContent) showRawError(text, location);
  }
}

function showRawError(text, location) {
  if (!location || location.line < 1) {
    els.rawContent.classList.remove("highlighted");
    els.rawContent.textContent = text;
    return;
  }
  const lines = text.split("\n");
  els.rawContent.classList.remove("highlighted");
  els.rawContent.innerHTML = lines.map((line, index) => {
    const safe = escapeHtml(line) || "&nbsp;";
    return index + 1 === location.line ? `<span class="error-line">${safe}</span>` : safe;
  }).join("\n");
  els.rawContent.querySelector(".error-line")?.scrollIntoView({ block: "center" });
}

export function updateRawContentHighlight(text) {
  if (!text || !text.trim()) {
    els.rawContent.classList.remove("highlighted");
    els.rawContent.textContent = "";
    return;
  }

  try {
    const formatted = JSON.stringify(JSON.parse(text), null, 2);
    els.rawContent.classList.add("highlighted");
    els.rawContent.innerHTML = jsonHighlight(formatted);
  } catch (_) {
    els.rawContent.classList.remove("highlighted");
    els.rawContent.textContent = text;
  }
}

export function loadJsonText(text, sourceLabel) {
  els.rawContent.textContent = String(text || "");
  state.rawText = String(text || "");
  state.isRawContentDirty = true;
  state.sourceUrl = sourceLabel || "";
  els.sourceUrl.textContent = sourceLabel || "未命名文档";
  formatJson();
}

export async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showToast("剪贴板中没有文本内容", "info");
      return;
    }
    loadJsonText(text);
    setMobilePane("result");
  } catch (_) {
    els.rawContent.focus();
    showToast(`请使用 ${/Mac/i.test(navigator.platform) ? "⌘V" : "Ctrl+V"} 粘贴 JSON`, "info", 2800);
  }
}

export function readJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    loadJsonText(String(reader.result || ""), file.name);
    setMobilePane("result");
  };
  reader.onerror = () => showToast("文件读取失败，请重试", "error");
  reader.readAsText(file);
}

export function clearContent() {
  els.rawContent.textContent = "";
  els.rawContent.classList.remove("highlighted");
  state.rawText = "";
  state.value = null;
  state.prettyText = "";
  state.sourceUrl = "";
  state.expanded.clear();
  state.isRawContentDirty = false;

  els.sourceUrl.textContent = "未命名文档";
  els.treeRoot.innerHTML = "";
  els.searchInput.value = "";
  setSelectedPath(null);
  setTreeViewState("empty");
  startSearch("");
  hideError();
  updateStatus("准备就绪", "info");
  updateSizeInfo("");
  updateFormatStatus("等待输入", "info");
  showToast("工作区已清空", "success");
}
