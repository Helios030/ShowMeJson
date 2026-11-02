import { els } from "../core/dom.js";
import { state } from "../core/state.js";
import { openModal, showToast } from "../core/ui.js";

export function renderConvert() {
  if (!state.value && state.value !== 0) {
    els.convertOutput.textContent = "暂无可转换的 JSON";
    return;
  }

  let output = "";
  try {
    if (state.convertFormat === "yaml") output = window.JsonTools.toYaml(state.value);
    else if (state.convertFormat === "csv") output = window.JsonTools.toCsv(state.value);
    else output = window.JsonTools.toTypeScript(state.value, "Root");
  } catch (error) {
    output = `转换失败：${String(error?.message || error)}`;
  }
  els.convertOutput.textContent = output;
}

export function showConvertDialog() {
  if (!state.value && state.value !== 0) {
    showToast("请先格式化有效的 JSON", "error");
    return;
  }
  renderConvert();
  openModal(els.convertDialog);
}

export function downloadConvert() {
  const extension = state.convertFormat === "ts" ? "ts" : state.convertFormat;
  const mime = state.convertFormat === "csv" ? "text/csv" : state.convertFormat === "ts" ? "text/plain" : "text/yaml";
  const blob = new Blob([els.convertOutput.textContent || ""], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `export.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
