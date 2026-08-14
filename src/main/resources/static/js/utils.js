// ================================================================
// 公共工具函数（从 app.js 提取）
// 保持全局函数风格，不使用 ES6 modules
// ================================================================

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// 转义用于 HTML 属性中的值（如 src="...", href="..."），防止 XSS 注入
function escapeAttr(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 文本消息渲染：先 escapeHtml 防 XSS，再高亮 @昵称
function renderTextContent(rawText) {
    let safe = escapeHtml(rawText);
    const mentionClass = (name) => {
        // 判断是否 @ 我
        if (!State.me) return 'mention-tag';
        const myNickname = State.me.nickname;
        const myUsername = State.me.username;
        if (name === '所有人' || name === 'all') return 'mention-tag';
        if ((myNickname && name === myNickname) || (myUsername && name === myUsername)) {
            return 'mention-tag me';
        }
        // 还需匹配群成员中是否是自己
        return 'mention-tag';
    };
    safe = safe.replace(/@([^\s@<&]+)/g, (m, name) => {
        return '<span class="' + mentionClass(name) + '">@' + name + '</span>';
    });
    return safe;
}

function formatTime(time) {
    if (!time) return '';
    const d = new Date(time);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toTimeString().substring(0, 5);
    }
    const diff = now - d;
    if (diff < 7 * 86400000) {
        const days = ['日','一','二','三','四','五','六'];
        return '周' + days[d.getDay()];
    }
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

function formatDate(time) {
    if (!time) return '';
    const d = new Date(time);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toTimeString().substring(0, 5);
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
        return '昨天';
    }
    return (d.getMonth() + 1) + '/' + d.getDate();
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLightbox(url) {
    document.getElementById('lightbox-img').src = url;
    document.getElementById('lightbox').classList.add('show');
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('show');
}
