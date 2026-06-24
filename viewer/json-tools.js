// ShowMeJson 纯函数工具集：宽松解析、错误定位、格式转换、结构对比。
// 全部挂载到 window.JsonTools，供 viewer.js 调用，保持无副作用、可单测。
(function () {
  "use strict";

  // 字符串感知地遍历：把单引号字符串转双引号、去注释、规范裸键与 Python 字面量。
  function relaxedToStrict(src) {
    let out = "";
    let i = 0;
    const n = src.length;
    let repaired = false;

    while (i < n) {
      const c = src[i];

      // 行注释 // ...
      if (c === "/" && src[i + 1] === "/") {
        repaired = true;
        i += 2;
        while (i < n && src[i] !== "\n") i++;
        continue;
      }
      // 块注释 /* ... */
      if (c === "/" && src[i + 1] === "*") {
        repaired = true;
        i += 2;
        while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
        i += 2;
        continue;
      }
      // 双引号字符串：原样拷贝
      if (c === '"') {
        out += c;
        i++;
        while (i < n) {
          const d = src[i];
          if (d === "\\") {
            out += d + (src[i + 1] ?? "");
            i += 2;
            continue;
          }
          out += d;
          i++;
          if (d === '"') break;
        }
        continue;
      }
      // 单引号字符串：转换为合法双引号字符串
      if (c === "'") {
        repaired = true;
        out += '"';
        i++;
        while (i < n) {
          const d = src[i];
          if (d === "\\") {
            const e = src[i + 1] ?? "";
            out += e === "'" ? "'" : "\\" + e;
            i += 2;
            continue;
          }
          if (d === "'") {
            i++;
            break;
          }
          if (d === '"') {
            out += '\\"';
            i++;
            continue;
          }
          out += d;
          i++;
        }
        out += '"';
        continue;
      }
      // 标识符 / 字面量：裸键加引号；Python/JS 字面量归一化
      if (/[A-Za-z_$]/.test(c)) {
        let j = i;
        while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
        let word = src.slice(i, j);

        let k = j;
        while (k < n && /\s/.test(src[k])) k++;
        const isKey = src[k] === ":";

        if (isKey) {
          out += '"' + word + '"';
          repaired = true;
        } else {
          if (word === "True") (word = "true"), (repaired = true);
          else if (word === "False") (word = "false"), (repaired = true);
          else if (word === "None") (word = "null"), (repaired = true);
          else if (word === "NaN" || word === "Infinity" || word === "undefined")
            (word = "null"), (repaired = true);
          out += word;
        }
        i = j;
        continue;
      }

      out += c;
      i++;
    }

    return { text: out, repaired };
  }

  // 字符串感知地去掉对象/数组末尾的多余逗号。
  function dropTrailingCommas(s) {
    let out = "";
    let i = 0;
    const n = s.length;
    let changed = false;

    while (i < n) {
      const c = s[i];
      if (c === '"') {
        out += c;
        i++;
        while (i < n) {
          const d = s[i];
          if (d === "\\") {
            out += d + (s[i + 1] ?? "");
            i += 2;
            continue;
          }
          out += d;
          i++;
          if (d === '"') break;
        }
        continue;
      }
      if (c === ",") {
        let k = i + 1;
        while (k < n && /\s/.test(s[k])) k++;
        if (s[k] === "}" || s[k] === "]") {
          changed = true;
          i++;
          continue;
        }
      }
      out += c;
      i++;
    }
    return { text: out, changed };
  }

  // 多级宽松解析：严格 -> 去 XSSI/JSONP -> 注释/引号/尾逗号修复。
  function looseParseJson(raw) {
    const original = String(raw ?? "");

    try {
      return { value: JSON.parse(original), repaired: false, repairs: [] };
    } catch (_) {}

    const repairs = [];
    let t = original.replace(/^\uFEFF/, "");

    const xssi = t.match(/^\s*\)\]\}'[^\n]*\n?/);
    if (xssi) {
      t = t.slice(xssi[0].length);
      repairs.push("去除 XSSI 前缀");
    }

    const jsonp = t.match(/^\s*[\w$.]+\s*\(([\s\S]*)\)\s*;?\s*$/);
    if (jsonp) {
      t = jsonp[1];
      repairs.push("去除 JSONP 包裹");
    }

    if (repairs.length) {
      try {
        return { value: JSON.parse(t), repaired: true, repairs };
      } catch (_) {}
    }

    const r = relaxedToStrict(t);
    const dc = dropTrailingCommas(r.text);
    if (r.repaired) repairs.push("修复注释/引号/裸键");
    if (dc.changed) repairs.push("去除多余逗号");

    return { value: JSON.parse(dc.text), repaired: true, repairs, fixedText: dc.text };
  }

  // 从解析错误信息中推断出错的行/列（兼容 V8 的 position 与 line/column 文案）。
  function locateJsonError(text, err) {
    const message = String((err && err.message) || err || "");
    const src = String(text ?? "");

    let index = -1;
    const posMatch = message.match(/position\s+(\d+)/i);
    if (posMatch) index = Number(posMatch[1]);

    const lineColMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    if (index < 0 && lineColMatch) {
      return { line: Number(lineColMatch[1]), column: Number(lineColMatch[2]), index: -1, message };
    }

    if (index < 0) return { line: -1, column: -1, index: -1, message };

    let line = 1;
    let column = 1;
    const limit = Math.min(index, src.length);
    for (let i = 0; i < limit; i++) {
      if (src[i] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
    }
    return { line, column, index, message };
  }

  function typeOf(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v;
  }

  // 判断字符串是否“看起来像”可二次解析的 JSON。
  function looksLikeJsonString(v) {
    if (typeof v !== "string") return false;
    const t = v.trim();
    if (t.length < 2) return false;
    const a = t[0];
    const b = t[t.length - 1];
    return (a === "{" && b === "}") || (a === "[" && b === "]");
  }

  function tryParseJsonString(v) {
    if (!looksLikeJsonString(v)) return null;
    try {
      const parsed = JSON.parse(v);
      return parsed !== null && typeof parsed === "object" ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  // ---- 格式转换 ----

  function yamlScalar(v) {
    if (v === null) return "null";
    if (typeof v !== "string") return String(v);
    if (v === "") return '""';
    const risky =
      /[:#\-?\[\]{}&*!|>'"%@`,]/.test(v) ||
      /^\s|\s$/.test(v) ||
      /\n/.test(v) ||
      /^(true|false|null|yes|no|on|off|~)$/i.test(v) ||
      /^[+-]?[\d.]/.test(v);
    return risky ? JSON.stringify(v) : v;
  }

  function toYaml(value) {
    const hasItems = (v) => (Array.isArray(v) ? v.length : Object.keys(v).length) > 0;

    // 返回该值的多行 YAML（不含外层缩进），由调用方负责缩进/前缀。
    function build(v, indent) {
      const pad = "  ".repeat(indent);
      const lines = [];

      if (Array.isArray(v)) {
        for (const item of v) {
          if (item !== null && typeof item === "object" && hasItems(item)) {
            const sub = build(item, indent + 1);
            // 把子块第一行的缩进替换为 "- "，其余行保持缩进
            sub[0] = pad + "- " + sub[0].slice((indent + 1) * 2);
            lines.push(...sub);
          } else if (item !== null && typeof item === "object") {
            lines.push(pad + "- " + (Array.isArray(item) ? "[]" : "{}"));
          } else {
            lines.push(pad + "- " + yamlScalar(item));
          }
        }
      } else if (v !== null && typeof v === "object") {
        for (const key of Object.keys(v)) {
          const val = v[key];
          const kk = /^[A-Za-z0-9_]+$/.test(key) ? key : JSON.stringify(key);
          if (val !== null && typeof val === "object" && hasItems(val)) {
            lines.push(pad + kk + ":");
            lines.push(...build(val, indent + 1));
          } else if (val !== null && typeof val === "object") {
            lines.push(pad + kk + ": " + (Array.isArray(val) ? "[]" : "{}"));
          } else {
            lines.push(pad + kk + ": " + yamlScalar(val));
          }
        }
      } else {
        lines.push(pad + yamlScalar(v));
      }
      return lines;
    }

    return build(value, 0).join("\n");
  }

  function toCsv(value) {
    const rows = Array.isArray(value) ? value : [value];
    if (!rows.length) return "";

    const cell = (v) => {
      if (v === null || v === undefined) return "";
      let s = typeof v === "object" ? JSON.stringify(v) : String(v);
      if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    const cols = [];
    const seen = new Set();
    for (const r of rows) {
      if (r && typeof r === "object" && !Array.isArray(r)) {
        for (const k of Object.keys(r)) {
          if (!seen.has(k)) {
            seen.add(k);
            cols.push(k);
          }
        }
      }
    }

    if (!cols.length) return rows.map(cell).join("\n");

    const head = cols.map(cell).join(",");
    const body = rows
      .map((r) => cols.map((c) => cell(r && typeof r === "object" ? r[c] : "")).join(","))
      .join("\n");
    return head + "\n" + body;
  }

  function toTypeScript(value, rootName) {
    const interfaces = [];
    const pascal = (n) => {
      const s = String(n || "Root").replace(/[^A-Za-z0-9_]/g, " ");
      const parts = s.split(/\s+/).filter(Boolean);
      const name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
      return name || "T";
    };

    function tsType(v, name) {
      if (v === null) return "null";
      if (Array.isArray(v)) {
        if (!v.length) return "any[]";
        const elemTypes = new Set(v.slice(0, 50).map((item) => tsType(item, name)));
        const elem = [...elemTypes].join(" | ");
        return elemTypes.size > 1 ? `Array<${elem}>` : `${elem}[]`;
      }
      if (typeof v === "object") {
        const iname = pascal(name);
        const fields = Object.keys(v).map((k) => {
          const t = tsType(v[k], k);
          const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
          return `  ${key}: ${t};`;
        });
        interfaces.push(`interface ${iname} {\n${fields.join("\n")}\n}`);
        return iname;
      }
      if (typeof v === "number") return "number";
      if (typeof v === "boolean") return "boolean";
      return "string";
    }

    const root = tsType(value, rootName || "Root");
    if (!interfaces.length || root.endsWith("[]") || root.includes("Array<")) {
      interfaces.push(`type ${pascal(rootName || "Root")} = ${root};`);
    }
    return interfaces.join("\n\n");
  }

  // ---- 结构对比 ----

  function jsonDiff(a, b) {
    const diffs = [];

    function walk(x, y, path) {
      const tx = typeOf(x);
      const ty = typeOf(y);

      if (tx !== ty) {
        diffs.push({ type: "changed", path, a: x, b: y });
        return;
      }
      if (tx === "object") {
        const keys = new Set([...Object.keys(x || {}), ...Object.keys(y || {})]);
        for (const k of keys) {
          const inA = x && Object.prototype.hasOwnProperty.call(x, k);
          const inB = y && Object.prototype.hasOwnProperty.call(y, k);
          if (inA && !inB) diffs.push({ type: "removed", path: path.concat(k), a: x[k] });
          else if (!inA && inB) diffs.push({ type: "added", path: path.concat(k), b: y[k] });
          else walk(x[k], y[k], path.concat(k));
        }
        return;
      }
      if (tx === "array") {
        const len = Math.max(x.length, y.length);
        for (let i = 0; i < len; i++) {
          if (i >= x.length) diffs.push({ type: "added", path: path.concat(i), b: y[i] });
          else if (i >= y.length) diffs.push({ type: "removed", path: path.concat(i), a: x[i] });
          else walk(x[i], y[i], path.concat(i));
        }
        return;
      }
      if (x !== y) diffs.push({ type: "changed", path, a: x, b: y });
    }

    walk(a, b, []);
    return diffs;
  }

  window.JsonTools = {
    looseParseJson,
    locateJsonError,
    looksLikeJsonString,
    tryParseJsonString,
    toYaml,
    toCsv,
    toTypeScript,
    jsonDiff
  };
})();
