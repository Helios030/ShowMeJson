export const HISTORY_KEY = "showmejson_history";
export const HISTORY_MAX = 20;
export const HISTORY_ITEM_MAX_BYTES = 1024 * 1024;
export const RESULTS_PANEL_MIN_WIDTH = 240;
export const RESULTS_PANEL_MAX_WIDTH = 700;
export const PREFS_KEY = "showmejson-prefs";

export const THEME_NAMES = Object.freeze({
  dark: "暗夜蓝",
  light: "雾白",
  blue: "海盐蓝",
  green: "森林绿",
  purple: "暮光紫",
  sunset: "日落橙"
});

export const prefs = (() => {
  try {
    return Object.assign({}, JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"));
  } catch (_) {
    return {};
  }
})();

export const workspacePanels = Object.assign(
  { history: true, source: true, result: true, search: false, compare: false },
  prefs.panels || {}
);

if (!workspacePanels.source && !workspacePanels.result && !workspacePanels.compare) {
  workspacePanels.source = true;
}

export function savePrefs(patch) {
  Object.assign(prefs, patch);
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (_) { }
}

export const state = {
  mode: "manual",
  sourceUrl: "",
  rawText: "",
  value: null,
  prettyText: "",
  showPanel: "tree",
  sortKeys: false,
  expanded: new Set(),
  selectedPath: null,
  nodeIndex: new Map(),
  arrayRenderCount: new Map(),
  search: {
    q: "",
    running: false,
    results: [],
    selectedIndex: -1,
    truncated: false,
    searchKeys: true,
    searchValues: true
  },
  showResults: false,
  isRawContentDirty: false,
  highlightAll: false,
  highlightedNodes: new Set(),
  currentTheme: "dark",
  parsedStringPaths: new Set(),
  convertFormat: "yaml"
};
