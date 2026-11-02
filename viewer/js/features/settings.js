import { els } from "../core/dom.js";
import { state, THEME_NAMES } from "../core/state.js";
import { showToast } from "../core/ui.js";

export function showSettings() {
  els.settingsModal._returnFocus = document.activeElement;
  els.settingsModal.classList.add("show");
  setTimeout(() => {
    const activeTheme = els.settingsModal.querySelector(".theme-card.active");
    (activeTheme || els.btnCloseSettings).focus();
  }, 50);
}

export function hideSettings() {
  els.settingsModal.classList.remove("show");
  els.settingsModal._returnFocus?.focus?.();
}

export function switchTheme(themeName, { notify = true } = {}) {
  const nextTheme = Object.hasOwn(THEME_NAMES, themeName) ? themeName : "dark";
  state.currentTheme = nextTheme;
  document.documentElement.setAttribute("data-theme", nextTheme);

  document.querySelectorAll(".theme-card").forEach((card) => {
    const active = card.dataset.theme === nextTheme;
    card.classList.toggle("active", active);
    card.setAttribute("aria-checked", String(active));
  });

  localStorage.setItem("showmejson-theme", nextTheme);
  if (notify) showToast(`已切换到${THEME_NAMES[nextTheme]}`, "success");
}

export function loadTheme() {
  const savedTheme = localStorage.getItem("showmejson-theme") || "dark";
  switchTheme(savedTheme, { notify: false });
}
