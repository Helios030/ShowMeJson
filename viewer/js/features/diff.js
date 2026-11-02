import { els } from "../core/dom.js";
import { state, workspacePanels } from "../core/state.js";
import { jsonHighlight, pathToDisplay, pathToKey } from "../core/utils.js";
import { setPanelVisible, showToast } from "../core/ui.js";

let diffRenderContext = null;

export function toggleComparePanel() {
  const show = !workspacePanels.compare;
  if (show && !els.diffA.value && !els.diffB.value && !diffRenderContext) {
    els.diffA.value = state.prettyText || "";
    els.diffSummary.textContent = state.prettyText ? "当前文档已填入版本 A" : "";
    els.diffInputs.classList.remove("hidden");
    els.diffEmpty.classList.remove("hidden");
    els.diffView.classList.add("hidden");
    els.btnToggleDiffInputs.classList.add("hidden");
    els.btnRunDiff.textContent = "开始对比";
  }
  setPanelVisible("compare", show);
  if (show && !diffRenderContext) setTimeout(() => els.diffB.focus(), 80);
}

function diffValueText(value) {
  if (value === undefined) return "—";
  const text = JSON.stringify(value);
  return text && text.length > 120 ? text.slice(0, 120) + "…" : text;
}

function buildDiffLines(value) {
  const lines = [];
  function append(current, path, depth, prefix, suffix) {
    const pad = "  ".repeat(depth);
    if (Array.isArray(current)) {
      if (!current.length) {
        lines.push({ path, text: `${pad}${prefix}[]${suffix}` });
        return;
      }
      lines.push({ path, text: `${pad}${prefix}[` });
      current.forEach((item, index) => append(item, path.concat(index), depth + 1, "", index < current.length - 1 ? "," : ""));
      lines.push({ path, text: `${pad}]${suffix}`, closing: true });
      return;
    }

    if (current !== null && typeof current === "object") {
      const keys = Object.keys(current);
      if (!keys.length) {
        lines.push({ path, text: `${pad}${prefix}{}${suffix}` });
        return;
      }
      lines.push({ path, text: `${pad}${prefix}{` });
      keys.forEach((key, index) => {
        append(current[key], path.concat(key), depth + 1, `${JSON.stringify(key)}: `, index < keys.length - 1 ? "," : "");
      });
      lines.push({ path, text: `${pad}}${suffix}`, closing: true });
      return;
    }
    lines.push({ path, text: `${pad}${prefix}${JSON.stringify(current) ?? "null"}${suffix}` });
  }
  append(value, [], 0, "", "");
  return lines;
}

function createDiffMarkMap(diffs, side) {
  const marks = new Map();
  for (const diff of diffs) {
    const applies = diff.type === "changed" ||
      (diff.type === "added" && side === "b") ||
      (diff.type === "removed" && side === "a");
    if (applies) marks.set(pathToKey(diff.path), diff.type);
  }
  return marks;
}

function getDiffLineMark(path, marks) {
  for (let depth = path.length; depth >= 0; depth--) {
    const mark = marks.get(pathToKey(path.slice(0, depth)));
    if (mark) return mark;
  }
  return "";
}

function renderFormattedDiff(container, value, diffs, side) {
  const lines = buildDiffLines(value);
  const marks = createDiffMarkMap(diffs, side);
  const pathIndex = new Map();
  const fragment = document.createDocumentFragment();
  container.innerHTML = "";

  for (const line of lines) {
    const row = document.createElement("div");
    const key = pathToKey(line.path);
    row.className = "diff-code-line";
    row.dataset.pathKey = key;
    row.innerHTML = jsonHighlight(line.text);
    const mark = getDiffLineMark(line.path, marks);
    if (mark) row.classList.add(mark);
    if (!pathIndex.has(key)) pathIndex.set(key, row);
    fragment.appendChild(row);
  }
  container.appendChild(fragment);
  return { pathIndex, container };
}

function findDiffLine(view, path) {
  for (let depth = path.length; depth >= 0; depth--) {
    const line = view.pathIndex.get(pathToKey(path.slice(0, depth)));
    if (line) return { line, exact: depth === path.length };
  }
  return null;
}

function focusDiffResult(index) {
  const diff = diffRenderContext?.diffs?.[index];
  if (!diff) return;

  els.diffResult.querySelectorAll(".diff-row").forEach((row) => {
    const active = Number(row.dataset.diffIndex) === index;
    row.classList.toggle("active", active);
    if (active) row.setAttribute("aria-current", "true");
    else row.removeAttribute("aria-current");
  });

  [diffRenderContext.a, diffRenderContext.b].forEach((view) => {
    view.container.querySelectorAll(".diff-code-line.active").forEach((line) => {
      line.classList.remove("active");
      if (line.dataset.contextDiff) {
        line.classList.remove(line.dataset.contextDiff);
        delete line.dataset.contextDiff;
      }
    });

    const target = findDiffLine(view, diff.path);
    if (!target) return;
    if (!target.exact) {
      target.line.classList.add(diff.type);
      target.line.dataset.contextDiff = diff.type;
    }
    target.line.classList.add("active");
    target.line.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

export function runDiff() {
  let a;
  let b;
  try {
    a = window.JsonTools.looseParseJson(els.diffA.value).value;
  } catch (error) {
    showToast("A 解析失败：" + String(error?.message || error), "error", 3000);
    els.diffA.focus();
    return;
  }
  try {
    b = window.JsonTools.looseParseJson(els.diffB.value).value;
  } catch (error) {
    showToast("B 解析失败：" + String(error?.message || error), "error", 3000);
    els.diffB.focus();
    return;
  }

  const diffs = window.JsonTools.jsonDiff(a, b);
  diffRenderContext = {
    diffs,
    a: renderFormattedDiff(els.diffFormattedA, a, diffs, "a"),
    b: renderFormattedDiff(els.diffFormattedB, b, diffs, "b")
  };
  els.diffResult.innerHTML = "";
  els.diffEmpty.classList.add("hidden");
  els.diffView.classList.remove("hidden");
  els.diffInputs.classList.add("hidden");
  els.btnToggleDiffInputs.classList.remove("hidden");
  els.btnToggleDiffInputs.textContent = "编辑输入";
  els.btnRunDiff.textContent = "重新对比";

  const counts = { added: 0, removed: 0, changed: 0 };
  diffs.forEach((diff) => counts[diff.type]++);
  els.diffSummary.textContent = diffs.length
    ? `${diffs.length} 处差异 · 新增 ${counts.added} · 删除 ${counts.removed} · 修改 ${counts.changed}`
    : "两段 JSON 完全一致";

  if (!diffs.length) {
    els.diffResult.innerHTML = `<div class="diff-empty"><strong>没有差异</strong><span>两个文档的结构和值完全一致</span></div>`;
    return;
  }

  const tagText = { added: "新增", removed: "删除", changed: "修改" };
  const fragment = document.createDocumentFragment();
  diffs.forEach((diff, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `diff-row ${diff.type}`;
    row.dataset.diffIndex = String(index);
    row.setAttribute("aria-label", `定位到 ${pathToDisplay(diff.path)}，${tagText[diff.type]}`);

    const tag = document.createElement("span");
    tag.className = "diff-tag";
    tag.textContent = tagText[diff.type];
    const path = document.createElement("span");
    path.className = "diff-path";
    path.textContent = pathToDisplay(diff.path);
    const values = document.createElement("span");
    values.className = "diff-vals";
    if (diff.type === "changed") values.textContent = `${diffValueText(diff.a)} → ${diffValueText(diff.b)}`;
    else if (diff.type === "added") values.textContent = diffValueText(diff.b);
    else values.textContent = diffValueText(diff.a);
    const jump = document.createElement("span");
    jump.className = "diff-jump-icon";
    jump.textContent = "↗";

    row.append(tag, path, values, jump);
    row.addEventListener("click", () => focusDiffResult(index));
    fragment.appendChild(row);
  });
  els.diffResult.appendChild(fragment);
}
