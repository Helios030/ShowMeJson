export function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function jsonHighlight(text) {
  const t = String(text || "");
  if (t.length > 2 * 1024 * 1024) return escapeHtml(t);
  const tokenPattern = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?=\s*:)|"(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|[{}\[\],:])/g;
  let html = "";
  let lastIndex = 0;
  let match;

  while ((match = tokenPattern.exec(t)) !== null) {
    const token = match[0];
    html += escapeHtml(t.slice(lastIndex, match.index));
    if (token.startsWith('"')) {
      const isKey = t.slice(tokenPattern.lastIndex).trimStart().startsWith(":");
      html += `<span class="${isKey ? "k" : "v-str"}">${escapeHtml(token)}</span>`;
    } else if (token === "true" || token === "false") {
      html += `<span class="v-bool">${token}</span>`;
    } else if (token === "null") {
      html += `<span class="v-null">${token}</span>`;
    } else if (/^-?\d/.test(token)) {
      html += `<span class="v-num">${escapeHtml(token)}</span>`;
    } else {
      html += `<span class="json-punctuation">${escapeHtml(token)}</span>`;
    }
    lastIndex = tokenPattern.lastIndex;
  }

  html += escapeHtml(t.slice(lastIndex));
  return html;
}

export function getQueryParams() {
  const url = new URL(location.href);
  return {
    id: url.searchParams.get("id") || "",
    mode: url.searchParams.get("mode") || "page"
  };
}

export async function getPayload(id) {
  const res = await chrome.runtime.sendMessage({ type: "JSONFMT_VIEWER_GET_PAYLOAD", id });
  if (!res?.ok) throw new Error(res?.error || "读取数据失败");
  return res.payload;
}

export function pathToKey(pathParts) {
  return pathParts.map((part) => String(part)).join("\u0001");
}

export function pathToDisplay(pathParts) {
  if (!pathParts || pathParts.length === 0) return "$";
  let out = "$";
  for (const part of pathParts) {
    if (typeof part === "number") {
      out += `[${part}]`;
      continue;
    }
    const value = String(part);
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) out += `.${value}`;
    else out += `[${JSON.stringify(value)}]`;
  }
  return out;
}

export function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function isExpandable(value) {
  if (value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

export function summarize(value) {
  const type = valueType(value);
  if (type === "array") return `Array(${value.length})`;
  if (type === "object") return `Object(${Object.keys(value).length})`;
  if (type === "string") {
    const text = value.length > 80 ? `${value.slice(0, 80)}…` : value;
    return JSON.stringify(text);
  }
  if (type === "number" || type === "boolean") return String(value);
  if (type === "null") return "null";
  return String(value);
}

export async function copyText(text) {
  const value = String(text || "");
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch { }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export function saveAsJsonFile(content, filename = "data.json") {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
