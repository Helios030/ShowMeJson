function getSelectionText() {
  const selection = window.getSelection?.();
  const selText = selection ? String(selection.toString() || "") : "";
  if (selText.trim()) return selText;

  const el = document.activeElement;
  if (!el) return "";
  const tag = el.tagName ? el.tagName.toUpperCase() : "";
  const isInput = tag === "TEXTAREA" || (tag === "INPUT" && ["text", "search", "url", "email", "tel", "password"].includes(el.type));
  if (!isInput) return "";
  const value = String(el.value || "");
  const start = Number.isFinite(el.selectionStart) ? el.selectionStart : 0;
  const end = Number.isFinite(el.selectionEnd) ? el.selectionEnd : 0;
  if (end <= start) return "";
  return value.slice(start, end);
}

function looksLikeJsonText(text) {
  const t = text.trim();
  if (t.length < 2) return false;
  const first = t[0];
  const last = t[t.length - 1];
  if (!((first === "{" && last === "}") || (first === "[" && last === "]"))) return false;
  return true;
}

async function openViewerForJsonText(jsonText, mode, openInSameTab) {
  await chrome.runtime.sendMessage({
    type: "JSONFMT_OPEN_VIEWER",
    jsonText,
    mode,
    openInSameTab,
    sourceUrl: location.href
  });
}

chrome.runtime.onMessage.addListener((message) => {
  (async () => {
    if (!message || typeof message !== "object") return;
    if (message.type === "JSONFMT_GET_SELECTION") {
      const text = getSelectionText();
      if (!text.trim()) return;
      await openViewerForJsonText(text, "selection", false);
    }
  })().catch(() => {
    // 忽略消息处理异常，避免污染页面控制台
  });
});

// 键盘快捷键支持 (Ctrl+Shift+J) - 只处理选中文本
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'J') {
    e.preventDefault();
    const text = getSelectionText();
    if (text.trim() && looksLikeJsonText(text)) {
      openViewerForJsonText(text, "selection", false);
    }
  }
});

