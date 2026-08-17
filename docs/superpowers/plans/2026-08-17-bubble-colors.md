# 气泡颜色扩展（4 款渐变风格）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在"我的"弹窗气泡颜色选择中新增赛博朋克/海洋/田园/星空 4 款渐变气泡，并把 `BUBBLE_COLORS` 配色表重构为统一的「类型 + 多色停点」结构。

**Architecture:** 纯前端改动。`app.js` 中的配色表加 `type`/`stops` 字段并新增 `bubbleBackground()` 辅助函数统一生成纯色/渐变背景值，三处消费点（初始化恢复、点选切换、色点渲染）全部改用它，写入的 CSS 变量名不变；`style.css` 仅给色点行加 `flex-wrap: wrap` 适配 10 个色点的两行布局。

**Tech Stack:** 原生 JS（无构建步骤，静态资源直接由 Spring Boot 提供）、CSS 自定义属性、`localStorage` 持久化。

**Spec:** `docs/superpowers/specs/2026-08-17-bubble-colors-design.md`

## Global Constraints

- 只改 2 个文件：`src/main/resources/static/js/app.js`、`src/main/resources/static/css/style.css`；不碰后端。
- 写入的 CSS 变量名保持不变：`--bubble-mine`、`--bubble-mine-rgb`、`--text-bubble-mine`。
- 未知 `bubbleColor` key 一律回退 `green`。
- 渐变角度一律 135°，三停点位置 `0% / 55% / 100%`。
- 4 款渐变的 key 与色值（逐字照抄，不得改动）：
  - `cyber`:  `#FF2E97 → #7C4DFF → #00E5FF`，text `#FFFFFF`，shadow `124, 77, 255`
  - `ocean`:  `#2E9FFF → #0066FF → #0051D5`，text `#FFFFFF`，shadow `0, 102, 255`
  - `meadow`: `#9CCC65 → #7CB342 → #689F38`，text `#FFFFFF`，shadow `124, 179, 66`
  - `galaxy`: `#7C4DFF → #5B7CFF → #40C4FF`，text `#FFFFFF`，shadow `91, 124, 255`
- 新色点标签：`cyber`「⚡」、`ocean`「🌊」、`meadow`「🌿」、`galaxy`「✨」；`title` 提示分别为：赛博朋克、海洋、田园、星空。
- 旧 6 个纯色 key（`white`/`blue`/`green`/`pink`/`orange`/`purple`）与默认值 `green` 保持不变；`localStorage` 旧值无需迁移。
- 构建命令（bash 沙箱需 `cmd //c`）：`cmd //c "cd /d D:\myproject\ai-web-chat && .\mvnw.cmd clean package -DskipTests"`。
- ⚠️ 工作区存在**未提交**的主题系统改动（`app.js`/`style.css` 中 tech/pastoral 主题 + 粉/橙/紫气泡色）。这是同一工作流的前置改动，Task 1 第一步先将其单独提交入版本库，本计划的后续提交才能干净地只含气泡颜色改动。**禁止 `git checkout`/`git stash`/`git restore` 丢弃这些改动。**
- 本任务为纯视觉改动，无单元测试框架覆盖（前端无测试基建），验证方式为构建通过 + 手动浏览器验证清单。

---

### Task 1: 重构 BUBBLE_COLORS 表 + bubbleBackground() 辅助函数

**Files:**
- Modify: `src/main/resources/static/js/app.js:3012-3023`（初始化区块的 `BUBBLE_COLORS` 表）

**Interfaces:**
- Consumes: 无（本任务是第一个任务）
- Produces:
  - 全局常量 `BUBBLE_COLORS`，每项结构 `{ type: 'solid'|'gradient', stops: string[], text: string, shadow: string }`
  - 全局函数 `bubbleBackground(colorKey: string): string` —— 返回 CSS `background` 值（纯色 hex 或 `linear-gradient(...)`），未知 key 回退 `green`

- [ ] **Step 1: 先把工作区里未提交的主题系统改动提交入库**

⚠️ 本计划编辑 `app.js`/`style.css` 前必须先做这一步，否则主题改动会和气泡改动混进同一个提交。

```bash
cd "D:/myproject/ai-web-chat" && git add src/main/resources/static/js/app.js src/main/resources/static/css/style.css && git commit -m "feat: 主题模式扩展（科技/田园）与气泡色扩展（粉/橙/紫）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 2: 用新结构重写 BUBBLE_COLORS 表并新增 bubbleBackground()**

把 app.js:3016-3023 现有内容：

```js
const BUBBLE_COLORS = {
    white:  { value: '#ffffff', text: '#1f2329', rgb: '255, 255, 255' },
    blue:   { value: '#4a90e2', text: '#ffffff', rgb: '74, 144, 226' },
    green:  { value: '#95EC69', text: '#1f2329', rgb: '149, 236, 105' },
    pink:   { value: '#FF9EC7', text: '#4a1f33', rgb: '255, 158, 199' },
    orange: { value: '#FFB35C', text: '#4a2c10', rgb: '255, 179, 92' },
    purple: { value: '#B89AFF', text: '#ffffff', rgb: '184, 154, 255' }
};
```

整体替换为：

```js
const BUBBLE_COLORS = {
    // 纯色
    white:  { type: 'solid',    stops: ['#FFFFFF'],                        text: '#1F2329', shadow: '255, 255, 255' },
    blue:   { type: 'solid',    stops: ['#4A90E2'],                        text: '#FFFFFF', shadow: '74, 144, 226' },
    green:  { type: 'solid',    stops: ['#95EC69'],                        text: '#1F2329', shadow: '149, 236, 105' },
    pink:   { type: 'solid',    stops: ['#FF9EC7'],                        text: '#4A1F33', shadow: '255, 158, 199' },
    orange: { type: 'solid',    stops: ['#FFB35C'],                        text: '#4A2C10', shadow: '255, 179, 92' },
    purple: { type: 'solid',    stops: ['#B89AFF'],                        text: '#FFFFFF', shadow: '184, 154, 255' },
    // 渐变
    cyber:  { type: 'gradient', stops: ['#FF2E97', '#7C4DFF', '#00E5FF'], text: '#FFFFFF', shadow: '124, 77, 255' },
    ocean:  { type: 'gradient', stops: ['#2E9FFF', '#0066FF', '#0051D5'], text: '#FFFFFF', shadow: '0, 102, 255' },
    meadow: { type: 'gradient', stops: ['#9CCC65', '#7CB342', '#689F38'], text: '#FFFFFF', shadow: '124, 179, 66' },
    galaxy: { type: 'gradient', stops: ['#7C4DFF', '#5B7CFF', '#40C4FF'], text: '#FFFFFF', shadow: '91, 124, 255' }
};

/** 生成气泡背景值：纯色返回 hex，渐变返回 135° 三停点 linear-gradient；未知 key 回退 green。 */
function bubbleBackground(colorKey) {
    const cfg = BUBBLE_COLORS[colorKey] || BUBBLE_COLORS.green;
    if (cfg.type === 'gradient') {
        return 'linear-gradient(135deg, ' + cfg.stops[0] + ' 0%, ' + cfg.stops[1] + ' 55%, ' + cfg.stops[2] + ' 100%)';
    }
    return cfg.stops[0];
}
```

注意：此替换**只动表和新增函数**。紧接着的 `loadSavedTheme()` IIFE 此时还引用旧字段 `cfg.value`/`cfg.rgb`，会在 Task 2 修复——本任务结束时页面 JS 有一处已知的暂时性报错，属预期中间态，不要顺手修它（任务边界）。

- [ ] **Step 3: 构建验证（JS 语法错误会导致整个 app 白屏）**

```bash
cmd //c "cd /d D:\myproject\ai-web-chat && .\mvnw.cmd clean package -DskipTests"
```

Expected: `BUILD SUCCESS`（构建只验证资源打包，页面运行时错误在 Task 2 消除）

- [ ] **Step 4: Commit**

```bash
cd "D:/myproject/ai-web-chat" && git add src/main/resources/static/js/app.js && git commit -m "refactor: BUBBLE_COLORS 重构为类型+多色停点结构，新增 bubbleBackground()

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 三处消费点适配新结构

**Files:**
- Modify: `src/main/resources/static/js/app.js:3033-3047`（`loadSavedTheme` IIFE）
- Modify: `src/main/resources/static/js/app.js:3076-3086`（`applyBubbleColor`）
- Modify: `src/main/resources/static/js/app.js:2701-2707`（`buildBubbleColorDot`）

**Interfaces:**
- Consumes: Task 1 的 `BUBBLE_COLORS`（`type`/`stops`/`text`/`shadow` 字段）与 `bubbleBackground(colorKey)` 函数
- Produces: 运行时不再引用旧字段 `value`/`rgb`；`applyBubbleColor(colorKey)` 供色点 `onclick` 调用（已有全局导出 `window.applyBubbleColor`，app.js:2978，不改）

- [ ] **Step 1: 修 loadSavedTheme（恢复上次选择，消除 Task 1 遗留的运行时报错）**

app.js:3039-3043 现有：

```js
        const bubble = localStorage.getItem('bubbleColor') || 'green';
        const cfg = BUBBLE_COLORS[bubble] || BUBBLE_COLORS.green;
        document.documentElement.style.setProperty('--bubble-mine', cfg.value);
        document.documentElement.style.setProperty('--bubble-mine-rgb', cfg.rgb);
        document.documentElement.style.setProperty('--text-bubble-mine', cfg.text);
```

替换为：

```js
        const bubble = localStorage.getItem('bubbleColor') || 'green';
        const cfg = BUBBLE_COLORS[bubble] || BUBBLE_COLORS.green;
        document.documentElement.style.setProperty('--bubble-mine', bubbleBackground(bubble));
        document.documentElement.style.setProperty('--bubble-mine-rgb', cfg.shadow);
        document.documentElement.style.setProperty('--text-bubble-mine', cfg.text);
```

- [ ] **Step 2: 修 applyBubbleColor**

app.js:3076-3086 现有：

```js
function applyBubbleColor(colorKey) {
    const cfg = BUBBLE_COLORS[colorKey] || BUBBLE_COLORS.green;
    localStorage.setItem('bubbleColor', colorKey);
    document.documentElement.style.setProperty('--bubble-mine', cfg.value);
    document.documentElement.style.setProperty('--bubble-mine-rgb', cfg.rgb);
    document.documentElement.style.setProperty('--text-bubble-mine', cfg.text);
    // 刷新选中态
    document.querySelectorAll('.bubble-color-dot').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === colorKey);
    });
}
```

替换为：

```js
function applyBubbleColor(colorKey) {
    const cfg = BUBBLE_COLORS[colorKey] || BUBBLE_COLORS.green;
    localStorage.setItem('bubbleColor', BUBBLE_COLORS[colorKey] ? colorKey : 'green');
    document.documentElement.style.setProperty('--bubble-mine', bubbleBackground(colorKey));
    document.documentElement.style.setProperty('--bubble-mine-rgb', cfg.shadow);
    document.documentElement.style.setProperty('--text-bubble-mine', cfg.text);
    // 刷新选中态
    document.querySelectorAll('.bubble-color-dot').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === colorKey);
    });
}
```

（`localStorage` 写入加合法性判断：未知 key 存 `green`，防止脏值跨会话残留。）

- [ ] **Step 3: 修 buildBubbleColorDot（色点渲染 + 兜底）**

app.js:2701-2707 现有：

```js
function buildBubbleColorDot(key, label) {
    const cfg = BUBBLE_COLORS[key];
    const selected = (localStorage.getItem('bubbleColor') || 'green') === key;
    return '<div class="bubble-color-dot' + (selected ? ' selected' : '') + '" data-color="' + key + '" ' +
        'style="background:' + cfg.value + ';color:' + cfg.text + ';" ' +
        'onclick="applyBubbleColor(\'' + key + '\')" title="' + label + '">' + label + '</div>';
}
```

替换为：

```js
function buildBubbleColorDot(key, label) {
    const cfg = BUBBLE_COLORS[key] || BUBBLE_COLORS.green;
    const selected = (localStorage.getItem('bubbleColor') || 'green') === key;
    return '<div class="bubble-color-dot' + (selected ? ' selected' : '') + '" data-color="' + key + '" ' +
        'style="background:' + bubbleBackground(key) + ';color:' + cfg.text + ';" ' +
        'onclick="applyBubbleColor(\'' + key + '\')" title="' + label + '">' + label + '</div>';
}
```

- [ ] **Step 4: 构建验证**

```bash
cmd //c "cd /d D:\myproject\ai-web-chat && .\mvnw.cmd clean package -DskipTests"
```

Expected: `BUILD SUCCESS`

- [ ] **Step 5: 浏览器手动验证**

```bash
cmd //c "cd /d D:\myproject\ai-web-chat && .\mvnw.cmd spring-boot:run"
```

打开 `http://localhost:8080`，登录后进入任一会话发一条消息，再打开"我的"弹窗：

- 控制台无 JS 报错（重点确认 Task 1 的中间态报错已消失）
- 现有 6 个纯色色点渲染正常，点选切换气泡背景即时生效
- 刷新页面后气泡颜色保持

（渐变色点此时尚未加入面板 —— Task 3 添加。）

- [ ] **Step 6: Commit**

```bash
cd "D:/myproject/ai-web-chat" && git add src/main/resources/static/js/app.js && git commit -m "refactor: 气泡颜色三处消费点接入 bubbleBackground 统一渲染

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 设置面板新增 4 个渐变色点 + 布局适配

**Files:**
- Modify: `src/main/resources/static/js/app.js:2677-2685`（`showMyInfo` 中气泡颜色行）
- Modify: `src/main/resources/static/css/style.css:1567-1570`（`.bubble-color-row`）

**Interfaces:**
- Consumes: Task 2 的 `buildBubbleColorDot(key, label)`（已支持渐变背景）与 `applyBubbleColor`
- Produces: 无（最终用户界面）

- [ ] **Step 1: 色点行追加 4 个渐变色点**

app.js:2677-2685 现有：

```js
        '<div class="setting-section-title">气泡颜色</div>' +
        '<div class="bubble-color-row">' +
            buildBubbleColorDot('white', '白') +
            buildBubbleColorDot('blue', '蓝') +
            buildBubbleColorDot('green', '绿') +
            buildBubbleColorDot('pink', '粉') +
            buildBubbleColorDot('orange', '橙') +
            buildBubbleColorDot('purple', '紫') +
        '</div>' +
```

替换为：

```js
        '<div class="setting-section-title">气泡颜色</div>' +
        '<div class="bubble-color-row">' +
            buildBubbleColorDot('white', '白') +
            buildBubbleColorDot('blue', '蓝') +
            buildBubbleColorDot('green', '绿') +
            buildBubbleColorDot('pink', '粉') +
            buildBubbleColorDot('orange', '橙') +
            buildBubbleColorDot('purple', '紫') +
            buildBubbleColorDot('cyber', '⚡') +
            buildBubbleColorDot('ocean', '🌊') +
            buildBubbleColorDot('meadow', '🌿') +
            buildBubbleColorDot('galaxy', '✨') +
        '</div>' +
```

- [ ] **Step 2: 色点行允许换行（10 个点两行布局）**

style.css:1567-1570 现有：

```css
.bubble-color-row {
    display: flex; gap: 10px; margin-top: 12px; align-items: center;
    justify-content: center;
}
```

替换为：

```css
.bubble-color-row {
    display: flex; gap: 10px; margin-top: 12px; align-items: center;
    justify-content: center; flex-wrap: wrap;
}
```

- [ ] **Step 3: 构建验证**

```bash
cmd //c "cd /d D:\myproject\ai-web-chat && .\mvnw.cmd clean package -DskipTests"
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: 浏览器手动验证（完整清单）**

```bash
cmd //c "cd /d D:\myproject\ai-web-chat && .\mvnw.cmd spring-boot:run"
```

打开 `http://localhost:8080` 逐项验证：

1. "我的"弹窗色点行显示 10 个色点，5 + 5 两行居中，不错位
2. ⚡/🌊/🌿/✨ 四个色点为渐变小圆，hover 放大、`title` 提示对应风格名
3. 依次点 4 个渐变色点：气泡背景即时变为对应渐变；文字白色可读；光晕阴影为对应中间色
4. 选中态描边（`accent` 色圆环）正常显示在当前色点上
5. 刷新页面：渐变气泡选择被恢复，无闪烁
6. 主题抽查：科技主题下点 ⚡ 和 🌌 配色协调；田园主题下点 🌿 协调；黑夜主题下点 🌊 协调
7. 我方文件消息气泡（发一个文件）渐变正常渲染
8. localStorage 写入脏值测试：控制台执行 `localStorage.setItem('bubbleColor','xxx')` 后刷新，气泡回退绿色、无报错

- [ ] **Step 5: Commit**

```bash
cd "D:/myproject/ai-web-chat" && git add src/main/resources/static/js/app.js src/main/resources/static/css/style.css && git commit -m "feat: 新增赛博朋克/海洋/田园/星空 4 款渐变气泡颜色

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 6: 推送双远端**

```bash
cd "D:/myproject/ai-web-chat" && git push
```

Expected: GitHub 与 Gitee 双远端均推送成功（origin 已配双 pushurl）。⚠️ 推送前确认工作区 `git status` 干净、本计划 3 个功能提交均在 `main` 上。
