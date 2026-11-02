import { els } from "./js/core/dom.js";
import { prefs, RESULTS_PANEL_MAX_WIDTH, state } from "./js/core/state.js";
import { getPayload, getQueryParams } from "./js/core/utils.js";
import { applyWorkspacePanels, setMobilePane, setTreeViewState, showError, showToast, updateFormatStatus, updateStatus } from "./js/core/ui.js";
import { bindEvents } from "./js/app/events.js";
import { formatJson, updateRawContentHighlight } from "./js/features/editor.js";
import { loadTheme } from "./js/features/settings.js";

async function init() {
  bindEvents();
  loadTheme();

  if (typeof prefs.sortKeys === "boolean") {
    state.sortKeys = prefs.sortKeys;
    els.toggleSort.checked = prefs.sortKeys;
  }
  if (typeof prefs.searchKeys === "boolean") els.searchKeys.checked = prefs.searchKeys;
  if (typeof prefs.searchValues === "boolean") els.searchValues.checked = prefs.searchValues;
  if (prefs.leftPaneFlex) els.leftPane.style.flex = prefs.leftPaneFlex;

  if (prefs.resultsPanelFlex) {
    const match = /([\d.]+)px/.exec(prefs.resultsPanelFlex);
    if (match) {
      const width = Math.min(parseFloat(match[1]), RESULTS_PANEL_MAX_WIDTH);
      els.searchResultsPanel.style.flex = `0 0 ${width}px`;
    } else {
      els.searchResultsPanel.style.flex = prefs.resultsPanelFlex;
    }
  }

  state.search.searchKeys = els.searchKeys.checked;
  state.search.searchValues = els.searchValues.checked;
  applyWorkspacePanels();

  const { id, mode } = getQueryParams();
  state.mode = mode || "manual";

  if (id) {
    try {
      const payload = await getPayload(id);
      if (!payload?.jsonText) {
        showError("数据不存在或已过期");
        return;
      }

      const jsonText = String(payload.jsonText);
      els.rawContent.textContent = jsonText;
      state.sourceUrl = payload.sourceUrl || "";
      els.sourceUrl.textContent = state.sourceUrl || "来自网页选区";
      updateRawContentHighlight(jsonText);
      formatJson({ silent: true });
      setMobilePane("result");
      showToast(state.mode === "selection" ? "已从选中文本格式化" : "已加载 JSON 数据", "success");
    } catch (error) {
      showError(String(error?.message || error));
    }
  } else {
    updateStatus("准备就绪", "info");
    updateFormatStatus("等待输入", "info");
    setTreeViewState("empty");
  }
}

init();
