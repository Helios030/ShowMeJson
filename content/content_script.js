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

function getMaybeFullPageJsonText() {
  const body = document.body;
  if (!body) {
    debugLog('页面 body 不存在');
    return null;
  }

  const ct = String(document.contentType || "").toLowerCase();
  const isJsonContentType = ct.includes("application/json") || ct.includes("text/json") || ct.includes("+json");
  debugLog('页面信息', { contentType: ct, isJsonContentType });

  const elements = body.querySelectorAll("*");
  const onlyPre = body.children.length === 1 && body.children[0].tagName === "PRE";
  const noElements = elements.length === 0;
  const nearlyPlain = onlyPre || noElements;
  debugLog('页面结构', { totalElements: elements.length, onlyPre, noElements, nearlyPlain });

  // 如果是 JSON Content-Type 或者页面结构简单，使用原有逻辑
  if (isJsonContentType || nearlyPlain) {
    const text = String(body.innerText || "");
    debugLog('使用简单检测逻辑', { textLength: text.length, looksLikeJson: looksLikeJsonText(text) });
    if (looksLikeJsonText(text) && text.length <= 15 * 1024 * 1024) {
      return text;
    }
  }

  // 新增：尝试从页面中找到最大的 JSON 块
  const allTextNodes = [];
  const walker = document.createTreeWalker(
    body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (text.length > 50 && looksLikeJsonText(text)) {
      allTextNodes.push(text);
      debugLog('找到 JSON 文本节点', { length: text.length, preview: text.substring(0, 100) + '...' });
    }
  }

  debugLog('文本节点扫描结果', { totalJsonNodes: allTextNodes.length });

  // 返回找到的最大 JSON 块
  if (allTextNodes.length > 0) {
    const largestJson = allTextNodes.reduce((a, b) => a.length > b.length ? a : b);
    debugLog('选择最大 JSON 块', { length: largestJson.length });
    if (largestJson.length <= 15 * 1024 * 1024) {
      return largestJson;
    }
  }

  debugLog('未找到有效的 JSON');
  return null;
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
    console.log('[ShowMeJson] 内容脚本收到消息:', message);

    if (!message || typeof message !== "object") return;
    if (message.type === "JSONFMT_GET_SELECTION") {
      const text = getSelectionText();
      console.log('[ShowMeJson] 获取到的选中文本:', text);

      if (!text.trim()) {
        console.log('[ShowMeJson] 没有选中文本，跳过');
        return;
      }

      console.log('[ShowMeJson] 发送选中文本到背景脚本');
      await openViewerForJsonText(text, "selection", false);
    }
  })().catch((e) => {
    console.error('[ShowMeJson] 内容脚本处理消息失败:', e);
  });
});

// 调试日志
function debugLog(message, data = null) {
  console.log('[ShowMeJson]', message, data || '');
}

// 检查页面是否包含 JSON 并尝试格式化（已禁用自动检测）
async function tryFormatPage() {
  debugLog('自动检测已禁用，跳过页面 JSON 检测');
  return; // 禁用自动检测和跳转
}

// 页面加载时不再自动检测
debugLog('页面加载，自动检测已禁用');

// 不再监听页面内容变化
debugLog('自动监听已禁用');

// 粘贴事件监听已禁用 - 不再自动检测粘贴的 JSON 内容
debugLog('粘贴事件监听已禁用');

// 键盘快捷键支持 (Ctrl+Shift+J) - 只处理选中文本
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'J') {
    e.preventDefault();
    debugLog('快捷键触发');
    const text = getSelectionText();
    if (text.trim() && looksLikeJsonText(text)) {
      debugLog('格式化选中文本');
      openViewerForJsonText(text, "selection", false);
    } else {
      debugLog('没有选中的 JSON 文本，跳过自动检测');
    }
  }
});

