# 气泡颜色扩展设计：新增 4 款渐变风格气泡

- 日期：2026-08-17
- 状态：已获用户认可（索大）
- 范围：纯前端（`app.js` + `style.css`），不涉及后端

## 背景与目标

当前"我的"弹窗中的气泡颜色提供 6 个纯色圆点（白/蓝/绿/粉/橙/紫），存储于 `app.js` 的 `BUBBLE_COLORS` 表，选中后写入 CSS 变量 `--bubble-mine` / `--bubble-mine-rgb` / `--text-bubble-mine`，经 `localStorage.bubbleColor` 持久化，默认 `green`。

目标：新增 4 款渐变"混合颜色"气泡 —— **赛博朋克、海洋、田园、星空**，并将配色表重构为统一的「类型 + 多色停点」结构，让纯色与渐变走同一套渲染逻辑。

灰色相关：现有气泡色中并无灰色，无需删除任何色点。

## 数据结构（app.js）

`BUBBLE_COLORS` 统一为：

```js
const BUBBLE_COLORS = {
    // 纯色（现有 6 个，结构对齐新版）
    white:  { type: 'solid',    stops: ['#FFFFFF'],                        text: '#1F2329', shadow: '255, 255, 255' },
    blue:   { type: 'solid',    stops: ['#4A90E2'],                        text: '#FFFFFF', shadow: '74, 144, 226' },
    green:  { type: 'solid',    stops: ['#95EC69'],                        text: '#1F2329', shadow: '149, 236, 105' },
    pink:   { type: 'solid',    stops: ['#FF9EC7'],                        text: '#4A1F33', shadow: '255, 158, 199' },
    orange: { type: 'solid',    stops: ['#FFB35C'],                        text: '#4A2C10', shadow: '255, 179, 92' },
    purple: { type: 'solid',    stops: ['#B89AFF'],                        text: '#FFFFFF', shadow: '184, 154, 255' },
    // 新增 4 款渐变
    cyber:  { type: 'gradient', stops: ['#FF2E97', '#7C4DFF', '#00E5FF'], text: '#FFFFFF', shadow: '124, 77, 255' },
    ocean:  { type: 'gradient', stops: ['#2E9FFF', '#0066FF', '#0051D5'], text: '#FFFFFF', shadow: '0, 102, 255' },
    meadow: { type: 'gradient', stops: ['#9CCC65', '#7CB342', '#689F38'], text: '#FFFFFF', shadow: '124, 179, 66' },
    galaxy: { type: 'gradient', stops: ['#7C4DFF', '#5B7CFF', '#40C4FF'], text: '#FFFFFF', shadow: '91, 124, 255' },
};
```

- `type`：`solid`（纯色）或 `gradient`（渐变）
- `stops`：色停点数组。纯色 1 个；渐变 3 个（起/中/末）
- `text`：气泡内文字颜色
- `shadow`：`--bubble-mine-rgb` 用的 `r, g, b` 字符串，渐变取中间停点

## 渲染逻辑（app.js）

新增辅助函数：

```js
function bubbleBackground(key) {
    const cfg = BUBBLE_COLORS[key] || BUBBLE_COLORS.green;
    if (cfg.type === 'gradient') {
        return 'linear-gradient(135deg, ' + cfg.stops[0] + ' 0%, ' + cfg.stops[1] + ' 55%, ' + cfg.stops[2] + ' 100%)';
    }
    return cfg.stops[0];
}
```

三处消费点全部改用它：

1. `loadSavedTheme()`（约 app.js:3039-3043）—— 初始化时恢复气泡色，提前执行避免闪烁
2. `applyBubbleColor(colorKey)`（约 app.js:3076-3086）—— 点选色点时切换
3. `buildBubbleColorDot(key, label)`（约 app.js:2701）—— 设置面板色点圆的背景

写入的 CSS 变量不变：

- `--bubble-mine` ← `bubbleBackground(key)`（纯色值或渐变值；`style.css` 中 `.msg-row.mine .msg-bubble.text { background: var(--bubble-mine); }` 对两者原生生效）
- `--bubble-mine-rgb` ← `cfg.shadow`
- `--text-bubble-mine` ← `cfg.text`

## 4 款渐变的设计意图

| key | 风格 | 渐变（135°） | 文字 | 设计意图 |
|---|---|---|---|---|
| `cyber` | 赛博朋克 | `#FF2E97 → #7C4DFF → #00E5FF` | 白 | 强对比三色，呼应科技主题的霓虹青 `#00E5FF`，落点在青色贴近发送按钮 |
| `ocean` | 海洋 | `#2E9FFF → #0066FF → #0051D5` | 白 | 沉稳的双蓝过渡，四主题全适配 |
| `meadow` | 田园 | `#9CCC65 → #7CB342 → #689F38` | 白 | 复用田园主题 `--accent-grad` 配方，配田园主题最协调 |
| `galaxy` | 星空 | `#7C4DFF → #5B7CFF → #40C4FF` | 白 | 梦幻星云感，从科技主题紫色 `#7C4DFF` 出发滑向亮蓝 |

渐变角度 135° 与现有 `--accent-grad` 一致；阴影色取中间停点，保证光晕观感居中协调。

## 设置面板布局（style.css + app.js）

- 色点从 6 个增加到 10 个，modal 内宽（420px − padding 48px = 372px）单行放不下
- `.bubble-color-row`（style.css:1567）加 `flex-wrap: wrap`，自然换为 5 + 5 两行（每行 5×36px + 4×10px = 220px，居中），零 JS 布局代码
- 新色点标签用 emoji：`cyber`「⚡」、`ocean`「🌊」、`meadow`「🌿」、`galaxy`「✨」；旧 6 个保留原单字（白/蓝/绿/粉/橙/紫）；hover `title` 提示风格全名（赛博朋克/海洋/田园/星空）
- `openMyInfoModal()` 色点行（约 app.js:2678-2685）追加 4 个 `buildBubbleColorDot` 调用

## 错误处理 / 兼容性

- 旧 `localStorage.bubbleColor` 值（6 个纯色 key）直接命中新表，无迁移成本
- 未知 key 一律回退 `green`（`loadSavedTheme` / `applyBubbleColor` 现有逻辑保留；`buildBubbleColorDot` 顺手补 `|| BUBBLE_COLORS.green` 兜底，与另两处对齐）
- `style.css:59` 的 `--bubble-mine-grad` 目前无引用，本设计不依赖、不改动它
- 后端、消息协议、存储结构零改动

## 测试点（手动验证，纯前端视觉改动）

1. 刷新页面：气泡颜色恢复上次选择，无闪烁
2. 依次点 10 个色点：气泡背景即时切换；渐变正确渲染；文字色可读；光晕阴影跟随变色
3. 色点行两行布局居中、hover 放大、选中态描边正常
4. 四主题 × 10 气泡色抽查：赛博配黑夜/科技、田园配田园等重点组合无违和
5. 我方文件气泡（`.msg-bubble.file` 复用 `--bubble-mine`）渐变正常
6. Android WebView 下渐变 + `backdrop-filter` 渲染正常（项目跑在安卓壳里）

## 改动文件清单

| 文件 | 改动 |
|---|---|
| `src/main/resources/static/js/app.js` | 重构 `BUBBLE_COLORS`；新增 `bubbleBackground()`；`loadSavedTheme` / `applyBubbleColor` / `buildBubbleColorDot` 适配；`openMyInfoModal` 追加 4 色点 |
| `src/main/resources/static/css/style.css` | `.bubble-color-row` 加 `flex-wrap: wrap`（仅此一处） |
