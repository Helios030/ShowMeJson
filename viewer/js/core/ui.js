import { els } from "./dom.js";
import { savePrefs, state, workspacePanels } from "./state.js";

export function showToast(text, type = "info", ms = 1600) {
  els.toast.textContent = String(text || "");
  els.toast.className = "toast toast-" + type;
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => els.toast.classList.add("hidden"), ms);
}

export function showError(text) {
  els.errorBox.textContent = String(text || "");
  els.errorBox.classList.remove("hidden");
}

export function hideError() {
  els.errorBox.classList.add("hidden");
}

export function updateStatus(status, type = "info") {
  els.jsonStatus.textContent = status;
  els.jsonStatus.className = `status-badge status-${type}`;
}

export function updateSizeInfo(text) {
  els.jsonSize.textContent = text;
}

export function updateFormatStatus(status, type = "info") {
  els.formatStatus.textContent = status;
  els.formatStatus.className = `status-badge status-${type}`;
}

export function savePanelPrefs() {
  savePrefs({ panels: { ...workspacePanels } });
}

export function setMobilePane(pane) {
  document.body.dataset.mobilePane = pane;
  els.mobileWorkspaceTabs.querySelectorAll("[data-pane]").forEach((button) => {
    const active = button.dataset.pane === pane;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

export function applyWorkspacePanels() {
  const compareOpen = workspacePanels.compare;
  document.body.classList.toggle("compare-open", compareOpen);
  document.body.dataset.sourceOnly = String(workspacePanels.source && !workspacePanels.result && !compareOpen);
  document.body.dataset.resultOnly = String(workspacePanels.result && !workspacePanels.source && !compareOpen);

  els.historyPanel.classList.toggle("show", workspacePanels.history);
  els.leftPane.classList.toggle("hidden", !workspacePanels.source);
  els.rightPane.classList.toggle("hidden", !workspacePanels.result);
  els.diffPanel.classList.toggle("show", compareOpen);
  els.searchResultsPanel.classList.toggle("show", workspacePanels.search);
  els.btnHistory.setAttribute("aria-pressed", String(workspacePanels.history));
  state.showResults = workspacePanels.search;

  els.paneDivider.classList.toggle("hidden", compareOpen || !workspacePanels.source || !workspacePanels.result);
  els.resultsDivider.classList.toggle(
    "show",
    workspacePanels.search && !compareOpen && (workspacePanels.source || workspacePanels.result)
  );
  els.btnDiff.setAttribute("aria-pressed", String(compareOpen));

  els.panelMenu.querySelectorAll("[data-panel]").forEach((button) => {
    button.setAttribute("aria-checked", String(workspacePanels[button.dataset.panel]));
  });
  els.mobileWorkspaceTabs.querySelectorAll("[data-pane]").forEach((button) => {
    if (button.dataset.pane === "source") button.classList.toggle("hidden", !workspacePanels.source);
    if (button.dataset.pane === "result") button.classList.toggle("hidden", !workspacePanels.result);
  });
}

export function setPanelVisible(panel, show, { persist = true } = {}) {
  if (!Object.hasOwn(workspacePanels, panel)) return;
  if (!show && !["search", "history"].includes(panel)) {
    const next = { ...workspacePanels, [panel]: false };
    if (!next.source && !next.result && !next.compare) {
      showToast("至少需要保留一个主面板", "info");
      return;
    }
  }

  workspacePanels[panel] = show;
  const exitsCompare = ["search", "history"].includes(panel) && show && workspacePanels.compare;
  if (exitsCompare) {
    workspacePanels.compare = false;
    if (document.body.dataset.mobilePane === "compare") {
      setMobilePane(workspacePanels.source ? "source" : "result");
    }
  }

  if (panel === "compare") {
    if (show) setMobilePane("compare");
    else if (document.body.dataset.mobilePane === "compare") {
      setMobilePane(workspacePanels.source ? "source" : "result");
    }
  } else if ((panel === "source" || panel === "result") && show && window.innerWidth <= 720) {
    setMobilePane(panel);
  } else if ((panel === "source" || panel === "result") && !show && document.body.dataset.mobilePane === panel) {
    const nextPane = workspacePanels.compare ? "compare" : workspacePanels.source ? "source" : "result";
    setMobilePane(nextPane);
  } else if (panel === "search" && show && workspacePanels.result) {
    setMobilePane("result");
    setTimeout(() => els.searchInput.focus(), 50);
  }

  applyWorkspacePanels();
  if (persist) savePanelPrefs();
}

export function toggleResults(show, options) {
  setPanelVisible("search", show, options);
}

export function setTreeViewState(view) {
  els.treeEmptyState.classList.toggle("hidden", view !== "empty");
  els.treeErrorState.classList.toggle("hidden", view !== "error");
  els.treeRoot.classList.toggle("hidden", view !== "ready");
}

export function setupMobileWorkspace(onCompare) {
  setMobilePane(workspacePanels.compare ? "compare" : workspacePanels.source ? "source" : "result");
  els.mobileWorkspaceTabs.querySelectorAll("[data-pane]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.pane === "compare" && !workspacePanels.compare) onCompare();
      else setMobilePane(button.dataset.pane);
    });
  });
}

export function openModal(modal) {
  modal._returnFocus = document.activeElement;
  modal.classList.remove("hidden");
  setTimeout(() => {
    const target = modal.querySelector("input, textarea, .modal-close, button");
    target?.focus();
  }, 40);
}

export function closeModal(modal) {
  modal.classList.add("hidden");
  modal._returnFocus?.focus?.();
}

export function setupModalFocusTrap() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const modal = document.querySelector(".modal:not(.hidden), .settings-modal.show");
    if (!modal) return;
    const focusable = Array.from(modal.querySelectorAll("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex='0']"))
      .filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

export function togglePanelMenu(show) {
  const willShow = typeof show === "boolean" ? show : els.panelMenu.classList.contains("hidden");
  els.panelMenu.classList.toggle("hidden", !willShow);
  els.btnPanels.setAttribute("aria-expanded", String(willShow));
  if (willShow) els.panelMenu.querySelector("[data-panel]")?.focus();
}

export function toggleMoreMenu(show) {
  const willShow = typeof show === "boolean" ? show : els.moreMenu.classList.contains("hidden");
  els.moreMenu.classList.toggle("hidden", !willShow);
  els.btnMore.setAttribute("aria-expanded", String(willShow));
  if (willShow) els.moreMenu.querySelector(".menu-item:not(:disabled)")?.focus();
}

export function setupPanelMenu(onCompare) {
  els.btnPanels.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMoreMenu(false);
    togglePanelMenu();
  });

  els.panelMenu.querySelectorAll("[data-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.dataset.panel;
      if (panel === "compare" && !workspacePanels.compare) onCompare();
      else if (panel === "history" && workspacePanels.compare) setPanelVisible("history", true);
      else setPanelVisible(panel, !workspacePanels[panel]);
    });
  });

  els.btnResetPanels.addEventListener("click", () => {
    Object.assign(workspacePanels, { history: true, source: true, result: true, search: false, compare: false });
    setMobilePane("source");
    applyWorkspacePanels();
    savePanelPrefs();
    showToast("已恢复默认布局", "success");
  });

  document.addEventListener("click", (event) => {
    if (els.panelMenu.classList.contains("hidden")) return;
    if (!els.panelMenu.contains(event.target) && !els.btnPanels.contains(event.target)) togglePanelMenu(false);
  });
}

export function setupMoreMenu() {
  els.btnMore.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePanelMenu(false);
    toggleMoreMenu();
  });
  els.moreMenu.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => toggleMoreMenu(false));
  });
  document.addEventListener("click", (event) => {
    if (els.moreMenu.classList.contains("hidden")) return;
    if (!els.moreMenu.contains(event.target) && !els.btnMore.contains(event.target)) toggleMoreMenu(false);
  });
}

export function setupTooltips() {
  const tip = document.createElement("div");
  tip.className = "app-tooltip hidden";
  document.body.appendChild(tip);

  document.querySelectorAll(".topbar [title]").forEach((element) => {
    element.dataset.tip = element.getAttribute("title");
    if (!element.hasAttribute("aria-label")) element.setAttribute("aria-label", element.dataset.tip);
    element.removeAttribute("title");
  });

  let current = null;
  const show = (element) => {
    current = element;
    tip.textContent = element.dataset.tip;
    tip.classList.remove("hidden");
    const rect = element.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const left = Math.max(6, Math.min(rect.left + rect.width / 2 - tipRect.width / 2, window.innerWidth - tipRect.width - 6));
    tip.style.left = `${left}px`;
    tip.style.top = `${rect.bottom + 6}px`;
  };
  const hide = () => {
    current = null;
    tip.classList.add("hidden");
  };

  document.addEventListener("mouseover", (event) => {
    const element = event.target.closest("[data-tip]");
    if (element && element !== current) show(element);
  });
  document.addEventListener("mouseout", (event) => {
    const element = event.target.closest("[data-tip]");
    if (element && (!event.relatedTarget || !element.contains(event.relatedTarget))) hide();
  });
  document.addEventListener("focusin", (event) => {
    const element = event.target.closest("[data-tip]");
    if (element) show(element);
  });
  document.addEventListener("focusout", hide);
  document.addEventListener("scroll", hide, true);
  document.addEventListener("click", hide, true);
}
