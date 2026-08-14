// ================================================================
// eat.js — 今天吃什么模块（从 app.js 拆分）
// 依赖: escapeHtml, escapeAttr, showToast, openModal, closeModal,
//       apiPost, State（均由 app.js 提供全局作用域，无需 import）
// ================================================================

// ================================================================
// 今天吃什么模块
// ================================================================
const EAT_POOL = [
    // —— 川菜 ——
    { name: '麻辣火锅', cuisine: '川菜', emoji: '🍲', price: 80 },
    { name: '重庆小面', cuisine: '川菜', emoji: '🌶️', price: 16 },
    { name: '宫保鸡丁', cuisine: '川菜', emoji: '🥜', price: 32 },
    { name: '鱼香肉丝', cuisine: '川菜', emoji: '🥕', price: 28 },
    { name: '酸菜鱼', cuisine: '川菜', emoji: '🐟', price: 58 },
    { name: '麻辣香锅', cuisine: '川菜', emoji: '🍳', price: 50 },
    { name: '水煮鱼', cuisine: '川菜', emoji: '🐟', price: 68 },
    { name: '毛血旺', cuisine: '川菜', emoji: '🌶️', price: 48 },
    { name: '麻婆豆腐', cuisine: '川菜', emoji: '🍲', price: 22 },
    { name: '回锅肉', cuisine: '川菜', emoji: '🥩', price: 32 },
    { name: '水煮肉片', cuisine: '川菜', emoji: '🥩', price: 36 },
    { name: '辣子鸡', cuisine: '川菜', emoji: '🍗', price: 42 },
    { name: '夫妻肺片', cuisine: '川菜', emoji: '🥩', price: 38 },
    { name: '鱼香茄子', cuisine: '川菜', emoji: '🍆', price: 22 },
    { name: '担担面', cuisine: '川菜', emoji: '🍜', price: 18 },
    { name: '重庆酸辣粉', cuisine: '川菜', emoji: '🍜', price: 15 },

    // —— 湖南 ——
    { name: '剁椒鱼头', cuisine: '湖南', emoji: '🐟', price: 58 },
    { name: '辣椒炒肉', cuisine: '湖南', emoji: '🥩', price: 28 },
    { name: '小炒黄牛肉', cuisine: '湖南', emoji: '🥩', price: 38 },
    { name: '长沙臭豆腐', cuisine: '湖南', emoji: '🧈', price: 12 },

    // —— 江浙 ——
    { name: '小笼包', cuisine: '江浙', emoji: '🥟', price: 25 },
    { name: '生煎包', cuisine: '江浙', emoji: '🥟', price: 20 },
    { name: '鲜肉馄饨', cuisine: '江浙', emoji: '🥣', price: 18 },
    { name: '糖醋排骨', cuisine: '江浙', emoji: '🍖', price: 38 },
    { name: '东坡肉', cuisine: '江浙', emoji: '🥩', price: 45 },
    { name: '西湖醋鱼', cuisine: '江浙', emoji: '🐟', price: 48 },
    { name: '葱油拌面', cuisine: '江浙', emoji: '🍜', price: 12 },
    { name: '蟹粉小笼', cuisine: '江浙', emoji: '🥟', price: 38 },

    // —— 本帮菜 ——
    { name: '红烧肉', cuisine: '本帮菜', emoji: '🥩', price: 35 },

    // —— 淮扬菜 ——
    { name: '扬州炒饭', cuisine: '淮扬菜', emoji: '🍚', price: 18 },
    { name: '大煮干丝', cuisine: '淮扬菜', emoji: '🥢', price: 28 },
    { name: '狮子头', cuisine: '淮扬菜', emoji: '🍖', price: 32 },

    // —— 粤菜 ——
    { name: '煲仔饭', cuisine: '粤菜', emoji: '🍚', price: 30 },
    { name: '蜜汁叉烧', cuisine: '粤菜', emoji: '🍖', price: 32 },
    { name: '广式早茶', cuisine: '粤菜', emoji: '🥢', price: 55 },
    { name: '白切鸡', cuisine: '粤菜', emoji: '🍗', price: 45 },
    { name: '肠粉', cuisine: '粤菜', emoji: '🥢', price: 15 },
    { name: '虾饺', cuisine: '粤菜', emoji: '🥟', price: 25 },
    { name: '烧鹅', cuisine: '粤菜', emoji: '🍗', price: 60 },

    // —— 闽菜 ——
    { name: '沙茶面', cuisine: '闽菜', emoji: '🍜', price: 22 },
    { name: '海蛎煎', cuisine: '闽菜', emoji: '🥚', price: 18 },
    { name: '佛跳墙', cuisine: '闽菜', emoji: '🍲', price: 288 },

    // —— 京菜 ——
    { name: '北京烤鸭', cuisine: '京菜', emoji: '🦆', price: 120 },
    { name: '老北京炸酱面', cuisine: '京菜', emoji: '🍜', price: 18 },
    { name: '京酱肉丝', cuisine: '京菜', emoji: '🥩', price: 32 },

    // —— 鲁菜 ——
    { name: '糖醋鲤鱼', cuisine: '鲁菜', emoji: '🐟', price: 48 },
    { name: '把子肉', cuisine: '鲁菜', emoji: '🍖', price: 18 },

    // —— 湖北 ——
    { name: '武汉热干面', cuisine: '湖北', emoji: '🍜', price: 15 },
    { name: '莲藕排骨汤', cuisine: '湖北', emoji: '🍲', price: 32 },

    // —— 北方 ——
    { name: '家常饺子', cuisine: '北方', emoji: '🥟', price: 22 },
    { name: '锅贴', cuisine: '北方', emoji: '🥟', price: 18 },
    { name: '韭菜盒子', cuisine: '北方', emoji: '🥟', price: 12 },
    { name: '老北京卤煮', cuisine: '北方', emoji: '🥣', price: 22 },
    { name: '驴肉火烧', cuisine: '北方', emoji: '🥙', price: 15 },

    // —— 北方早点 ——
    { name: '煎饼果子', cuisine: '北方早点', emoji: '🥞', price: 10 },

    // —— 西北 ——
    { name: '羊肉泡馍', cuisine: '西北', emoji: '🥣', price: 35 },
    { name: '肉夹馍', cuisine: '西北', emoji: '🥙', price: 12 },
    { name: '西安凉皮', cuisine: '西北', emoji: '🥗', price: 14 },
    { name: '新疆大盘鸡', cuisine: '西北', emoji: '🍗', price: 78 },
    { name: '新疆烤包子', cuisine: '西北', emoji: '🥟', price: 10 },

    // —— 西北面食 ——
    { name: '兰州拉面', cuisine: '西北面食', emoji: '🍜', price: 18 },
    { name: 'BiangBiang面', cuisine: '西北面食', emoji: '🍜', price: 22 },
    { name: '油泼面', cuisine: '西北面食', emoji: '🍜', price: 18 },

    // —— 东北菜 ——
    { name: '锅包肉', cuisine: '东北菜', emoji: '🍖', price: 38 },
    { name: '地三鲜', cuisine: '东北菜', emoji: '🍆', price: 22 },
    { name: '小鸡炖蘑菇', cuisine: '东北菜', emoji: '🍲', price: 48 },

    // —— 广西 ——
    { name: '螺蛳粉', cuisine: '广西', emoji: '🍜', price: 22 },
    { name: '桂林米粉', cuisine: '广西', emoji: '🍜', price: 16 },

    // —— 云南 ——
    { name: '过桥米线', cuisine: '云南', emoji: '🍜', price: 28 },
    { name: '云南汽锅鸡', cuisine: '云南', emoji: '🍗', price: 58 },
    { name: '云南菌子火锅', cuisine: '云南', emoji: '🍲', price: 88 },

    // —— 贵州 ——
    { name: '贵州酸汤鱼', cuisine: '贵州', emoji: '🐟', price: 58 },

    // —— 台湾 ——
    { name: '台湾卤肉饭', cuisine: '台湾', emoji: '🍚', price: 22 },
    { name: '台湾三杯鸡', cuisine: '台湾', emoji: '🍗', price: 45 },

    // —— 日料 ——
    { name: '寿司套餐', cuisine: '日料', emoji: '🍣', price: 88 },
    { name: '日式咖喱饭', cuisine: '日料', emoji: '🍛', price: 35 },
    { name: '天妇罗', cuisine: '日料', emoji: '🍤', price: 58 },
    { name: '日式拉面', cuisine: '日料', emoji: '🍜', price: 42 },
    { name: '鳗鱼饭', cuisine: '日料', emoji: '🍱', price: 68 },
    { name: '寿喜烧', cuisine: '日料', emoji: '🍲', price: 98 },

    // —— 韩料 ——
    { name: '韩式炸鸡', cuisine: '韩料', emoji: '🍗', price: 58 },
    { name: '石锅拌饭', cuisine: '韩料', emoji: '🍲', price: 35 },
    { name: '韩式部队锅', cuisine: '韩料', emoji: '🍲', price: 78 },
    { name: '韩式烤肉', cuisine: '韩料', emoji: '🥩', price: 128 },
    { name: '韩式泡菜汤', cuisine: '韩料', emoji: '🍲', price: 38 },

    // —— 东南亚 ——
    { name: '越南河粉', cuisine: '东南亚', emoji: '🍜', price: 38 },
    { name: '冬阴功汤', cuisine: '东南亚', emoji: '🍲', price: 48 },
    { name: '海南鸡饭', cuisine: '东南亚', emoji: '🍗', price: 32 },
    { name: '印尼炒饭', cuisine: '东南亚', emoji: '🍚', price: 35 },
    { name: '泰式咖喱鸡', cuisine: '东南亚', emoji: '🍛', price: 48 },
    { name: '越南春卷', cuisine: '东南亚', emoji: '🥗', price: 28 },

    // —— 西餐 ——
    { name: '披萨', cuisine: '西餐', emoji: '🍕', price: 80 },
    { name: '意大利面', cuisine: '西餐', emoji: '🍝', price: 45 },
    { name: '牛排套餐', cuisine: '西餐', emoji: '🥩', price: 120 },
    { name: '墨西哥卷饼', cuisine: '西餐', emoji: '🌯', price: 38 },
    { name: '凯撒沙拉', cuisine: '西餐', emoji: '🥗', price: 32 },

    // —— 西式快餐 ——
    { name: '麦当劳', cuisine: '西式快餐', emoji: '🍔', price: 35 },
    { name: '肯德基', cuisine: '西式快餐', emoji: '🍗', price: 40 },

    // —— 快餐 ——
    { name: '麻辣烫', cuisine: '快餐', emoji: '🍲', price: 25 },
    { name: '蛋炒饭', cuisine: '快餐', emoji: '🍚', price: 15 },
    { name: '沙县小吃', cuisine: '快餐', emoji: '🍜', price: 15 },
    { name: '隆江猪脚饭', cuisine: '快餐', emoji: '🍚', price: 25 },
    { name: '沙县拌面', cuisine: '快餐', emoji: '🍜', price: 12 },

    // —— 快餐简餐 ——
    { name: '黄焖鸡米饭', cuisine: '快餐简餐', emoji: '🍛', price: 22 },
    { name: '盖浇饭', cuisine: '快餐简餐', emoji: '🍚', price: 18 },
    { name: '卤肉饭', cuisine: '快餐简餐', emoji: '🍚', price: 18 },

    // —— 夜宵 ——
    { name: '东北烧烤', cuisine: '夜宵', emoji: '🍢', price: 60 },
    { name: '小龙虾', cuisine: '夜宵', emoji: '🦞', price: 120 },
    { name: '万州烤鱼', cuisine: '夜宵', emoji: '🐟', price: 88 },
    { name: '蒜蓉烤生蚝', cuisine: '夜宵', emoji: '🦪', price: 58 },
];

// 用餐时段标签： breakfast / lunch / dinner / snack
// 午餐和晚餐高度重合，所有菜默认归入 lunch+dinner；早餐和夜宵通过下面的集合精确标注
const EAT_MEALS = [
    { key: 'all',          name: '全部',   emoji: '' },
    { key: 'breakfast',    name: '早餐',   emoji: '🌅' },
    { key: 'lunch',        name: '午餐',   emoji: '☀️' },
    { key: 'dinner',       name: '晚餐',   emoji: '🌆' },
    { key: 'snack',        name: '夜宵',   emoji: '🌃' },
];

// 适合早餐的菜名集合（清淡 / 早点 / 简餐）
const BREAKFAST_NAMES = new Set([
    '煎饼果子', '肉夹馍', '武汉热干面', '小笼包', '生煎包', '肠粉', '虾饺',
    '广式早茶', '台湾卤肉饭', '卤肉饭', '葱油拌面', '担担面', '重庆小面',
    '油泼面', 'BiangBiang面', '老北京炸酱面', '沙县拌面', '韭菜盒子',
    '锅贴', '家常饺子', '海蛎煎', '蛋炒饭', '扬州炒饭',
    '麦当劳', '肯德基', '沙县小吃', '桂林米粉', '过桥米线', '螺蛳粉',
]);

// 适合夜宵的菜名集合（重口味 / 烧烤 / 麻辣 / 解馋）
const SNACK_NAMES = new Set([
    '东北烧烤', '小龙虾', '万州烤鱼', '蒜蓉烤生蚝', '老北京卤煮',
    '长沙臭豆腐', '麻辣烫', '麻辣香锅', '新疆烤包子',
    '韩式炸鸡', '韩式部队锅', '麻辣火锅', '毛血旺', '重庆酸辣粉',
]);

// 为池中每道菜计算 meals 字段
function initEatMeals() {
    EAT_POOL.forEach(d => {
        if (d.meals) return;
        const m = ['lunch', 'dinner'];
        if (BREAKFAST_NAMES.has(d.name)) m.push('breakfast');
        if (SNACK_NAMES.has(d.name)) m.push('snack');
        // 夜宵大类菜品默认也归夜宵
        if (d.cuisine === '夜宵') m.push('snack');
        d.meals = m;
    });
}

const EatState = {
    queue: [],
    blocked: [],
    disliked: [],
    liked: [],
    history: [],
    currentMeal: 'all',
    currentCategory: 'all',
    mode: 'swipe',
    initialized: false,
};

// 大类映射：cuisine → category。chip 顺序就是这里的展示顺序
// 注：夜宵类菜品通过时段 chip（凌晨/夜宵）筛选，菜系层不再单列
const EAT_CATEGORIES = [
    { key: 'all',   name: '全部' },
    { key: 'liked', name: '我喜欢', isSpecial: true },
    { key: 'cn',    name: '中式',   cuisines: ['川菜','本帮菜','淮扬菜','京菜','湖北','湖南','江浙','粤菜','台湾','鲁菜','闽菜','东北菜'] },
    { key: 'north', name: '北方',   cuisines: ['北方','北方早点','西北','西北面食'] },
    { key: 'sw',    name: '西南',   cuisines: ['广西','云南','贵州'] },
    { key: 'jk',    name: '日韩',   cuisines: ['日料','韩料'] },
    { key: 'west',  name: '西式',   cuisines: ['西餐','西式快餐'] },
    { key: 'sea',   name: '东南亚', cuisines: ['东南亚'] },
    { key: 'fast',  name: '快餐',   cuisines: ['快餐','快餐简餐'] },
];

function getEatPoolForCategory(cat) {
    // 不论哪个分类，已拉黑/已不喜欢的菜都不出现（"我喜欢"页除外，那里只看 liked）
    const isLikedView = cat === 'liked';
    const baseFilter = d => isLikedView
        ? EatState.liked.includes(d.name)
        : (!EatState.blocked.includes(d.name) && !EatState.disliked.includes(d.name));
    let pool;
    if (isLikedView) {
        pool = EAT_POOL.filter(baseFilter);
    } else {
        const catObj = EAT_CATEGORIES.find(c => c.key === cat);
        if (!catObj || !catObj.cuisines) {
            pool = EAT_POOL.filter(baseFilter);
        } else {
            pool = EAT_POOL.filter(d => baseFilter(d) && catObj.cuisines.includes(d.cuisine));
        }
    }
    // 时段双重过滤
    if (EatState.currentMeal && EatState.currentMeal !== 'all') {
        pool = pool.filter(d => d.meals && d.meals.includes(EatState.currentMeal));
    }
    return pool;
}

function loadEatData() {
    try {
        EatState.blocked = JSON.parse(localStorage.getItem('eat_blocked') || '[]');
        EatState.disliked = JSON.parse(localStorage.getItem('eat_disliked') || '[]');
        EatState.liked = JSON.parse(localStorage.getItem('eat_liked') || '[]');
        EatState.history = JSON.parse(localStorage.getItem('eat_history') || '[]');
        EatState.mode = localStorage.getItem('eat_mode') === 'dice' ? 'dice' : 'swipe';
    } catch {
        EatState.blocked = []; EatState.disliked = []; EatState.liked = []; EatState.history = [];
    }
}

function saveEatData() {
    try {
        localStorage.setItem('eat_blocked', JSON.stringify(EatState.blocked));
        localStorage.setItem('eat_disliked', JSON.stringify(EatState.disliked));
        localStorage.setItem('eat_liked', JSON.stringify(EatState.liked));
        localStorage.setItem('eat_history', JSON.stringify(EatState.history));
        localStorage.setItem('eat_mode', EatState.mode || 'swipe');
    } catch {}
}

function pickRandomDish() {
    const pool = getEatPoolForCategory(EatState.currentCategory);
    if (pool.length === 0) return null;
    // 避免与队列中已有项重复
    const inQueue = new Set(EatState.queue.map(d => d.name));
    const fresh = pool.filter(d => !inQueue.has(d.name));
    const arr = fresh.length > 0 ? fresh : pool;
    return arr[Math.floor(Math.random() * arr.length)];
}

function ensureEatQueue() {
    while (EatState.queue.length < 3) {
        const dish = pickRandomDish();
        if (!dish) break;
        EatState.queue.push(dish);
    }
}

function initEatPage() {
    loadEatData();
    initEatMeals();
    EatState.queue = [];
    if (!EatState.currentMeal) EatState.currentMeal = 'all';
    if (!EatState.currentCategory) EatState.currentCategory = 'all';
    if (!EatState.mode) EatState.mode = 'swipe';
    applyEatMode();
    renderEatMeals();
    renderEatCategories();
    renderEatCards();
}

function toggleEatMode() {
    EatState.mode = EatState.mode === 'swipe' ? 'dice' : 'swipe';
    saveEatData();
    applyEatMode();
    EatState.queue = [];
    renderEatCards();
    showToast(EatState.mode === 'dice' ? '已切换到掷骰子模式' : '已切换到滑动模式');
}

function applyEatMode() {
    const page = document.getElementById('eat-page');
    if (page) page.classList.toggle('mode-dice', EatState.mode === 'dice');
    const rollBtn = document.getElementById('eat-dice-roll-btn');
    if (rollBtn) rollBtn.style.display = EatState.mode === 'dice' ? 'inline-block' : 'none';
    const btn = document.getElementById('eat-mode-btn');
    if (btn) {
        if (EatState.mode === 'swipe') {
            // 显示骰子图标（提示点击切到 dice）
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="16" cy="16" r="1.4" fill="currentColor"/><circle cx="16" cy="8" r="1.4" fill="currentColor"/><circle cx="8" cy="16" r="1.4" fill="currentColor"/></svg>';
            btn.title = '切换到掷骰子模式';
        } else {
            // 显示卡片堆图标（提示点击切回 swipe）
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="7" width="14" height="14" rx="2"/><path d="M3 5h14"/><path d="M5 3h12"/></svg>';
            btn.title = '切换到滑动模式';
        }
    }
}

// 掷骰子：随机换一道菜，带翻转动画
function rollDice() {
    if (EatState.mode !== 'dice') return;
    const stage = document.getElementById('eat-stage');
    if (!stage) return;
    const card = stage.querySelector('.eat-card');
    if (!card || card.dataset.rolling === '1') return;
    card.dataset.rolling = '1';
    card.classList.add('dice-out');
    setTimeout(() => {
        // 抽一张新菜（尽量与当前不同）
        const currentName = EatState.queue[0] ? EatState.queue[0].name : '';
        let newDish = null;
        for (let i = 0; i < 10; i++) {
            newDish = pickRandomDish();
            if (newDish && newDish.name !== currentName) break;
        }
        if (newDish) EatState.queue[0] = newDish;
        renderEatCards();
        const newCard = stage.querySelector('.eat-card');
        if (newCard) {
            newCard.classList.add('dice-in');
            setTimeout(() => {
                newCard.classList.remove('dice-in');
                newCard.dataset.rolling = '';
            }, 360);
        }
    }, 320);
}

function renderEatMeals() {
    const container = document.getElementById('eat-meals');
    if (!container) return;
    container.innerHTML = '';
    EAT_MEALS.forEach(m => {
        const chip = document.createElement('div');
        chip.className = 'eat-chip eat-chip-meal' + (EatState.currentMeal === m.key ? ' active' : '');
        chip.textContent = (m.emoji ? m.emoji + ' ' : '') + m.name;
        chip.onclick = () => changeEatMeal(m.key);
        container.appendChild(chip);
    });
}

function changeEatMeal(meal) {
    if (EatState.currentMeal === meal) return;
    EatState.currentMeal = meal;
    EatState.queue = [];
    renderEatMeals();
    renderEatCards();
}

function renderEatCategories() {
    const container = document.getElementById('eat-categories');
    if (!container) return;
    container.innerHTML = '';
    EAT_CATEGORIES.forEach(cat => {
        const chip = document.createElement('div');
        chip.className = 'eat-chip' + (EatState.currentCategory === cat.key ? ' active' : '');
        chip.textContent = cat.name;
        chip.onclick = () => changeEatCategory(cat.key);
        container.appendChild(chip);
    });
}

function changeEatCategory(cat) {
    if (EatState.currentCategory === cat) return;
    EatState.currentCategory = cat;
    EatState.queue = [];
    renderEatCategories();
    renderEatCards();
}

function renderEatCards() {
    ensureEatQueue();
    const stage = document.getElementById('eat-stage');
    const empty = document.getElementById('eat-empty');
    stage.innerHTML = '';

    if (EatState.queue.length === 0) {
        stage.style.display = 'none';
        empty.style.display = 'block';
        const mainEl = empty.querySelector('.eat-empty-main');
        const subEl = empty.querySelector('.eat-empty-sub');
        if (EatState.currentCategory === 'liked') {
            mainEl.textContent = '还没有喜欢的菜';
            subEl.textContent = '在卡片上点击 ♥ 或右滑来添加';
        } else {
            const catObj = EAT_CATEGORIES.find(c => c.key === EatState.currentCategory);
            const catName = catObj ? catObj.name : '全部';
            mainEl.textContent =
                catName === '全部' ? '都被拉黑完啦' : '「' + catName + '」下都被拉黑完啦';
            subEl.textContent = '点击右上角刷新按钮重置';
        }
        return;
    }
    stage.style.display = '';
    empty.style.display = 'none';

    // swipe 模式渲染 3 张堆栈并绑定拖拽；dice 模式只渲染 1 张且不绑拖拽
    const visibleCount = EatState.mode === 'dice' ? 1 : 3;
    const visible = EatState.queue.slice(0, visibleCount);
    visible.slice().reverse().forEach((dish, idx) => {
        const isTop = idx === visible.length - 1;
        const card = createEatCard(dish);
        const depthFromTop = visible.length - 1 - idx;
        const scale = 1 - depthFromTop * 0.04;
        const translateY = depthFromTop * 12;
        card.style.transform = `translateY(${translateY}px) scale(${scale})`;
        card.style.zIndex = String(idx + 1);
        if (isTop && EatState.mode !== 'dice') bindEatCardDrag(card);
        stage.appendChild(card);
    });
}

function createEatCard(dish) {
    const card = document.createElement('div');
    card.className = 'eat-card';
    card.dataset.name = dish.name;
    const liked = EatState.liked.includes(dish.name);
    card.innerHTML =
        '<div class="eat-card-stamp dislike-stamp">不喜欢</div>' +
        '<div class="eat-card-stamp like-stamp">喜欢</div>' +
        '<div class="eat-card-stamp block-stamp">拉黑</div>' +
        '<div class="eat-card-visual">' +
            '<div class="eat-card-emoji">' + dish.emoji + '</div>' +
            (liked ? '<div class="eat-card-liked">♥</div>' : '') +
        '</div>' +
        '<div class="eat-card-body">' +
            '<div class="eat-card-name">' + escapeHtml(dish.name) + '</div>' +
            '<div class="eat-card-meta">' + escapeHtml(dish.cuisine) + ' · 人均 ¥' + dish.price + '</div>' +
        '</div>';
    return card;
}

function bindEatCardDrag(card) {
    let startX = 0, startY = 0;
    let currentX = 0, currentY = 0;
    let dragging = false;
    let lastTouchTime = 0; // 用于抑制 touchstart 后浏览器派发的 mousedown 模拟事件

    function getPt(e) {
        if (e.touches && e.touches.length) return e.touches[0];
        return e;
    }

    function down(e) {
        if (dragging) return;
        // 触摸发生后 500ms 内的 mousedown 视为模拟事件，忽略
        if (e.type === 'mousedown' && Date.now() - lastTouchTime < 500) return;
        if (e.type === 'touchstart') {
            lastTouchTime = Date.now();
            // 多指触发时只取第一根
            if (e.touches && e.touches.length > 1) return;
        }
        dragging = true;
        const pt = getPt(e);
        startX = pt.clientX;
        startY = pt.clientY;
        currentX = 0; currentY = 0;
        card.style.transition = 'none';
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', up);
        document.addEventListener('touchcancel', up);
    }
    function move(e) {
        if (!dragging) return;
        const pt = getPt(e);
        currentX = pt.clientX - startX;
        currentY = pt.clientY - startY;
        // 垂直方向阻尼减弱，便于上滑
        card.style.transform =
            'translate(' + currentX + 'px, ' + (currentY * 0.5) + 'px) rotate(' + (currentX * 0.06) + 'deg)';
        updateEatCardStamps(card, currentX, currentY);
        if (e.cancelable) e.preventDefault();
    }
    function up() {
        dragging = false;
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', up);
        document.removeEventListener('touchcancel', up);

        card.style.transition = 'transform 0.32s var(--ease-ios), opacity 0.28s ease';

        // 移动端阈值略放宽，触摸滑动距离通常比鼠标大
        const xThreshold = 90;
        const yThreshold = 70;
        const absX = Math.abs(currentX);
        const absY = Math.abs(currentY);
        let action = null;
        if (absX > xThreshold && absX >= absY) {
            action = currentX > 0 ? 'love' : 'dislike';
        } else if (currentY < -yThreshold && absY > absX) {
            action = 'block';
        }

        if (action) {
            flyOutEatCard(card, action);
            setTimeout(() => handleEatAction(action), 280);
        } else {
            // 回弹
            card.style.transform = '';
            clearEatCardStamps(card);
        }
    }

    card.addEventListener('mousedown', down);
    card.addEventListener('touchstart', down, { passive: true });
}

function flyOutEatCard(card, action) {
    let flyX = 0, flyY = 0;
    if (action === 'love') flyX = 600;
    else if (action === 'dislike') flyX = -600;
    else if (action === 'block') flyY = -600;
    card.style.transform = 'translate(' + flyX + 'px, ' + flyY + 'px) rotate(' + (flyX * 0.06) + 'deg)';
    card.style.opacity = '0';
}

function updateEatCardStamps(card, x, y) {
    const dislike = card.querySelector('.dislike-stamp');
    const like = card.querySelector('.like-stamp');
    const block = card.querySelector('.block-stamp');
    dislike.classList.toggle('show', x < -40 && Math.abs(x) >= Math.abs(y));
    like.classList.toggle('show', x > 40 && Math.abs(x) >= Math.abs(y));
    block.classList.toggle('show', y < -40 && Math.abs(y) > Math.abs(x));
}

function clearEatCardStamps(card) {
    card.querySelectorAll('.eat-card-stamp').forEach(s => s.classList.remove('show'));
}

function handleEatAction(action) {
    const dish = EatState.queue[0];
    if (!dish) return;
    if (action === 'love') {
        if (!EatState.liked.includes(dish.name)) {
            EatState.liked.push(dish.name);
            // 喜欢了就不再属于"不喜欢"
            EatState.disliked = EatState.disliked.filter(n => n !== dish.name);
            saveEatData();
        }
        showToast('已标记喜欢 ' + dish.name);
    } else if (action === 'dislike') {
        if (!EatState.disliked.includes(dish.name)) {
            EatState.disliked.push(dish.name);
            saveEatData();
        }
        // 不显示 toast，直接跳过更流畅
    } else if (action === 'block') {
        if (!EatState.blocked.includes(dish.name)) {
            EatState.blocked.push(dish.name);
            // 拉黑了同步从喜欢/不喜欢中移除
            EatState.liked = EatState.liked.filter(n => n !== dish.name);
            EatState.disliked = EatState.disliked.filter(n => n !== dish.name);
            saveEatData();
        }
        showToast('已拉黑 ' + dish.name);
    }
    EatState.queue.shift();
    renderEatCards();
}

// 点击底部按钮触发动作（带飞出动画）
function eatAction(action) {
    const stage = document.getElementById('eat-stage');
    const card = stage.querySelector('.eat-card:last-child');
    if (!card) return;
    if (card.dataset.flying === '1') return;
    card.dataset.flying = '1';
    card.style.transition = 'transform 0.3s var(--ease-ios), opacity 0.3s ease';
    flyOutEatCard(card, action);
    setTimeout(() => handleEatAction(action), 280);
}

// 就它了
function eatPick() {
    const dish = EatState.queue[0];
    if (!dish) {
        showToast('暂无推荐');
        return;
    }
    EatState.history.unshift({
        name: dish.name, cuisine: dish.cuisine,
        emoji: dish.emoji, price: dish.price,
        ts: Date.now()
    });
    saveEatData();
    // 仅 toast 提示，不打断滑动浏览；用户可主动点右上角时钟图标查看时间轴
    showToast('就它了：' + dish.name + '（已记录到时间轴）');
    renderEatHistory();
    EatState.queue.shift();
    renderEatCards();
}

function toggleEatHistory(forceShow) {
    const panel = document.getElementById('eat-history-panel');
    const show = forceShow !== undefined ? forceShow : !panel.classList.contains('show');
    panel.classList.toggle('show', show);
    if (show) {
        renderEatHistory();
        bindEatHistorySwipeClose();
    }
}

// 移动端：时间轴抽屉支持左滑关闭（只绑定一次）
let eatHistorySwipeBound = false;
function bindEatHistorySwipeClose() {
    if (eatHistorySwipeBound) return;
    eatHistorySwipeBound = true;
    const panel = document.getElementById('eat-history-panel');
    if (!panel) return;
    let startX = 0, currentX = 0, dragging = false;
    panel.addEventListener('touchstart', (e) => {
        if (!panel.classList.contains('show')) return;
        // 只在抽屉左侧边缘 40px 范围内开始拖拽（避免与列表横向滚动冲突）
        const t = e.touches[0];
        if (t.clientX > 40) return;
        dragging = true;
        startX = t.clientX;
        currentX = 0;
        panel.style.transition = 'none';
    }, { passive: true });
    panel.addEventListener('touchmove', (e) => {
        if (!dragging) return;
        const t = e.touches[0];
        currentX = t.clientX - startX;
        if (currentX < 0) {
            panel.style.transform = 'translateX(' + currentX + 'px)';
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });
    panel.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false;
        panel.style.transition = '';
        if (currentX < -80) {
            panel.style.transform = '';
            toggleEatHistory(false);
        } else {
            panel.style.transform = '';
        }
    });
}

function renderEatHistory() {
    const list = document.getElementById('eat-history-list');
    if (!list) return;
    list.innerHTML = '';
    if (EatState.history.length === 0) {
        list.innerHTML = '<div class="eat-history-empty">还没有吃过记录<br>点击"就它了"开始吧</div>';
        return;
    }
    const groups = {};
    EatState.history.forEach(item => {
        const key = formatEatDateKey(new Date(item.ts));
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    Object.keys(groups).forEach(key => {
        const group = document.createElement('div');
        group.className = 'eat-history-group';
        group.innerHTML = '<div class="eat-history-date">' + formatEatDateLabel(key) + '</div>';
        const items = document.createElement('div');
        items.className = 'eat-history-items';
        groups[key].forEach(item => {
            const t = new Date(item.ts);
            const hh = String(t.getHours()).padStart(2, '0');
            const mm = String(t.getMinutes()).padStart(2, '0');
            const it = document.createElement('div');
            it.className = 'eat-history-item';
            it.innerHTML =
                '<div class="eat-history-emoji">' + item.emoji + '</div>' +
                '<div class="eat-history-info">' +
                    '<div class="eat-history-name">' + escapeHtml(item.name) + '</div>' +
                    '<div class="eat-history-meta">' + escapeHtml(item.cuisine) + ' · ¥' + item.price + ' · ' + hh + ':' + mm + '</div>' +
                '</div>';
            items.appendChild(it);
        });
        group.appendChild(items);
        list.appendChild(group);
    });
}

function formatEatDateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatEatDateLabel(key) {
    const today = formatEatDateKey(new Date());
    const y = new Date(Date.now() - 86400000);
    const yKey = formatEatDateKey(y);
    if (key === today) return '今天';
    if (key === yKey) return '昨天';
    return key;
}

function openEatManage() {
    let html = '<h3>管理名单<span class="modal-close" onclick="closeModal()">×</span></h3>';
    html += renderEatManageSection('blocked', '已拉黑', '#FF3B30', "clearEatList('blocked')");
    html += renderEatManageSection('disliked', '不喜欢', '#8E8E93', "clearEatList('disliked')");
    html += '<div style="padding:12px 16px;font-size:12px;color:var(--text-secondary);text-align:center;">解除后将重新参与随机推荐</div>';
    openModal(html);
}

function renderEatManageSection(type, title, color, clearFn) {
    const list = type === 'blocked' ? EatState.blocked : EatState.disliked;
    let html = '<div class="modal-section-title" style="margin-top:8px;color:' + color + ';">' + title + ' (' + list.length + ')</div>';
    if (list.length === 0) {
        html += '<div style="padding:16px;text-align:center;color:var(--text-secondary);font-size:13px;">暂无</div>';
        return html;
    }
    html += '<div class="modal-list">';
    list.forEach(name => {
        const dish = EAT_POOL.find(d => d.name === name);
        const emoji = dish ? dish.emoji : '🍽️';
        const encoded = encodeURIComponent(name);
        html += '<div class="modal-list-item" style="padding:8px 12px;">' +
            '<div style="font-size:22px;margin-right:10px;flex-shrink:0;">' + emoji + '</div>' +
            '<div style="flex:1;min-width:0;font-size:14px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(name) + '</div>' +
            '<button class="modal-item-btn" onclick="removeEatItem(\'' + type + '\', \'' + encoded + '\')" style="margin-left:8px;padding:4px 12px;font-size:12px;border:0.5px solid var(--border-light);background:var(--bg-navbar-hover);color:var(--text-primary);border-radius:12px;cursor:pointer;">移除</button>' +
            '</div>';
    });
    html += '</div>';
    html += '<div style="text-align:center;padding:6px 0 4px;"><span onclick="' + clearFn + '" style="color:#FF3B30;font-size:12px;cursor:pointer;">全部清空</span></div>';
    return html;
}

function removeEatItem(type, encodedName) {
    const name = decodeURIComponent(encodedName);
    if (type === 'blocked') {
        EatState.blocked = EatState.blocked.filter(n => n !== name);
    } else if (type === 'disliked') {
        EatState.disliked = EatState.disliked.filter(n => n !== name);
    }
    saveEatData();
    openEatManage();
    EatState.queue = [];
    renderEatCards();
}

function clearEatList(type) {
    if (type === 'blocked') EatState.blocked = [];
    else if (type === 'disliked') EatState.disliked = [];
    saveEatData();
    openEatManage();
    EatState.queue = [];
    renderEatCards();
}

function clearEatHistory() {
    if (!confirm('确认清空所有吃过记录？')) return;
    EatState.history = [];
    saveEatData();
    renderEatHistory();
    showToast('已清空');
}

// 暴露给全局
window.eatAction = eatAction;
window.eatPick = eatPick;
window.toggleEatHistory = toggleEatHistory;
window.openEatManage = openEatManage;
window.removeEatItem = removeEatItem;
window.clearEatList = clearEatList;
window.clearEatHistory = clearEatHistory;
window.toggleEatMode = toggleEatMode;
window.rollDice = rollDice;
window.sendEatDish = sendEatDish;
window.doSendEatDishByIdx = doSendEatDishByIdx;

// 把今天的"就它了"作为一条文本消息发到当前会话
function getTodayEatItems() {
    loadEatData(); // 读最新历史，避免与吃啥页面脱节
    const todayKey = formatEatDateKey(new Date());
    return EatState.history.filter(item =>
        formatEatDateKey(new Date(item.ts)) === todayKey
    );
}

async function sendEatDish() {
    if (!State.activeChat) {
        showToast('请先选择会话');
        return;
    }
    const items = getTodayEatItems();
    if (items.length === 0) {
        showToast('今天还没有"就它了"记录，去选一个吧');
        return;
    }
    if (items.length === 1) {
        await doSendEatDish(items[0]);
        return;
    }
    // 多条：弹窗选择最近一条发送
    let html = '<h3>今天吃过 (' + items.length + ')<span class="modal-close" onclick="closeModal()">×</span></h3>';
    html += '<div style="padding:4px 16px 8px;font-size:12px;color:var(--text-secondary);">选择一条发送到当前会话</div>';
    html += '<div class="modal-list">';
    items.forEach((item, idx) => {
        const t = new Date(item.ts);
        const hh = String(t.getHours()).padStart(2, '0');
        const mm = String(t.getMinutes()).padStart(2, '0');
        html += '<div class="modal-list-item" style="padding:10px 12px;cursor:pointer;" onclick="doSendEatDishByIdx(' + idx + ')">' +
            '<div style="font-size:24px;margin-right:10px;flex-shrink:0;">' + item.emoji + '</div>' +
            '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:14px;color:var(--text-primary);">' + escapeHtml(item.name) + '</div>' +
                '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">' + escapeHtml(item.cuisine) + ' · ¥' + item.price + ' · ' + hh + ':' + mm + '</div>' +
            '</div>' +
        '</div>';
    });
    html += '</div>';
    openModal(html);
}

async function doSendEatDishByIdx(idx) {
    const items = getTodayEatItems();
    if (idx < 0 || idx >= items.length) return;
    closeModal();
    await doSendEatDish(items[idx]);
}

async function doSendEatDish(item) {
    if (!State.activeChat || !item) return;
    const content = '我今天选了：' + item.emoji + ' ' + item.name + '（' + item.cuisine + ' · ¥' + item.price + '）';
    const req = {
        type: State.activeChat.type,
        content: content,
        contentType: 'TEXT'
    };
    if (State.activeChat.type === 'PRIVATE') req.receiverId = State.activeChat.peerId;
    else req.groupId = State.activeChat.groupId;
    try {
        await apiPost('/api/messages', req);
        showToast('已发送');
    } catch (e) {
        showToast((e && e.message) || '发送失败');
    }
}
