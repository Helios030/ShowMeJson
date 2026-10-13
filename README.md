# JSON 格式化显示（Chrome / Firefox 插件）

## 安装（开发者模式）

### Chrome 121+

1. 打开 Chrome → `chrome://extensions/`
2. 右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录（包含 `manifest.json` 的 `ShowMeJson/`）

### Firefox 121+

1. 打开 Firefox → `about:debugging#/runtime/this-firefox`
2. 点击「临时载入附加组件」
3. 选择项目根目录中的 `manifest.json`

临时安装的扩展会在 Firefox 重启后移除，需要重新载入。通过「从文件安装附加组件」长期安装需要 Mozilla 签名的 XPI 文件。

两个浏览器共用同一个 Manifest V3 配置和后台脚本：Chrome 使用 `background.service_worker`，Firefox 使用 `background.scripts`。此组合要求 Chrome / Firefox 121+，详见 [MDN 兼容性说明](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background#browser_support)。

## 使用

### 1) 手动粘贴 JSON

- 点击工具栏中的插件图标，打开查看页
- 粘贴 JSON 文本并格式化

### 2) 选中文本右键格式化

- 在任意网页中选中一段 JSON 文本
- 右键 →「格式化 JSON」
- 会打开一个新的美化查看页展示该段 JSON

## 查看页功能

- 树形可折叠展示、Key 排序
- 文本模式：原始/格式化切换 + 语法高亮（大文本会自动降级为纯文本以保证性能）
- 搜索/定位：输入关键字回车，右侧显示命中列表，可上一个/下一个跳转；结果面板宽度可拖拽
- 路径复制：点击树节点后可复制对应路径（类似 JSONPath）；每个节点可一键复制子树值
- 大 JSON：树形懒渲染、数组分段加载、搜索分片执行（避免卡死）
- 主题：内置 6 套配色（暗夜蓝/雾白/海盐蓝/森林绿/暮光紫/日落橙），可在设置中切换

### 增强能力

- 宽松解析与自动修复：支持注释、尾逗号、单引号、裸键、Python 风格 `True/False/None`，以及 XSSI 前缀（`)]}'`）和 JSONP 包裹
- 解析错误定位：解析失败时给出出错行/列，并在左侧高亮对应行
- 内嵌 JSON 字符串：当某个字符串本身是 JSON 时，可一键「解析」就地展开为对象/数组
- 从 URL 拉取：输入接口地址直接抓取并格式化
- 拖拽打开：把 `.json` 文件拖入查看页即可解析
- 转换 / 导出：一键转 YAML / CSV / TypeScript 接口，并支持复制或下载
- JSON 对比：粘贴两段 JSON，按路径高亮新增 / 删除 / 修改差异
- 历史记录：成功格式化后自动记录最近 20 条（去重，存于 `chrome.storage.local`），可一键重新载入、单条删除或清空
- 偏好记忆：主题、排序、搜索范围、面板宽度自动持久化

### 快捷键

- `Ctrl/Cmd + F`：聚焦搜索框
- `Ctrl/Cmd + S`：保存为 JSON 文件
- `Esc`：清空搜索 / 关闭弹窗
- `Ctrl + Shift + J`（任意网页）：格式化选中的 JSON 文本

## 已知限制

- 右键格式化只针对“选中的文本”（不会自动从页面 DOM 提取非选中内容）
- 插件不会自动检测或替换整页 JSON，可手动粘贴或选中文本后右键格式化

