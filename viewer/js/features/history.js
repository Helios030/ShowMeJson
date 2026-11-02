import { els } from "../core/dom.js";
import { HISTORY_ITEM_MAX_BYTES, HISTORY_KEY, HISTORY_MAX, state, workspacePanels } from "../core/state.js";
import { copyText, formatBytes } from "../core/utils.js";
import { setPanelVisible, showToast } from "../core/ui.js";

let historyLoader = null;

export function setHistoryLoader(loader) {
  historyLoader = loader;
}

function enableHistoryLongPress(row, item, loadItem) {
  let timer = null;
  let longPressed = false;
  let startX = 0;
  let startY = 0;
  const cancelTimer = () => {
    clearTimeout(timer);
    timer = null;
  };

  row.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest(".history-del")) return;
    longPressed = false;
    startX = event.clientX;
    startY = event.clientY;
    cancelTimer();
    timer = setTimeout(async () => {
      longPressed = true;
      const ok = await copyText(item.jsonText);
      showToast(ok ? "已复制历史记录完整 JSON" : "复制失败", ok ? "success" : "error");
    }, 550);
  });
  row.addEventListener("pointermove", (event) => {
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 8) cancelTimer();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
    row.addEventListener(type, cancelTimer);
  });
  row.addEventListener("contextmenu", (event) => {
    if (longPressed) event.preventDefault();
  });
  row.addEventListener("click", (event) => {
    if (longPressed) {
      event.preventDefault();
      event.stopPropagation();
      longPressed = false;
      return;
    }
    loadItem();
  });
}

function hashString(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return String(hash >>> 0);
}

function getHistory() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(HISTORY_KEY, (data) => {
        resolve(Array.isArray(data?.[HISTORY_KEY]) ? data[HISTORY_KEY] : []);
      });
    } catch (_) {
      resolve([]);
    }
  });
}

function setHistory(list) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [HISTORY_KEY]: list }, () => resolve());
    } catch (_) {
      resolve();
    }
  });
}

async function recordHistory(jsonText, sourceUrl) {
  const text = String(jsonText || "");
  if (!text.trim()) return;
  const bytes = new Blob([text]).size;
  if (bytes > HISTORY_ITEM_MAX_BYTES) return;

  const hash = hashString(text);
  const list = await getHistory();
  if (list[0] && list[0].hash === hash) return;
  const filtered = list.filter((item) => item.hash !== hash);
  filtered.unshift({
    id: `${Date.now()}_${hash}`,
    hash,
    ts: Date.now(),
    sourceUrl: sourceUrl || state.sourceUrl || "",
    size: bytes,
    preview: text.replace(/\s+/g, " ").trim().slice(0, 160),
    jsonText: text
  });
  await setHistory(filtered.slice(0, HISTORY_MAX));
  if (workspacePanels.history) renderHistory();
}

export function scheduleHistory(jsonText, sourceUrl) {
  clearTimeout(scheduleHistory._t);
  scheduleHistory._t = setTimeout(() => recordHistory(jsonText, sourceUrl), 1500);
}

function formatHistoryTime(timestamp) {
  const date = new Date(timestamp);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function renderHistory() {
  const list = await getHistory();
  els.historyList.innerHTML = "";
  if (!list.length) {
    els.historyList.innerHTML = `<div class="history-empty">暂无历史记录</div>`;
    els.historySummary.textContent = "";
    return;
  }

  els.historySummary.textContent = `共 ${list.length} 条`;
  for (const item of list) {
    const row = document.createElement("div");
    row.className = "history-item";
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `载入 ${formatHistoryTime(item.ts)} 的 JSON，长按复制完整内容`);
    row.title = "点击载入，长按复制完整 JSON";

    const main = document.createElement("div");
    main.className = "history-main";
    const preview = document.createElement("div");
    preview.className = "history-preview";
    preview.textContent = item.preview || "(空)";
    const meta = document.createElement("div");
    meta.className = "history-meta";
    const time = document.createElement("span");
    time.textContent = formatHistoryTime(item.ts);
    const size = document.createElement("span");
    size.textContent = formatBytes(item.size || 0);
    meta.append(time, size);
    if (item.sourceUrl) {
      const source = document.createElement("span");
      source.className = "history-source";
      source.textContent = item.sourceUrl;
      meta.appendChild(source);
    }
    main.append(preview, meta);

    const deleteButton = document.createElement("button");
    deleteButton.className = "history-del";
    deleteButton.textContent = "✕";
    deleteButton.title = "删除此条";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteHistoryItem(item.id);
    });

    row.append(main, deleteButton);
    const loadItem = () => {
      historyLoader?.(item);
      showToast("已载入历史记录", "success");
    };
    enableHistoryLongPress(row, item, loadItem);
    row.addEventListener("keydown", (event) => {
      if (event.target === row && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        loadItem();
      }
    });
    els.historyList.appendChild(row);
  }
}

async function deleteHistoryItem(id) {
  const list = await getHistory();
  await setHistory(list.filter((item) => item.id !== id));
  renderHistory();
}

export async function clearHistory() {
  await setHistory([]);
  renderHistory();
  showToast("历史已清空");
}

export function toggleHistoryPanel() {
  const show = workspacePanels.compare ? true : !workspacePanels.history;
  setPanelVisible("history", show);
  if (show) renderHistory();
}
