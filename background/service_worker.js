const MENU_ID_FORMAT_SELECTION = "jsonfmt_format_selection";

function uuid() {
  return crypto.randomUUID();
}

function ensureContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID_FORMAT_SELECTION,
      title: "格式化JSON",
      contexts: ["selection"]
    });
  });
}

async function storePayload(payload) {
  const id = uuid();
  await chrome.storage.session.set({
    [`payload:${id}`]: {
      createdAt: Date.now(),
      payload
    }
  });
  return id;
}

async function openViewerInTab(tabId, payload, mode) {
  const id = await storePayload(payload);
  const url = chrome.runtime.getURL(`viewer/viewer.html?id=${encodeURIComponent(id)}&mode=${encodeURIComponent(mode)}`);
  await chrome.tabs.update(tabId, { url });
}

async function openViewerNewTab(payload, openerTabId, mode) {
  const id = await storePayload(payload);
  const url = chrome.runtime.getURL(`viewer/viewer.html?id=${encodeURIComponent(id)}&mode=${encodeURIComponent(mode)}`);
  await chrome.tabs.create({ url, openerTabId });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenus();
});

ensureContextMenus();

// 处理扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: chrome.runtime.getURL('viewer/viewer.html') });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('[ShowMeJson] 右键菜单点击', { info, tab });

  if (info.menuItemId !== MENU_ID_FORMAT_SELECTION) return;
  if (!tab?.id) return;

  const selectionText = typeof info.selectionText === "string" ? info.selectionText : "";
  console.log('[ShowMeJson] 选中文本:', selectionText);

  if (selectionText.trim()) {
    console.log('[ShowMeJson] 直接使用选中文本打开查看器');
    await openViewerNewTab(
      {
        jsonText: selectionText,
        sourceUrl: tab.url || ""
      },
      tab.id,
      "selection"
    );
    return;
  }

  try {
    console.log('[ShowMeJson] 请求内容脚本获取选中文本');
    await chrome.tabs.sendMessage(tab.id, { type: "JSONFMT_GET_SELECTION" });
  } catch (e) {
    console.error('[ShowMeJson] 发送消息失败:', e);
    return;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message || typeof message !== "object") return;

    if (message.type === "JSONFMT_OPEN_VIEWER" && typeof message.jsonText === "string") {
      const tabId = message.openInSameTab ? sender.tab?.id : undefined;
      const payload = {
        jsonText: message.jsonText,
        sourceUrl: message.sourceUrl || sender.tab?.url || ""
      };
      if (tabId) {
        await openViewerInTab(tabId, payload, message.mode || "page");
      } else {
        await openViewerNewTab(payload, sender.tab?.id, message.mode || "page");
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "JSONFMT_VIEWER_GET_PAYLOAD" && typeof message.id === "string") {
      const key = `payload:${message.id}`;
      const data = await chrome.storage.session.get(key);
      const entry = data?.[key];
      sendResponse({ ok: true, payload: entry?.payload || null });
      return;
    }

    sendResponse({ ok: false });
  })().catch((err) => {
    sendResponse({ ok: false, error: String(err?.message || err) });
  });

  return true;
});
