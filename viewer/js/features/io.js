import { els } from "../core/dom.js";
import { state } from "../core/state.js";
import { saveAsJsonFile } from "../core/utils.js";
import { closeModal, openModal, setMobilePane, showToast } from "../core/ui.js";
import { loadJsonText, readJsonFile } from "./editor.js";

function generateFilename() {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
  let source = "json";
  if (state.sourceUrl) {
    try {
      source = new URL(state.sourceUrl).hostname;
    } catch (_) {
      source = state.sourceUrl.replace(/\.[^.]+$/, "") || "json";
    }
  }
  return `${source}_${timestamp}.json`;
}

export function showSaveDialog() {
  if (!state.prettyText) {
    showToast("没有可保存的内容", "error");
    return;
  }
  els.saveFilename.value = generateFilename().replace(".json", "");
  openModal(els.saveDialog);
  setTimeout(() => {
    els.saveFilename.focus();
    els.saveFilename.select();
  }, 60);
}

export function hideSaveDialog() {
  closeModal(els.saveDialog);
}

export function confirmSave() {
  const filename = els.saveFilename.value.trim();
  if (!filename) {
    showToast("请输入文件名", "error");
    els.saveFilename.focus();
    return;
  }

  const contentType = document.querySelector('input[name="contentType"]:checked').value;
  const content = contentType === "pretty" ? state.prettyText : state.rawText;
  try {
    const fullFilename = filename.endsWith(".json") ? filename : filename + ".json";
    saveAsJsonFile(content, fullFilename);
    hideSaveDialog();
    showToast(`已保存为 ${fullFilename}`, "success");
  } catch (error) {
    showToast("保存失败：" + error.message, "error");
  }
}

export function showFetchDialog() {
  els.fetchUrl.value = "";
  openModal(els.fetchDialog);
  setTimeout(() => els.fetchUrl.focus(), 100);
}

export async function confirmFetch() {
  const url = els.fetchUrl.value.trim();
  if (!url) {
    showToast("请输入 URL", "error");
    els.fetchUrl.focus();
    return;
  }
  if (els.btnConfirmFetch.disabled) return;

  els.btnConfirmFetch.disabled = true;
  els.btnConfirmFetch.classList.add("is-loading");
  els.btnConfirmFetch.textContent = "正在获取…";
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    closeModal(els.fetchDialog);
    loadJsonText(text, url);
    setMobilePane("result");
  } catch (error) {
    showToast(`获取失败：${String(error?.message || error)}`, "error", 3000);
  } finally {
    els.btnConfirmFetch.disabled = false;
    els.btnConfirmFetch.classList.remove("is-loading");
    els.btnConfirmFetch.textContent = "获取并格式化";
  }
}

export function setupDragDrop() {
  let dragDepth = 0;
  document.addEventListener("dragenter", (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    event.preventDefault();
    dragDepth++;
    document.body.classList.add("is-dragging");
  });
  document.addEventListener("dragover", (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  document.addEventListener("dragleave", (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) document.body.classList.remove("is-dragging");
  });
  document.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    document.body.classList.remove("is-dragging");
    readJsonFile(event.dataTransfer?.files?.[0]);
  });
}
