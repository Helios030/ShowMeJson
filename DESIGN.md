# ShowMeJson Design System

## 1. Atmosphere & Identity

ShowMeJson is a compact developer workbench for reading, repairing, searching, and exporting JSON. It should feel calm, dense, and trustworthy: a tool that can stay open for long sessions without visual fatigue. The signature is theme-aware syntax clarity, where every palette has matching JSON token colors instead of borrowing one dark-mode highlight set.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/page | `--bg` | `#edf2f8` | `#0b1020` | App background |
| Surface/panel | `--panel` | `#f8fafc` | `#111827` | Split panes and modals |
| Surface/primary | `--bg-primary` | `#ffffff` | `#101828` | Focused panels and content surfaces |
| Surface/secondary | `--bg-secondary` | `#f3f6fb` | `#172033` | Secondary panels |
| Surface/tertiary | `--bg-tertiary` | `#e8edf5` | `#202b41` | Segments, toggles, raised controls |
| Text/primary | `--text` | `#172033` | `#f4f7fb` | Main UI text |
| Text/secondary | `--text-dim` | `#475569` | `#cbd5e1` | Secondary UI text |
| Text/muted | `--muted` | `#64748b` | `#8ea0b8` | Metadata and hints |
| Border/default | `--border` | `rgba(100, 116, 139, 0.22)` | `rgba(148, 163, 184, 0.22)` | Dividers and outlines |
| Accent/primary | `--accent` | `#3b82f6` | `#7c9cff` | Active states and focus |
| Accent/secondary | `--accent-2` | `#2563eb` | `#a8c0ff` | Secondary accent text |
| Accent/hover | `--accent-hover` | `#1d4ed8` | `#637ff2` | Hover states |
| Code/surface | `--code` | `#f8fafc` | `#0f172a` | JSON editor and preformatted output |
| Status/success | `--success` | `#059669` | `#34d399` | Valid JSON and additions |
| Status/warning | `--warning` | `#d97706` | `#fbbf24` | Repairs and caution |
| Status/error | `--error` | `#dc2626` | `#fb7185` | Invalid JSON and failures |
| Syntax/key | `--syntax-key` | `#1d4ed8` | `#7dd3fc` | Object keys |
| Syntax/string | `--syntax-string` | `#047857` | `#a7f3d0` | String values |
| Syntax/number | `--syntax-number` | `#b45309` | `#fde047` | Number values |
| Syntax/boolean | `--syntax-boolean` | `#7c3aed` | `#93c5fd` | Boolean values |
| Syntax/null | `--syntax-null` | `#64748b` | `#94a3b8` | Null values |
| Syntax/punctuation | `--syntax-punctuation` | `#64748b` | `#8ea0b8` | Braces, brackets, commas, colons |
| Syntax/structure | `--syntax-structure-line` | `rgba(100, 116, 139, 0.24)` | `rgba(255, 255, 255, 0.10)` | Tree indentation guide |

### Rules

- Theme blocks own all color decisions through CSS custom properties.
- JSON semantic colors are tokens, not hardcoded selectors.
- JS may assign semantic classes, but it must not decide theme colors.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| H3 | 18px | 600 | 1.4 | 0 | Modal headings |
| Body/sm | 14px | 400-500 | 1.5 | 0 | Buttons, labels, inputs |
| Code/body | 13px | 400 | 1.55-1.6 | 0 | JSON editor and tree |
| Caption | 12px | 500-600 | 1.4 | 0 | Metadata and badges |
| Micro | 10-11px | 500-700 | 1.3 | 0 | Compact inline actions |

### Font Stack

- Primary: `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
- Mono: `"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Source Code Pro", monospace`

### Rules

- JSON content uses the mono stack.
- Interface labels stay compact; no hero-scale type in the tool surface.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a base of **4px**.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight inline controls |
| `--space-2` | 8px | Button groups, rows |
| `--space-3` | 12px | Panels and compact forms |
| `--space-4` | 16px | Pane padding and headers |
| `--space-5` | 20px | Modal sections |
| `--space-6` | 24px | Modal gutters |

### Grid

- Layout is a resizable two-pane workbench with an optional search results pane.
- Controls must fit in the top bar without wrapping over content.

### Rules

- Use compact spacing and stable pane dimensions.
- Prefer split panes and toolbars over card-heavy layouts.

## 5. Components

### Theme Card

- **Structure**: clickable card with palette preview, name, and description.
- **Variants**: active, hover, default.
- **States**: active card uses `--accent`; preview uses `--preview-a` and `--preview-b`.

### JSON Tree Row

- **Structure**: twisty, key, punctuation, value, type label, copy action, optional parse action.
- **Variants**: selected, search-highlighted, expandable, primitive.
- **Accessibility**: clickable rows must preserve visible focus/selection state.
- **Color**: keys and primitive values use `--syntax-*` tokens.

### Raw JSON Editor

- **Structure**: contenteditable mono text surface with optional token spans.
- **States**: empty, focused, highlighted, parse-error.
- **Color**: highlighted JSON uses the same `--syntax-*` tokens as the tree.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 100-150ms | ease-out | Button and row feedback |
| Standard | 200-300ms | ease-in-out | Theme changes, modal visibility |

### Rules

- Theme changes may transition color, background, and border only.
- Interactive controls need hover and active feedback.

## 7. Depth & Surface

### Strategy

Mixed tonal-shift and restrained borders.

| Level | Value | Usage |
|-------|-------|-------|
| Subtle border | `1px solid var(--border)` | Pane dividers, controls |
| Modal shadow | `var(--shadow)` | Dialogs and floating feedback |
| Tonal surface | `--bg-*`, `--panel`, `--panel-soft` | Main app depth |
