import { els } from "../core/dom.js";
import { RESULTS_PANEL_MAX_WIDTH, RESULTS_PANEL_MIN_WIDTH, savePrefs } from "../core/state.js";

export function setupPaneDivider() {
  let isDragging = false;
  els.paneDivider.addEventListener("mousedown", (event) => {
    isDragging = true;
    els.paneDivider.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    event.preventDefault();
  });

  document.addEventListener("mousemove", (event) => {
    if (!isDragging) return;
    const container = document.querySelector(".main-container");
    const containerRect = container.getBoundingClientRect();
    const leftRect = els.leftPane.getBoundingClientRect();
    const leftOffset = leftRect.left - containerRect.left;
    const maxWidth = Math.max(300, containerRect.width - leftOffset - 400);
    const newWidth = Math.max(300, Math.min(event.clientX - leftRect.left, maxWidth));
    const percentage = (newWidth / containerRect.width) * 100;
    els.leftPane.style.flex = `0 0 ${percentage}%`;
  });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    els.paneDivider.classList.remove("dragging");
    document.body.style.cursor = "";
    if (els.leftPane.style.flex) savePrefs({ leftPaneFlex: els.leftPane.style.flex });
  });
}

export function setupResultsDivider() {
  let isDragging = false;
  els.resultsDivider.addEventListener("mousedown", (event) => {
    isDragging = true;
    els.resultsDivider.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    event.preventDefault();
  });

  document.addEventListener("mousemove", (event) => {
    if (!isDragging) return;
    const container = document.querySelector(".main-container");
    const rect = container.getBoundingClientRect();
    const upper = Math.min(RESULTS_PANEL_MAX_WIDTH, rect.width - 400);
    const newWidth = Math.max(RESULTS_PANEL_MIN_WIDTH, Math.min(rect.right - event.clientX, upper));
    els.searchResultsPanel.style.flex = `0 0 ${newWidth}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    els.resultsDivider.classList.remove("dragging");
    document.body.style.cursor = "";
    if (els.searchResultsPanel.style.flex) savePrefs({ resultsPanelFlex: els.searchResultsPanel.style.flex });
  });
}
