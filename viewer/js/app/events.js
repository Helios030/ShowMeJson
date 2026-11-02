import { els } from "../core/dom.js";
import { savePrefs, state } from "../core/state.js";
import { copyText, pathToDisplay } from "../core/utils.js";
import { closeModal, setMobilePane, setPanelVisible, setupMobileWorkspace, setupModalFocusTrap, setupMoreMenu, setupPanelMenu, setupTooltips, showToast, toggleMoreMenu, togglePanelMenu } from "../core/ui.js";
import { clearContent, formatJson, loadJsonText, pasteFromClipboard, readJsonFile } from "../features/editor.js";
import { collapseAll, expandToDepth, rerenderTree } from "../features/tree.js";
import { setSearchSelectedIndex, startSearch, toggleHighlight } from "../features/search.js";
import { hideSettings, showSettings, switchTheme } from "../features/settings.js";
import { confirmFetch, confirmSave, hideSaveDialog, setupDragDrop, showFetchDialog, showSaveDialog } from "../features/io.js";
import { downloadConvert, renderConvert, showConvertDialog } from "../features/convert.js";
import { markDiffDirty, runDiff, toggleComparePanel } from "../features/diff.js";
import { clearHistory, renderHistory, setHistoryLoader, toggleHistoryPanel } from "../features/history.js";
import { setupPaneDivider, setupResultsDivider } from "../features/layout.js";

const on = (element, event, handler) => element.addEventListener(event, handler);

export function bindEvents() {
  setHistoryLoader((item) => {
    loadJsonText(item.jsonText, item.sourceUrl);
    setMobilePane("result");
    if (window.innerWidth <= 720) setPanelVisible("history", false);
  });
  renderHistory();

  on(els.btnFormat, "click", () => formatJson());
  on(els.btnClear, "click", clearContent);
  on(els.btnPaste, "click", pasteFromClipboard);
  on(els.btnEmptyPaste, "click", pasteFromClipboard);
  on(els.btnOpenFile, "click", () => els.fileInput.click());
  on(els.btnEmptyFetch, "click", showFetchDialog);
  on(els.btnErrorFormat, "click", () => formatJson());
  on(els.btnCancelSaveIcon, "click", hideSaveDialog);
  on(els.fileInput, "change", () => {
    readJsonFile(els.fileInput.files?.[0]);
    els.fileInput.value = "";
  });

  on(els.rawContent, "paste", (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text");
    if (!text) return;
    els.rawContent.textContent = text;
    state.rawText = text;
    state.isRawContentDirty = true;
    setTimeout(() => formatJson({ silent: true }), 100);
    setMobilePane("result");
  });
  on(els.rawContent, "input", () => {
    state.rawText = els.rawContent.textContent;
    state.isRawContentDirty = true;
    clearTimeout(els.rawContent.formatTimeout);
    els.rawContent.formatTimeout = setTimeout(() => formatJson({ silent: true }), 500);
  });
  on(els.rawContent, "blur", () => formatJson({ silent: true }));

  on(els.btnExpandAll, "click", () => expandToDepth(999));
  on(els.btnExpand2, "click", () => expandToDepth(2));
  on(els.btnCollapseAll, "click", collapseAll);
  on(els.toggleSort, "change", () => {
    state.sortKeys = els.toggleSort.checked;
    savePrefs({ sortKeys: state.sortKeys });
    rerenderTree({ keepSelection: true });
  });

  on(els.btnSettings, "click", showSettings);
  on(els.btnCloseSettings, "click", hideSettings);
  document.querySelectorAll(".theme-card").forEach((card) => {
    on(card, "click", () => switchTheme(card.dataset.theme));
  });
  on(els.settingsModal, "click", (event) => {
    if (event.target === els.settingsModal || event.target.classList.contains("modal-backdrop")) hideSettings();
  });

  on(els.btnSave, "click", showSaveDialog);
  on(els.btnConfirmSave, "click", confirmSave);
  on(els.btnCancelSave, "click", hideSaveDialog);
  on(els.saveFilename, "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmSave();
    }
    if (event.key === "Escape") hideSaveDialog();
  });
  on(els.saveDialog.querySelector(".modal-backdrop"), "click", hideSaveDialog);

  on(els.btnCopyRaw, "click", async () => {
    const ok = await copyText(state.rawText);
    showToast(ok ? "已复制原始 JSON" : "复制失败", ok ? "success" : "error");
  });
  on(els.btnCopyPretty, "click", async () => {
    const ok = await copyText(state.prettyText);
    showToast(ok ? "已复制格式化 JSON" : "复制失败", ok ? "success" : "error");
  });
  on(els.btnCopyPath, "click", async () => {
    if (!state.selectedPath) {
      showToast("请先在树中选择一个节点", "info");
      return;
    }
    const ok = await copyText(pathToDisplay(state.selectedPath));
    showToast(ok ? "已复制路径" : "复制失败", ok ? "success" : "error");
  });

  on(els.btnFetchUrl, "click", showFetchDialog);
  on(els.btnCloseFetch, "click", () => closeModal(els.fetchDialog));
  on(els.btnCancelFetch, "click", () => closeModal(els.fetchDialog));
  on(els.btnConfirmFetch, "click", confirmFetch);
  on(els.fetchDialog.querySelector(".modal-backdrop"), "click", () => closeModal(els.fetchDialog));
  on(els.fetchUrl, "keydown", (event) => {
    if (event.key === "Enter") confirmFetch();
    if (event.key === "Escape") closeModal(els.fetchDialog);
  });

  on(els.btnConvert, "click", showConvertDialog);
  on(els.btnCloseConvert, "click", () => closeModal(els.convertDialog));
  on(els.convertDialog.querySelector(".modal-backdrop"), "click", () => closeModal(els.convertDialog));
  els.convertFormats.querySelectorAll(".segment-btn").forEach((button) => {
    on(button, "click", () => {
      els.convertFormats.querySelectorAll(".segment-btn").forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-selected", "false");
      });
      button.classList.add("active");
      button.setAttribute("aria-selected", "true");
      state.convertFormat = button.dataset.format;
      renderConvert();
    });
  });
  on(els.btnCopyConvert, "click", async () => {
    const ok = await copyText(els.convertOutput.textContent);
    showToast(ok ? "已复制" : "复制失败", ok ? "success" : "error");
  });
  on(els.btnDownloadConvert, "click", downloadConvert);

  on(els.btnDiff, "click", toggleComparePanel);
  on(els.btnCloseDiff, "click", () => setPanelVisible("compare", false));
  on(els.btnCloseSourcePanel, "click", () => setPanelVisible("source", false));
  on(els.btnCloseResultPanel, "click", () => setPanelVisible("result", false));
  on(els.btnRunDiff, "click", runDiff);
  [els.diffFormattedA, els.diffFormattedB].forEach((editor) => {
    on(editor, "input", markDiffDirty);
    on(editor, "paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    });
  });

  on(els.btnHistory, "click", toggleHistoryPanel);
  on(els.btnCloseHistory, "click", () => setPanelVisible("history", false));
  on(els.btnClearHistory, "click", clearHistory);

  on(els.searchInput, "input", () => {
    clearTimeout(els.searchInput.searchTimeout);
    els.searchInput.searchTimeout = setTimeout(() => startSearch(els.searchInput.value), 300);
  });
  on(els.searchInput, "keydown", (event) => {
    if (event.key === "Enter") {
      clearTimeout(els.searchInput.searchTimeout);
      startSearch(els.searchInput.value);
    }
    if (event.key === "Escape") {
      clearTimeout(els.searchInput.searchTimeout);
      els.searchInput.value = "";
      startSearch("");
    }
  });
  on(els.btnClearSearch, "click", () => {
    els.searchInput.value = "";
    els.searchInput.focus();
    startSearch("");
  });
  on(els.btnCloseResults, "click", () => {
    els.searchInput.value = "";
    startSearch("");
    setPanelVisible("search", false);
    els.btnPanels.focus();
  });
  on(els.btnHighlightAll, "click", toggleHighlight);
  on(els.searchKeys, "change", () => {
    state.search.searchKeys = els.searchKeys.checked;
    savePrefs({ searchKeys: state.search.searchKeys });
    if (state.search.q) startSearch(state.search.q);
  });
  on(els.searchValues, "change", () => {
    state.search.searchValues = els.searchValues.checked;
    savePrefs({ searchValues: state.search.searchValues });
    if (state.search.q) startSearch(state.search.q);
  });
  on(els.btnPrev, "click", () => setSearchSelectedIndex(state.search.selectedIndex - 1));
  on(els.btnNext, "click", () => setSearchSelectedIndex(state.search.selectedIndex + 1));

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "s") {
      event.preventDefault();
      els.btnSave.click();
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "f") {
      event.preventDefault();
      setPanelVisible("search", true);
      els.searchInput.focus();
      els.searchInput.select();
    }
    if (event.key === "Escape" && document.activeElement === els.searchInput) els.btnClearSearch.click();
    if (event.key === "Escape") {
      if (els.settingsModal.classList.contains("show")) hideSettings();
      [els.fetchDialog, els.convertDialog].forEach((modal) => {
        if (!modal.classList.contains("hidden")) closeModal(modal);
      });
      if (!els.moreMenu.classList.contains("hidden")) toggleMoreMenu(false);
      if (!els.panelMenu.classList.contains("hidden")) togglePanelMenu(false);
    }
  });

  setupPaneDivider();
  setupResultsDivider();
  setupDragDrop();
  setupMoreMenu();
  setupPanelMenu(toggleComparePanel);
  setupTooltips();
  setupMobileWorkspace(toggleComparePanel);
  setupModalFocusTrap();
}
