// ================================================================
// State - 全局状态管理
// ================================================================
const State = {
    token: localStorage.getItem('token') || null,
    me: JSON.parse(localStorage.getItem('me') || 'null'),
    stompClient: null,
    connected: false,
    reconnectAttempts: 0,
    reconnectTimer: null,
    subscriptions: [],
    currentTab: 'sessions', // sessions | contacts
    activeChat: null, // { type: 'private'|'group', id, title }
    friends: [],
    groups: [],
    pendingRequests: [],
    pendingInvitations: [],
    messages: new Map(), // key -> [messageVO]
    unreadMap: new Map(), // key -> count
    sessionPreviews: new Map(), // key -> { lastContent, lastTime, ... }
    searchResults: [],
    currentEmojiTab: 'emoji',
    myEmojis: [],
    detailPanelOpen: false,
    searchMatches: [],
    searchCurrentIdx: -1,
    favorites: [],
    currentMentions: [],          // [{ userId, nickname }]
    groupMembersCache: {},        // { groupId: [UserVO] }
    recording: null,              // { recorder, stream, chunks, startTime, duration, timer, cancelled }
};

// ================================================================
// API 请求封装
// ================================================================
async function api(url, options = {}) {
    const headers = { ...options.headers };
    if (State.token) {
        headers['Authorization'] = 'Bearer ' + State.token;
    }
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    const resp = await fetch(url, { ...options, headers });
    if (resp.status === 401) {
        forceLogout();
        throw new Error('未授权');
    }
    const data = await resp.json();
    if (!resp.ok) {
        throw new Error(data.error || data.message || '请求失败');
    }
    return data;
}

function apiGet(url) { return api(url); }
function apiPost(url, body) {
    return api(url, { method: 'POST', body: JSON.stringify(body) });
}
function apiPut(url, body) {
    return api(url, { method: 'PUT', body: JSON.stringify(body) });
}
function apiDelete(url) { return api(url, { method: 'DELETE' }); }
function apiUpload(url, file) {
    const formData = new FormData();
    formData.append('file', file);
    return api(url, { method: 'POST', body: formData });
}

// ================================================================
// 认证相关
// ================================================================
let isLoginMode = true;

function switchAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('nickname-group').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('auth-submit').textContent = isLoginMode ? '登录' : '注册';
    document.getElementById('switch-text').textContent = isLoginMode ? '还没有账号？' : '已有账号？';
    document.getElementById('switch-link').textContent = isLoginMode ? '注册' : '登录';
    document.getElementById('auth-error').textContent = '';
}

function validateAuthInput() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl = document.getElementById('auth-error');

    // 长度校验：与 placeholder 提示保持一致（用户名 3-32 字符，密码至少 6 位）
    // 仅在用户已输入内容时提示，避免刚聚焦就报错
    if (username && (username.length < 3 || username.length > 32)) {
        errEl.textContent = '用户名需为 3-32 个字符';
        return false;
    }
    if (password && password.length < 6) {
        errEl.textContent = '密码至少 6 位';
        return false;
    }
    errEl.textContent = '';
    return true;
}

async function handleAuth() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const nickname = document.getElementById('auth-nickname').value.trim();
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';

    if (!username || !password) {
        errEl.textContent = '用户名和密码不能为空';
        return;
    }

    // 输入长度保护：复用实时校验逻辑，命中则阻止接口调用
    if (!validateAuthInput()) return;

    const btn = document.getElementById('auth-submit');
    btn.disabled = true;

    try {
        if (isLoginMode) {
            const resp = await apiPost('/api/auth/login', { username, password });
            State.token = resp.token;
            State.me = { id: resp.userId, username: resp.username, nickname: resp.nickname, avatar: resp.avatar };
            localStorage.setItem('token', State.token);
            // 拉取完整 profile（含 signature）
            try {
                const full = await apiGet('/api/users/me');
                State.me = full;
            } catch (e) { console.warn('Failed to fetch user info:', e.message); }
            localStorage.setItem('me', JSON.stringify(State.me));
            enterMainPage();
        } else {
            await apiPost('/api/auth/register', { username, password, nickname: nickname || undefined });
            showToast('注册成功，请登录');
            switchAuthMode();
            document.getElementById('auth-username').value = username;
        }
    } catch (e) {
        errEl.textContent = e.message;
    } finally {
        btn.disabled = false;
    }
}

async function tryRestoreSession() {
    if (!State.token || !State.me) return false;
    try {
        const me = await apiGet('/api/users/me');
        State.me = me;
        localStorage.setItem('me', JSON.stringify(me));
        return true;
    } catch {
        forceLogout();
        return false;
    }
}

function forceLogout() {
    State.token = null;
    State.me = null;
    localStorage.removeItem('token');
    localStorage.removeItem('me');
    closeModal();
    closeLightbox();
    document.getElementById('main-page').style.display = 'none';
    document.getElementById('auth-page').style.display = 'flex';
}

function logout() {
    if (State.stompClient) {
        try { State.stompClient.disconnect(); } catch {}
    }
    apiPost('/api/auth/logout', {}).catch(() => {});
    forceLogout();
}

async function enterMainPage() {
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('main-page').style.display = 'block';
    renderNavAvatar();
    // 请求桌面通知权限 + 预热音频上下文（需用户交互后才能发声）
    requestNotifyPermission();
    getAudioContext();
    await refreshAll();
    connectWebSocket();
}

// ================================================================
// 数据刷新
// ================================================================
async function refreshAll() {
    await Promise.all([
        refreshFriends(),
        refreshGroups(),
        refreshPendingRequests(),
        refreshPendingInvitations(),
        refreshUnread(),
        refreshConversations(),
        refreshMyEmojis(),
    ]);
    renderSidebar();
    updateBadges();
}

async function refreshFriends() {
    try {
        State.friends = await apiGet('/api/friends');
    } catch (e) { console.warn('refreshFriends failed:', e.message); }
}

async function refreshGroups() {
    try {
        State.groups = await apiGet('/api/groups');
    } catch (e) { console.warn('refreshGroups failed:', e.message); }
}

async function refreshPendingRequests() {
    try {
        State.pendingRequests = await apiGet('/api/friends/requests');
    } catch (e) { console.warn('refreshPendingRequests failed:', e.message); }
}

async function refreshPendingInvitations() {
    try {
        State.pendingInvitations = await apiGet('/api/groups/invitations/pending');
    } catch (e) { console.warn('refreshPendingInvitations failed:', e.message); }
}

async function refreshUnread() {
    try {
        const list = await apiGet('/api/messages/unread');
        State.unreadMap.clear();
        list.forEach(u => {
            const key = u.type === 'PRIVATE' ? ('private:' + u.peerId) : ('group:' + u.groupId);
            State.unreadMap.set(key, u.count);
        });
    } catch (e) { console.warn('refreshUnread failed:', e.message); }
}

async function refreshConversations() {
    try {
        const list = await apiGet('/api/messages/conversations');
        State.sessionPreviews.clear();
        list.forEach(c => {
            State.sessionPreviews.set(c.key, c);
        });
    } catch (e) { console.warn('refreshConversations failed:', e.message); }
}

async function refreshMyEmojis() {
    try {
        State.myEmojis = await apiGet('/api/emojis/mine');
    } catch (e) { console.warn('refreshMyEmojis failed:', e.message); }
}

// ================================================================
// 渲染
// ================================================================
function renderNavAvatar() {
    const el = document.getElementById('nav-avatar');
    const me = State.me;
    if (me && me.avatar) {
        el.innerHTML = '<img src="' + escapeAttr(me.avatar) + '">';
    } else {
        const name = me ? (me.nickname || me.username || '?') : '?';
        el.textContent = name.charAt(0).toUpperCase();
    }
}

function switchTab(tab) {
    State.currentTab = tab;
    document.getElementById('nav-session').classList.toggle('active', tab === 'sessions');
    document.getElementById('nav-contacts').classList.toggle('active', tab === 'contacts');
    document.getElementById('nav-eat').classList.toggle('active', tab === 'eat');

    // 主区域显隐：eat tab 独占，隐藏其他面板
    const isEat = tab === 'eat';
    document.querySelector('.sidebar').style.display = isEat ? 'none' : '';
    document.querySelector('.chat-area').style.display = isEat ? 'none' : '';
    document.getElementById('detail-panel').style.display = isEat ? 'none' : '';
    document.getElementById('eat-page').style.display = isEat ? 'flex' : 'none';

    if (isEat) {
        if (!EatState.initialized) {
            initEatPage();
            EatState.initialized = true;
        }
        return;
    }

    document.getElementById('search-input').placeholder = tab === 'sessions' ? '搜索用户...' : '搜索好友...';
    renderSidebar();
    // 清空搜索
    State.searchResults = [];
}

function renderSidebar() {
    const container = document.getElementById('sidebar-list');
    container.innerHTML = '';

    if (State.currentTab === 'sessions') {
        renderSessions(container);
    } else {
        renderContacts(container);
    }
}

// 根据 key 构建单个会话数据（用于局部更新）
function buildSessionConv(key) {
    if (State.sessionPreviews.has(key)) {
        return State.sessionPreviews.get(key);
    }
    if (key.startsWith('private:')) {
        const peerId = parseInt(key.slice(7));
        const f = State.friends.find(f => f.id === peerId);
        if (f) return {
            key, type: 'PRIVATE', peerId: f.id,
            title: f.nickname || f.username, avatar: f.avatar,
            lastContent: '', lastTime: null,
            unreadCount: State.unreadMap.get(key) || 0
        };
    } else if (key.startsWith('group:')) {
        const groupId = parseInt(key.slice(6));
        const g = State.groups.find(g => g.id === groupId);
        if (g) return {
            key, type: 'GROUP', groupId: g.id,
            title: g.name, avatar: g.avatar, lastContent: '',
            lastTime: null, unreadCount: State.unreadMap.get(key) || 0
        };
    }
    return null;
}

// 局部更新单个会话项，避免全量 renderSidebar 导致的闪烁抖动
function partialUpdateSession(key) {
    if (State.currentTab !== 'sessions' || State.searchResults.length > 0) {
        renderSidebar();
        return;
    }
    const container = document.getElementById('sidebar-list');
    if (!container) return;
    const conv = buildSessionConv(key);
    if (!conv) { renderSidebar(); return; }
    const newItem = createSessionItem(conv);
    const existing = container.querySelector('.conv-item[data-key="' + key + '"]');
    if (existing) {
        existing.replaceWith(newItem);
    } else {
        container.insertBefore(newItem, container.firstChild);
    }
}

function renderSessions(container) {
    // 搜索结果优先
    if (State.searchResults.length > 0) {
        State.searchResults.forEach(u => {
            container.appendChild(createUserSearchItem(u));
        });
        return;
    }

    // 合并会话列表（来自后端 + 实时消息构建）
    const allSessions = new Map();

    // 后端会话（跳过已删除的会话）
    State.sessionPreviews.forEach((conv, key) => {
        if (deletedConvKeys.has(key)) return;
        allSessions.set(key, conv);
    });

    // 好友中没有消息的也要显示（跳过已删除的会话）
    State.friends.forEach(f => {
        const key = 'private:' + f.id;
        if (deletedConvKeys.has(key)) return;
        if (!allSessions.has(key)) {
            allSessions.set(key, {
                key, type: 'PRIVATE', peerId: f.id,
                title: f.nickname || f.username, avatar: f.avatar,
                lastContent: '', lastTime: null, unreadCount: State.unreadMap.get(key) || 0
            });
        } else {
            const c = allSessions.get(key);
            c.title = f.nickname || f.username;
            c.avatar = f.avatar;
        }
    });

    // 群聊（跳过已删除的会话）
    State.groups.forEach(g => {
        const key = 'group:' + g.id;
        if (deletedConvKeys.has(key)) return;
        if (!allSessions.has(key)) {
            allSessions.set(key, {
                key, type: 'GROUP', groupId: g.id,
                title: g.name, avatar: g.avatar, lastContent: '',
                lastTime: null, unreadCount: State.unreadMap.get(key) || 0
            });
        } else {
            allSessions.get(key).title = g.name;
            allSessions.get(key).avatar = g.avatar;
        }
    });

    // 排序：有时间的按时间倒序，没时间的在后面
    const sorted = Array.from(allSessions.values()).sort((a, b) => {
        if (!a.lastTime && !b.lastTime) return 0;
        if (!a.lastTime) return 1;
        if (!b.lastTime) return -1;
        return new Date(b.lastTime) - new Date(a.lastTime);
    });

    sorted.forEach(conv => {
        container.appendChild(createSessionItem(conv));
    });
}

function createSessionItem(conv) {
    const div = document.createElement('div');
    div.className = 'conv-item';
    div.dataset.key = conv.key;
    if (State.activeChat && State.activeChat.key === conv.key) {
        div.classList.add('active');
    }

    // 头像
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'conv-avatar';
    if (conv.type === 'GROUP') avatarDiv.classList.add('group');
    if (conv.avatar) {
        avatarDiv.innerHTML = '<img src="' + escapeAttr(conv.avatar) + '">';
    } else {
        avatarDiv.textContent = conv.type === 'GROUP' ? '#' : (conv.title || '?').charAt(0).toUpperCase();
    }

    // 内容
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'conv-body';

    const topRow = document.createElement('div');
    topRow.className = 'conv-top-row';
    topRow.innerHTML = '<span class="conv-name">' + escapeHtml(conv.title || '') + '</span>' +
                       '<span class="conv-time">' + formatTime(conv.lastTime) + '</span>';

    const bottomRow = document.createElement('div');
    bottomRow.className = 'conv-bottom-row';

    const unread = State.unreadMap.get(conv.key) || conv.unreadCount || 0;
    let previewText = conv.lastContent || '';
    if (conv.lastContentType === 'IMAGE') previewText = '[图片]';
    else if (conv.lastContentType === 'FILE') previewText = '[文件]';
    else if (conv.lastContentType === 'EMOJI') previewText = '[表情]';

    bottomRow.innerHTML = '<span class="conv-preview' + (conv.hasMention ? ' has-mention' : '') + '">' + escapeHtml(previewText) + '</span>';
    if (unread > 0) {
        const badge = document.createElement('span');
        badge.className = 'conv-unread';
        badge.textContent = unread > 99 ? '99+' : unread;
        bottomRow.appendChild(badge);
    }

    bodyDiv.appendChild(topRow);
    bodyDiv.appendChild(bottomRow);
    div.appendChild(avatarDiv);
    div.appendChild(bodyDiv);

    div.onclick = () => openConversation(conv);

    // 长按弹出操作菜单（删除会话/清空聊天记录）
    let longPressTimer = null;
    let longPressTriggered = false;
    div.addEventListener('touchstart', () => {
        longPressTriggered = false;
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            showConvActionSheet(conv);
        }, 500);
    }, { passive: true });
    div.addEventListener('touchend', () => {
        if (longPressTimer) clearTimeout(longPressTimer);
    });
    div.addEventListener('touchmove', () => {
        if (longPressTimer) clearTimeout(longPressTimer);
    });
    // 桌面端右键
    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showConvActionSheet(conv);
    });
    // 阻止长按后的click事件
    div.addEventListener('click', (e) => {
        if (longPressTriggered) {
            e.preventDefault();
            e.stopPropagation();
            longPressTriggered = false;
        }
    }, true);

    return div;
}

// 会话操作菜单（长按/右键触发）
function showConvActionSheet(conv) {
    const title = conv.title || '会话';
    let html = '<h3>' + escapeHtml(title) + '<span class="modal-close" onclick="closeModal()">×</span></h3>';
    html += '<div class="modal-list">';
    html += '<div class="modal-list-item" style="cursor:pointer;padding:14px 0;justify-content:center;" onclick="clearChatHistory(\'' + conv.type + '\', ' +
        (conv.type === 'PRIVATE' ? conv.peerId : conv.groupId) + ', \'' + conv.key + '\')">';
    html += '<span style="color:var(--color-orange);font-size:14px;font-weight:500;">清空聊天记录</span>';
    html += '</div>';
    html += '<div class="modal-list-item" style="cursor:pointer;padding:14px 0;justify-content:center;" onclick="deleteConversation(\'' + conv.key + '\')">';
    html += '<span style="color:var(--color-red);font-size:14px;font-weight:500;">删除该会话</span>';
    html += '</div>';
    html += '</div>';
    openModal(html);
}

// 清空聊天记录
async function clearChatHistory(type, id, key) {
    closeModal();
    try {
        if (type === 'PRIVATE') {
            await apiDelete('/api/messages/history/private?peerId=' + id);
        } else {
            await apiDelete('/api/messages/history/group?groupId=' + id);
        }
        State.messages.delete(key);
        // 强制全量重建消息区（清除增量模式缓存）
        const container = document.getElementById('messages-area');
        if (container) container.dataset.renderedKey = '';
        if (State.activeChat && State.activeChat.key === key) {
            renderMessages();
        }
        // 刷新会话预览（清空后预览内容应为空）
        if (State.sessionPreviews.has(key)) {
            State.sessionPreviews.delete(key);
        }
        await refreshConversations();
        renderSidebar();
        showToast('聊天记录已清空');
    } catch (e) {
        showToast('清空失败');
    }
}

// 已删除的会话key集合（防止后端refreshConversations后又冒出来）
const deletedConvKeys = new Set();

// 删除会话（从前端列表移除 + 清空记录）
async function deleteConversation(key) {
    closeModal();
    deletedConvKeys.add(key);
    const conv = State.sessionPreviews.get(key);
    if (conv) {
        // 先清空后端记录
        try {
            if (conv.type === 'PRIVATE') {
                await apiDelete('/api/messages/history/private?peerId=' + conv.peerId);
            } else {
                await apiDelete('/api/messages/history/group?groupId=' + conv.groupId);
            }
        } catch (e) { /* 忽略后端错误，仍从前端移除 */ }
    }
    State.messages.delete(key);
    State.unreadMap.delete(key);
    State.sessionPreviews.delete(key);
    if (State.activeChat && State.activeChat.key === key) {
        State.activeChat = null;
        document.getElementById('chat-main').style.display = 'none';
        document.getElementById('chat-empty').style.display = 'flex';
    }
    renderSidebar();
    updateBadges();
    showToast('已删除会话');
}

function renderContacts(container) {
    if (State.searchResults.length > 0) {
        State.searchResults.forEach(u => {
            container.appendChild(createUserSearchItem(u));
        });
        return;
    }

    // 好友列表
    if (State.friends.length === 0) {
        container.innerHTML = '<div style="padding:40px 16px;text-align:center;color:#b0b0b0;font-size:13px;">暂无好友</div>';
        return;
    }

    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'padding:8px 16px;font-size:12px;color:#9ca3af;background:rgba(255,255,255,0.04);';
    titleDiv.textContent = '好友 (' + State.friends.length + ')';
    container.appendChild(titleDiv);

    State.friends.forEach(f => {
        const div = document.createElement('div');
        div.className = 'contact-item';
        const avatar = document.createElement('div');
        avatar.className = 'contact-avatar';
        if (f.avatar) {
            avatar.innerHTML = '<img src="' + escapeAttr(f.avatar) + '">';
        } else {
            avatar.textContent = (f.nickname || f.username || '?').charAt(0).toUpperCase();
        }
        const name = document.createElement('div');
        name.className = 'contact-name';
        name.textContent = f.nickname || f.username;
        div.appendChild(avatar);
        div.appendChild(name);
        div.onclick = () => {
            const key = 'private:' + f.id;
            openConversation({
                key, type: 'PRIVATE', peerId: f.id,
                title: f.nickname || f.username, avatar: f.avatar
            });
        };
        container.appendChild(div);
    });

    // 群组列表（始终展示分组，提供创建入口）
    const groupTitle = document.createElement('div');
    groupTitle.style.cssText = 'padding:8px 16px;font-size:12px;color:#9ca3af;background:rgba(255,255,255,0.04);';
    groupTitle.textContent = '群组 (' + State.groups.length + ')';
    container.appendChild(groupTitle);

    // 创建群组入口
    const createItem = document.createElement('div');
    createItem.className = 'contact-item';
    const createAvatar = document.createElement('div');
    createAvatar.className = 'contact-avatar';
    createAvatar.style.background = 'rgba(var(--accent-rgb), 0.14)';
    createAvatar.style.color = 'var(--accent)';
    createAvatar.style.borderRadius = '8px';
    createAvatar.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    const createName = document.createElement('div');
    createName.className = 'contact-name';
    createName.textContent = '创建群组';
    createItem.appendChild(createAvatar);
    createItem.appendChild(createName);
    createItem.onclick = () => openCreateGroupModal();
    container.appendChild(createItem);

    if (State.groups.length > 0) {
        State.groups.forEach(g => {
            const div = document.createElement('div');
            div.className = 'contact-item';
            const avatar = document.createElement('div');
            avatar.className = 'contact-avatar';
            avatar.style.background = '#7a7a7a';
            avatar.style.borderRadius = '8px';
            avatar.textContent = '#';
            const name = document.createElement('div');
            name.className = 'contact-name';
            name.textContent = g.name;
            div.appendChild(avatar);
            div.appendChild(name);
            div.onclick = () => {
                const key = 'group:' + g.id;
                openConversation({
                    key, type: 'GROUP', groupId: g.id, title: g.name
                });
            };
            container.appendChild(div);
        });
    }
}

function createUserSearchItem(user) {
    const div = document.createElement('div');
    div.className = 'contact-item';
    const avatar = document.createElement('div');
    avatar.className = 'contact-avatar';
    if (user.avatar) {
        avatar.innerHTML = '<img src="' + escapeAttr(user.avatar) + '">';
    } else {
        avatar.textContent = (user.nickname || user.username || '?').charAt(0).toUpperCase();
    }
    const body = document.createElement('div');
    body.style.cssText = 'flex:1;';
    body.innerHTML = '<div style="font-size:14px;color:#1f2329;">' + escapeHtml(user.nickname || user.username) + '</div>' +
                     '<div style="font-size:12px;color:#9a9a9a;">@' + escapeHtml(user.username) + '</div>';
    const action = document.createElement('div');
    action.style.cssText = 'display:flex;align-items:center;';
    const isFriend = State.friends.some(f => f.id === user.id);
    if (isFriend) {
        action.innerHTML = '<span style="font-size:12px;color:#9a9a9a;">已是好友</span>';
    } else {
        const btn = document.createElement('button');
        btn.className = 'btn-accept';
        btn.textContent = '加好友';
        btn.onclick = (e) => { e.stopPropagation(); sendFriendRequest(user.id); };
        action.appendChild(btn);
    }
    div.appendChild(avatar);
    div.appendChild(body);
    div.appendChild(action);
    return div;
}

// ================================================================
// 搜索
// ================================================================
let searchTimer = null;
function handleSearchInput() {
    const keyword = document.getElementById('search-input').value.trim();
    clearTimeout(searchTimer);
    if (!keyword) {
        State.searchResults = [];
        renderSidebar();
        return;
    }
    searchTimer = setTimeout(async () => {
        try {
            State.searchResults = await apiGet('/api/users/search?keyword=' + encodeURIComponent(keyword));
            renderSidebar();
        } catch (e) { console.warn('Search failed:', e.message); }
    }, 300);
}

async function sendFriendRequest(targetUserId) {
    try {
        await apiPost('/api/friends/' + targetUserId, {});
        showToast('好友申请已发送');
    } catch (e) {
        showToast(e.message);
    }
}

// ================================================================
// 打开会话
// ================================================================
async function openConversation(conv) {
    // 若当前不在消息 tab（如吃啥页），先切回来，确保聊天区可见
    if (State.currentTab !== 'sessions') {
        switchTab('sessions');
    }
    // 从已删除集合中恢复
    deletedConvKeys.delete(conv.key);
    State.activeChat = conv;

    // 清未读
    State.unreadMap.set(conv.key, 0);
    updateBadges();
    renderSidebar();

    // 移动端：切换到聊天视图
    document.querySelector('.layout').classList.add('mobile-chat-open');
    // 关闭详情面板（避免遮挡聊天）
    State.detailPanelOpen = false;
    document.getElementById('detail-panel').classList.remove('show');

    // 显示聊天区
    document.getElementById('chat-empty').style.display = 'none';
    document.getElementById('chat-main').style.display = 'flex';

    // 标题
    document.getElementById('chat-title').textContent = conv.title;
    if (conv.type === 'GROUP') {
        const g = State.groups.find(g => g.id === conv.groupId);
        const count = g && g.memberCount ? g.memberCount : '';
        document.getElementById('chat-subtitle').textContent = count ? ('(' + count + '人)') : '';
        // 预加载群成员缓存供 @ 使用
        ensureGroupMembersCache(conv.groupId);
    } else {
        const f = State.friends.find(f => f.id === conv.peerId);
        document.getElementById('chat-subtitle').textContent = (f && f.signature) ? f.signature : '';
    }

    // 加载历史消息
    const key = conv.key;
    if (!State.messages.has(key)) {
        try {
            let history;
            if (conv.type === 'PRIVATE') {
                history = await apiGet('/api/messages/private?peerId=' + conv.peerId);
            } else {
                history = await apiGet('/api/messages/group?groupId=' + conv.groupId);
            }
            State.messages.set(key, history);
        } catch (e) {
            State.messages.set(key, []);
        }
    }

    renderMessages();

    // 标记已读
    const msgs = State.messages.get(key) || [];
    if (msgs.length > 0) {
        const lastId = msgs[msgs.length - 1].id;
        try {
            if (conv.type === 'PRIVATE') {
                await apiPost('/api/messages/read', { type: 'PRIVATE', peerId: conv.peerId, lastReadMessageId: lastId });
            } else {
                await apiPost('/api/messages/read', { type: 'GROUP', groupId: conv.groupId, lastReadMessageId: lastId });
            }
        } catch (e) { console.warn('markRead on open failed:', e.message); }
    }

    // 详情面板
    renderDetailPanel();
}

// ================================================================
// 消息渲染
// ================================================================
function renderMessages() {
    const container = document.getElementById('messages-area');
    if (!State.activeChat) {
        container.innerHTML = '';
        container.dataset.renderedKey = '';
        return;
    }

    const key = State.activeChat.key;
    const msgs = State.messages.get(key) || [];

    // 判断是否是同一会话的增量更新
    const isSameChat = container.dataset.renderedKey === key;
    if (isSameChat) {
        // 增量模式：只追加未渲染的新消息，不重建旧行（修复闪烁）
        appendNewMessages(container, msgs);
        scrollToBottomSmart(container);
        return;
    }

    // 切换会话：全量重建
    container.innerHTML = '';
    container.dataset.renderedKey = key;
    container.dataset.lastRenderedIdx = '-1';

    let lastDate = null;
    let lastSender = null;
    msgs.forEach((msg, idx) => {
        const msgDate = formatDate(msg.sendTime);
        if (msgDate !== lastDate) {
            const sep = document.createElement('div');
            sep.className = 'time-separator';
            sep.textContent = msgDate;
            container.appendChild(sep);
            lastDate = msgDate;
            lastSender = null; // 日期分隔后重置发送者
        }
        const row = createMessageRow(msg);
        // 同一发送者连续消息：收紧间距、隐藏头像
        if (lastSender === msg.senderId && msg.status !== 'RECALLED') {
            row.classList.add('same-sender');
        }
        lastSender = (msg.status === 'RECALLED') ? null : msg.senderId;
        container.appendChild(row);
    });

    container.dataset.lastRenderedIdx = String(msgs.length - 1);

    // 滚到底部
    container.scrollTop = container.scrollHeight;
}

// 增量追加：只把 State 里还没渲染的消息 append 进去
function appendNewMessages(container, msgs) {
    const lastIdx = parseInt(container.dataset.lastRenderedIdx || '-1', 10);
    if (msgs.length - 1 <= lastIdx) return; // 没有新消息

    // 找最后一条已渲染消息的日期和发送者，用于判断是否需要分隔/隐藏头像
    let lastDate = null;
    let lastSender = null;
    if (lastIdx >= 0) {
        lastDate = formatDate(msgs[lastIdx].sendTime);
        lastSender = msgs[lastIdx].status === 'RECALLED' ? null : msgs[lastIdx].senderId;
    }

    for (let i = lastIdx + 1; i < msgs.length; i++) {
        const msg = msgs[i];
        const msgDate = formatDate(msg.sendTime);
        if (msgDate !== lastDate) {
            const sep = document.createElement('div');
            sep.className = 'time-separator';
            sep.textContent = msgDate;
            container.appendChild(sep);
            lastDate = msgDate;
            lastSender = null;
        }
        const row = createMessageRow(msg);
        if (lastSender === msg.senderId && msg.status !== 'RECALLED') {
            row.classList.add('same-sender');
        }
        lastSender = msg.status === 'RECALLED' ? null : msg.senderId;
        container.appendChild(row);
    }
    container.dataset.lastRenderedIdx = String(msgs.length - 1);
}

// 智能滚动：用户在底部附近时自动滚到底；翻历史时打扰最小
function scrollToBottomSmart(container) {
    const threshold = 120; // 距离底部 120px 内视为"在底部"
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom <= threshold) {
        container.scrollTop = container.scrollHeight;
    }
}

// 强制全量重渲染（用于撤回/删除/已读状态变化等消息内容变更场景）
// 这类操作低频（用户主动触发），全量重建可接受，不影响连续发消息的流畅度
function forceRerenderMessages() {
    const container = document.getElementById('messages-area');
    container.dataset.renderedKey = '';  // 重置标记，下次 renderMessages 会走全量分支
    renderMessages();
}

function createMessageRow(msg) {
    const row = document.createElement('div');
    row.className = 'msg-row';
    const isMine = msg.senderId === State.me.id;
    if (isMine) row.classList.add('mine');
    // 群聊且 @ 我：左侧红色竖条
    const mentions = msg.mentionUserIds || [];
    const mentionMe = mentions.includes(State.me.id) || mentions.includes(-1);
    if (msg.type === 'GROUP' && mentionMe && !isMine) {
        row.classList.add('mentioned');
    }
    row.dataset.msgId = msg.id;

    // 头像
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    if (msg.senderAvatar) {
        avatar.innerHTML = '<img src="' + escapeAttr(msg.senderAvatar) + '">';
    } else {
        avatar.textContent = (msg.senderName || '?').charAt(0).toUpperCase();
    }

    // 内容区
    const contentWrap = document.createElement('div');
    contentWrap.className = 'msg-content-wrap';

    // 发送者名称（群聊显示）
    if (State.activeChat && State.activeChat.type === 'GROUP' && !isMine) {
        const nameEl = document.createElement('div');
        nameEl.className = 'msg-sender-name';
        nameEl.textContent = msg.senderName;
        contentWrap.appendChild(nameEl);
    }

    // 气泡
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    // 撤回消息
    if (msg.status === 'RECALLED') {
        bubble.className = 'msg-bubble recall-notice';
        bubble.textContent = (isMine ? '你' : msg.senderName) + ' 撤回了一条消息';
    } else {
        const ct = msg.contentType || 'TEXT';
        switch (ct) {
            case 'TEXT':
                bubble.classList.add('text');
                bubble.innerHTML = renderTextContent(msg.content);
                break;
            case 'EMOJI':
                bubble.classList.add('emoji');
                bubble.textContent = msg.content;
                break;
            case 'IMAGE':
                bubble.classList.add('image');
                if (msg.attachment) {
                    const img = document.createElement('img');
                    img.src = msg.attachment.thumbUrl || msg.attachment.url;
                    img.onclick = () => showLightbox(msg.attachment.url);
                    bubble.appendChild(img);
                }
                break;
            case 'FILE':
                bubble.classList.add('file');
                if (msg.attachment) {
                    bubble.innerHTML =
                        '<div class="file-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="18" x2="13" y2="18"/></svg></div>' +
                        '<div class="file-info">' +
                        '<div class="file-name">' + escapeHtml(msg.attachment.name || '文件') + '</div>' +
                        '<div class="file-size">' + formatFileSize(msg.attachment.size) + '</div>' +
                        '</div>' +
                        '<a class="file-download" href="' + escapeAttr(msg.attachment.url) + '" target="_blank" download>下载</a>';
                }
                break;
            case 'AUDIO':
                bubble.classList.add('audio');
                if (msg.attachment) {
                    const dur = msg.audioDuration || 0;
                    // bar 数量：3~20，按时长递增
                    const barCount = Math.max(3, Math.min(20, Math.ceil(dur)));
                    let barsHtml = '';
                    for (let i = 0; i < barCount; i++) {
                        // 静态波形高度 4~16px（用 sin 模拟随机起伏），未播放时静止显示
                        const h = 4 + Math.floor(Math.abs(Math.sin(i * 1.3 + dur * 0.7)) * 12);
                        barsHtml += '<span class="bar" style="height:' + h + 'px;animation-delay:' + (i * 0.08) + 's;"></span>';
                    }
                    // 气泡宽度按时长扩展：120 ~ 280px
                    const minW = 120, maxW = 280;
                    const w = Math.min(maxW, minW + dur * 6);
                    bubble.style.minWidth = w + 'px';
                    bubble.innerHTML =
                        '<div class="audio-bubble" onclick="event.stopPropagation();">' +
                            '<div class="audio-play-btn" onclick="toggleAudioPlay(this)">' + AUDIO_PLAY_SVG + '</div>' +
                            '<div class="audio-info">' +
                                '<div class="audio-duration">' + formatDuration(dur) + '</div>' +
                                '<div class="audio-bars">' + barsHtml + '</div>' +
                            '</div>' +
                            '<audio src="' + escapeAttr(msg.attachment.url) + '" preload="metadata" onended="onAudioEnded(this)"></audio>' +
                        '</div>';
                }
                break;
        }

        // 操作菜单：所有消息可收藏；自己的消息可撤回/删除
        const actions = document.createElement('div');
        actions.className = 'msg-actions';
        // 收藏按钮（所有人通用）
        const favBtn = document.createElement('div');
        favBtn.className = 'msg-action-btn';
        favBtn.textContent = '收藏';
        favBtn.onclick = (e) => { e.stopPropagation(); favoriteMessage(msg.id, favBtn); };
        actions.appendChild(favBtn);
        if (isMine) {
            const recallBtn = document.createElement('div');
            recallBtn.className = 'msg-action-btn';
            recallBtn.textContent = '撤回';
            recallBtn.onclick = (e) => { e.stopPropagation(); recallMessage(msg.id); };
            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'msg-action-btn';
            deleteBtn.textContent = '删除';
            deleteBtn.style.color = '#f53f3f';
            deleteBtn.onclick = (e) => { e.stopPropagation(); deleteMessage(msg.id); };
            actions.appendChild(recallBtn);
            actions.appendChild(deleteBtn);
        }
        bubble.style.position = 'relative';
        bubble.appendChild(actions);
    }

    contentWrap.appendChild(bubble);

    // 已读状态（私聊自己发送的消息）
    if (isMine && msg.type === 'PRIVATE' && msg.status !== 'RECALLED' && msg.read !== null && msg.read !== undefined) {
        const readStatus = document.createElement('div');
        readStatus.className = 'msg-read-status';
        readStatus.textContent = msg.read ? '已读' : '未读';
        contentWrap.appendChild(readStatus);
    }

    row.appendChild(avatar);
    row.appendChild(contentWrap);

    // 移动端：点击消息行切换操作菜单（桌面端用 hover）
    row.addEventListener('click', (ev) => {
        // 仅触屏设备生效（避免影响桌面 hover 体验）
        if (!isTouchDevice()) return;
        // 点击操作按钮自身不切换
        if (ev.target.closest('.msg-actions')) return;
        const wasActive = row.classList.contains('actions-active');
        // 先关闭其他行的菜单
        document.querySelectorAll('.msg-row.actions-active').forEach(r => {
            if (r !== row) r.classList.remove('actions-active');
        });
        row.classList.toggle('actions-active', !wasActive);
        if (!wasActive) positionMsgActions(row);
    });
    // 桌面端 hover 时智能定位操作菜单
    if (!isTouchDevice()) {
        row.addEventListener('mouseenter', () => positionMsgActions(row));
    }

    return row;
}

function isTouchDevice() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

// 智能定位消息操作菜单：上方空间不足时翻到气泡下方，避免被消息区顶部裁剪
function positionMsgActions(row) {
    const actions = row.querySelector('.msg-actions');
    if (!actions) return;
    const messagesArea = document.getElementById('messages-area');
    const bubble = row.querySelector('.msg-bubble');
    if (!messagesArea || !bubble) return;
    const maRect = messagesArea.getBoundingClientRect();
    const bRect = bubble.getBoundingClientRect();
    const menuH = 34;
    const spaceAbove = bRect.top - maRect.top;
    const spaceBelow = maRect.bottom - bRect.bottom;
    if (spaceAbove < menuH && spaceBelow > spaceAbove) {
        actions.classList.add('below');
    } else {
        actions.classList.remove('below');
    }
}

// ================================================================
// 发送消息
// ================================================================
function handleInput() {
    const ta = document.getElementById('input-box');
    if (!ta) return;
    // 每次输入都从全文重解析 @ 列表（避免区间维护 bug）
    syncMentionsFromText(ta.value);
    // 仅群聊响应 @ 浮层
    if (!State.activeChat || State.activeChat.type !== 'GROUP') {
        closeMentionPanel();
        return;
    }
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const m = before.match(/@([^\s@]*)$/);
    if (m) openMentionPanel(m[1]); else closeMentionPanel();
}

function handleInputKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
    }
}

async function handleSend() {
    if (!State.activeChat) return;
    const input = document.getElementById('input-box');
    const content = input.value.trim();
    if (!content) return;

    // 发送前重新解析 mention，保证 userId 与文本一致
    syncMentionsFromText(content);

    const req = {
        type: State.activeChat.type,
        content: content,
        contentType: 'TEXT'
    };
    if (State.activeChat.type === 'PRIVATE') {
        req.receiverId = State.activeChat.peerId;
    } else {
        req.groupId = State.activeChat.groupId;
        if (State.currentMentions && State.currentMentions.length > 0) {
            req.mentionUserIds = [...new Set(State.currentMentions.map(m => m.userId))];
        }
    }

    input.value = '';
    closeEmojiPanel();
    closeMentionPanel();
    State.currentMentions = [];

    try {
        await apiPost('/api/messages', req);
        // 消息会通过 WebSocket 回推，这里不需要手动渲染
    } catch (e) {
        showToast(e.message);
        input.value = content; // 恢复内容
        syncMentionsFromText(content);
    }
}

// ================================================================
// 消息撤回/删除
// ================================================================
async function recallMessage(msgId) {
    if (!confirm('确定撤回这条消息？')) return;
    try {
        await apiPost('/api/messages/' + msgId + '/recall', {});
    } catch (e) {
        showToast(e.message);
    }
}

async function deleteMessage(msgId) {
    if (!confirm('确定删除这条消息？')) return;
    try {
        await apiDelete('/api/messages/' + msgId);
    } catch (e) {
        showToast(e.message);
    }
}

// ================================================================
// 文件上传
// ================================================================
async function handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    await uploadAndSendFile(file, 'IMAGE');
}

async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    await uploadAndSendFile(file, file.type.startsWith('image/') ? 'IMAGE' : 'FILE');
}

async function uploadAndSendFile(file, contentType) {
    if (!State.activeChat) return;
    try {
        showToast('上传中...');
        const attachment = await apiUpload('/api/messages/upload', file);
        const req = {
            type: State.activeChat.type,
            contentType: contentType,
            attachmentUrl: attachment.url,
            attachmentName: attachment.name,
            attachmentSize: attachment.size,
            attachmentThumb: attachment.thumbUrl,
            content: ''
        };
        if (State.activeChat.type === 'PRIVATE') {
            req.receiverId = State.activeChat.peerId;
        } else {
            req.groupId = State.activeChat.groupId;
        }
        await apiPost('/api/messages', req);
    } catch (e) {
        showToast(e.message);
    }
}

// ================================================================
// WebSocket 连接（含指数退避重连）
// ================================================================
function connectWebSocket() {
    if (State.stompClient && State.connected) return;

    updateConnStatus('connecting');

    const socket = new SockJS('/ws?token=' + State.token);
    const stompClient = Stomp.over(socket);
    stompClient.debug = null; // 关闭调试日志
    stompClient.heartbeat.outgoing = 10000;
    stompClient.heartbeat.incoming = 10000;

    stompClient.connect({ Authorization: 'Bearer ' + State.token }, () => {
        State.stompClient = stompClient;
        State.connected = true;
        State.reconnectAttempts = 0;
        updateConnStatus('connected');
        subscribeAll();
    }, (error) => {
        State.connected = false;
        updateConnStatus('disconnected');
        scheduleReconnect();
    });
}

function subscribeAll() {
    // 取消旧订阅
    State.subscriptions.forEach(sub => { try { sub.unsubscribe(); } catch {} });
    State.subscriptions = [];

    if (!State.stompClient || !State.connected) return;

    // 订阅私聊通道
    State.subscriptions.push(State.stompClient.subscribe('/topic/user.' + State.me.id, (msg) => {
        handleMessage(JSON.parse(msg.body));
    }));

    // 订阅系统通知通道
    State.subscriptions.push(State.stompClient.subscribe('/topic/notify.' + State.me.id, (msg) => {
        handleNotify(JSON.parse(msg.body));
    }));

    // 订阅所有群通道
    State.groups.forEach(g => {
        State.subscriptions.push(State.stompClient.subscribe('/topic/group.' + g.id, (msg) => {
            handleMessage(JSON.parse(msg.body));
        }));
    });
}

function scheduleReconnect() {
    if (State.reconnectTimer) clearTimeout(State.reconnectTimer);
    const attempts = State.reconnectAttempts++;
    // 指数退避: 1s, 2s, 4s, 8s, 15s, 30s
    const delays = [1000, 2000, 4000, 8000, 15000, 30000];
    const delay = delays[Math.min(attempts, delays.length - 1)];
    updateConnStatus('disconnected', '第 ' + (attempts + 1) + ' 次重连，' + (delay / 1000) + ' 秒后');
    State.reconnectTimer = setTimeout(async () => {
        // 重连成功后恢复数据
        await refreshAll();
        connectWebSocket();
        // 离线补偿：如果当前有打开的会话，刷新消息
        if (State.activeChat) {
            const key = State.activeChat.key;
            State.messages.delete(key);
            await openConversation(State.activeChat);
        }
    }, delay);
}

function updateConnStatus(status, customText) {
    const el = document.getElementById('conn-status');
    const textEl = document.getElementById('conn-text');
    el.className = 'conn-status ' + status;
    if (status === 'connected') {
        textEl.textContent = '已连接';
    } else if (status === 'connecting') {
        textEl.textContent = customText || '连接中...';
    } else {
        textEl.textContent = customText || '已断开';
    }
}

// ================================================================
// 消息处理
// ================================================================
function handleMessage(msg) {
    if (!msg) return;
    const isMineInHandler = msg.senderId === State.me.id;

    // 确定会话 key
    let key;
    if (msg.type === 'PRIVATE') {
        const otherId = msg.senderId === State.me.id ? msg.receiverId : msg.senderId;
        key = 'private:' + otherId;
    } else {
        key = 'group:' + msg.groupId;
    }

    // 存入消息列表
    if (!State.messages.has(key)) {
        State.messages.set(key, []);
    }
    const msgs = State.messages.get(key);
    const existIdx = msgs.findIndex(m => m.id === msg.id);
    const isUpdate = existIdx >= 0;   // 撤回/已读等是更新已有消息
    if (isUpdate) {
        msgs[existIdx] = msg; // 更新（撤回场景）
    } else {
        msgs.push(msg);
    }

    // 更新会话预览
    const conv = State.sessionPreviews.get(key);
    const mentions = msg.mentionUserIds || [];
    const msgMentionsMe = msg.type === 'GROUP'
        && !isMineInHandler
        && (mentions.includes(State.me.id) || mentions.includes(-1));
    if (conv) {
        conv.lastContent = previewText(msg);
        conv.lastContentType = msg.contentType;
        conv.lastTime = msg.sendTime;
        if (msgMentionsMe) conv.hasMention = true;
    } else {
        // 新会话
        const newConv = {
            key, type: msg.type,
            lastContent: previewText(msg),
            lastContentType: msg.contentType,
            lastTime: msg.sendTime,
            unreadCount: 0
        };
        if (msg.type === 'PRIVATE') {
            newConv.peerId = msg.senderId === State.me.id ? msg.receiverId : msg.senderId;
            const f = State.friends.find(f => f.id === newConv.peerId);
            if (f) {
                newConv.title = f.nickname || f.username;
                newConv.avatar = f.avatar;
            }
        } else {
            newConv.groupId = msg.groupId;
            const g = State.groups.find(g => g.id === msg.groupId);
            if (g) newConv.title = g.name;
        }
        State.sessionPreviews.set(key, newConv);
    }

    // 未读数处理
    const isActiveChat = State.activeChat && State.activeChat.key === key;
    const isMine = isMineInHandler;
    const isPageVisible = !document.hidden;
    // 当前会话且页面可见：视为已读；否则计为未读
    const effectivelyRead = isActiveChat && isPageVisible;

    if (effectivelyRead) {
        // 当前会话且页面可见：渲染 + 标记已读
        // 撤回/已读状态变更走强制全量重渲染；新消息走增量（避免闪烁）
        if (isUpdate) forceRerenderMessages(); else renderMessages();
        if (!isMine && msg.status !== 'RECALLED') {
            markConversationRead(key, msg.id);
            // 已读时清除 @我 标记
            const c = State.sessionPreviews.get(key);
            if (c) c.hasMention = false;
        }
    } else if (!isMine && msg.status !== 'RECALLED') {
        // 非当前会话，或当前会话但页面失焦：增加未读
        const current = State.unreadMap.get(key) || 0;
        State.unreadMap.set(key, current + 1);
        // 当前会话但页面失焦：仍渲染消息（用户回来时直接看到）
        if (isActiveChat) {
            if (isUpdate) forceRerenderMessages(); else renderMessages();
        }
    } else if (isActiveChat) {
        // 当前会话可见且自己发的：直接渲染
        if (isUpdate) forceRerenderMessages(); else renderMessages();
    }

    // 局部更新对应会话项，避免全量重建列表导致闪烁
    partialUpdateSession(key);
    updateBadges();

    // 任何情况下收到对方消息都播放提示音
    if (!isMine && msg.status !== 'RECALLED') {
        playMessageSound();
    }
    // 原生桌面通知：仅非已读场景（避免当前会话可见时打扰）
    const needAlert = !isMine && msg.status !== 'RECALLED' && !effectivelyRead;
    if (needAlert) {
        showNotification(msg);
    }
    // 页内右下角弹窗：非当前会话时显示（当前会话页面失焦的情况由原生通知覆盖）
    if (!isMine && msg.status !== 'RECALLED' && !isActiveChat) {
        showInPageToast(msg);
    }
}

function previewText(msg) {
    if (msg.status === 'RECALLED') return '消息已撤回';
    switch (msg.contentType) {
        case 'TEXT': return msg.content;
        case 'EMOJI': return msg.content;
        case 'IMAGE': return '[图片]';
        case 'FILE': return '[文件] ' + (msg.attachment ? msg.attachment.name : '');
        case 'AUDIO': return '[语音]';
        default: return msg.content || '';
    }
}

async function markConversationRead(key, lastMsgId) {
    const parts = key.split(':');
    const type = parts[0] === 'private' ? 'PRIVATE' : 'GROUP';
    try {
        if (type === 'PRIVATE') {
            const peerId = parseInt(parts[1]);
            await apiPost('/api/messages/read', { type: 'PRIVATE', peerId, lastReadMessageId: lastMsgId });
        } else {
            const groupId = parseInt(parts[1]);
            await apiPost('/api/messages/read', { type: 'GROUP', groupId, lastReadMessageId: lastMsgId });
        }
    } catch (e) { console.warn('markConversationRead failed:', e.message); }
}

// ================================================================
// 通知处理
// ================================================================
function handleNotify(notify) {
    if (!notify || !notify.type) return;

    switch (notify.type) {
        case 'FRIEND_REQUEST':
            showToast('收到新的好友申请');
            refreshPendingRequests();
            updateBadges();
            break;
        case 'FRIEND_HANDLED':
            const handled = notify.payload;
            if (handled.action === 'ACCEPTED') {
                showToast('好友申请已通过');
                refreshFriends();
                refreshConversations();
            } else {
                showToast('好友申请被拒绝');
            }
            renderSidebar();
            break;
        case 'GROUP_INVITATION':
            showToast('收到新的群邀请');
            refreshPendingInvitations();
            updateBadges();
            break;
        case 'GROUP_INVITATION_HANDLED':
            refreshGroups();
            // 如果是 ACCEPTED，需要重新订阅群通道
            setTimeout(() => {
                if (State.connected) {
                    subscribeAll();
                }
            }, 500);
            break;
        case 'MESSAGE_RECALL':
            // 消息已通过 /topic/user 或 /topic/group 推送更新
            break;
        case 'MESSAGE_DELETE':
            handleDeleteNotify(notify.payload);
            break;
        case 'READ_RECEIPT':
            // 对方已读，更新消息状态
            handleReadReceipt(notify.payload);
            break;
        case 'MEMBER_JOINED':
            refreshGroups();
            break;
        case 'GROUP_INFO_UPDATED':
            refreshGroups().then(() => {
                renderSidebar();
                // 当前会话为该群时，同步标题与详情面板
                const payload = notify.payload || {};
                if (State.activeChat && State.activeChat.groupId === payload.groupId) {
                    const g = State.groups.find(g => g.id === payload.groupId);
                    if (g) {
                        document.getElementById('chat-title').textContent = g.name;
                        State.activeChat.title = g.name;
                        State.activeChat.avatar = g.avatar;
                    }
                    if (State.detailPanelOpen) renderDetailPanel();
                }
            });
            break;
    }
}

function handleDeleteNotify(payload) {
    if (!payload) return;
    // 从本地消息列表删除
    State.messages.forEach((msgs, key) => {
        const idx = msgs.findIndex(m => m.id === payload.messageId);
        if (idx >= 0) {
            msgs.splice(idx, 1);
            if (State.activeChat && State.activeChat.key === key) {
                renderMessages();
            }
        }
    });
}

function handleReadReceipt(payload) {
    if (!payload) return;
    // 更新私聊消息的已读状态
    const key = 'private:' + payload.peerId;
    const msgs = State.messages.get(key);
    if (!msgs) return;
    msgs.forEach(m => {
        if (m.senderId === State.me.id && m.id <= payload.lastReadMessageId) {
            m.read = true;
        }
    });
    if (State.activeChat && State.activeChat.key === key) {
        renderMessages();
    }
}

// ================================================================
// Badge 更新
// ================================================================
function updateBadges() {
    // 会话总未读
    let totalUnread = 0;
    State.unreadMap.forEach(count => { totalUnread += count; });

    // Android WebView 套壳：同步启动器图标角标（传 0 自动清除）
    if (window.AndroidBridge && typeof AndroidBridge.setBadge === 'function') {
        try { AndroidBridge.setBadge(totalUnread); } catch (e) {}
    }

    const sessionBadge = document.getElementById('badge-sessions');
    if (totalUnread > 0) {
        sessionBadge.style.display = 'inline';
        sessionBadge.textContent = totalUnread > 99 ? '99+' : totalUnread;
    } else {
        sessionBadge.style.display = 'none';
    }
    // 浏览器标签页标题展示未读数
    updateDocumentTitle(totalUnread);

    // 好友申请
    const reqCount = State.pendingRequests.length;
    const reqBadge = document.getElementById('badge-requests');
    if (reqCount > 0) {
        reqBadge.style.display = 'inline';
        reqBadge.textContent = reqCount > 99 ? '99+' : reqCount;
    } else {
        reqBadge.style.display = 'none';
    }
}

// ================================================================
// 消息提醒：桌面通知 + 提示音 + 标签标题
// ================================================================
function updateDocumentTitle(totalUnread) {
    if (totalUnread === undefined) {
        totalUnread = 0;
        State.unreadMap.forEach(c => totalUnread += c);
    }
    const base = 'AI Web Chat';
    document.title = totalUnread > 0 ? `(${totalUnread > 99 ? '99+' : totalUnread}) ${base}` : base;
}

function requestNotifyPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

let audioContext = null;
function getAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            audioContext = null;
        }
    }
    return audioContext;
}

// 收到新消息的提示音（Web Audio 合成，无需音频文件）
function playMessageSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        // 双音叠加：880Hz 主音 + 1320Hz 泛音，营造清脆"叮"声
        [880, 1320].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = now + i * 0.04;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(i === 0 ? 0.25 : 0.12, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
            osc.start(start);
            osc.stop(start + 0.35);
        });
    } catch (e) {}
}

function showNotification(msg) {
    const senderName = msg.senderName || '新消息';
    const body = previewText(msg);
    let tag;
    if (msg.type === 'PRIVATE') {
        tag = 'awc-p-' + msg.senderId;
    } else {
        tag = 'awc-g-' + msg.groupId;
    }

    // Android WebView 套壳环境：走原生系统通知 + 图标角标
    if (window.AndroidBridge && typeof AndroidBridge.showNotification === 'function') {
        try {
            AndroidBridge.showNotification(senderName, body, tag);
        } catch (e) {}
        return; // 已交给原生层，不再走浏览器 Notification
    }

    // 浏览器环境：Web Notification API
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        const n = new Notification(senderName, {
            body: body,
            tag: tag,
            icon: msg.senderAvatar || undefined,
            silent: true,  // 自己播放声音，避免系统提示音重复
            requireInteraction: false
        });
        n.onclick = () => {
            window.focus();
            n.close();
        };
        setTimeout(() => { try { n.close(); } catch {} }, 6000);
    } catch (e) {}
}

// 页内右下角弹窗（不依赖系统通知权限，HTTP/HTTPS 均可用）
function showInPageToast(msg) {
    const container = document.getElementById('toast-notify-container');
    if (!container) return;

    // 最多保留 3 条，超出移除最早的
    while (container.children.length >= 3) {
        container.removeChild(container.firstChild);
    }

    const senderName = msg.senderName || '新消息';
    const preview = previewText(msg);
    const avatarHtml = msg.senderAvatar
        ? '<img src="' + escapeAttr(msg.senderAvatar) + '">'
        : escapeHtml((senderName || '?').charAt(0).toUpperCase());

    let convKey;
    if (msg.type === 'PRIVATE') {
        const otherId = msg.senderId === State.me.id ? msg.receiverId : msg.senderId;
        convKey = 'private:' + otherId;
    } else {
        convKey = 'group:' + msg.groupId;
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notify';
    toast.innerHTML =
        '<div class="toast-avatar">' + avatarHtml + '</div>' +
        '<div class="toast-body">' +
        '<div class="toast-title">' + escapeHtml(senderName) + '</div>' +
        '<div class="toast-content">' + escapeHtml(preview) + '</div>' +
        '</div>' +
        '<div class="toast-close">×</div>';

    toast.onclick = () => {
        removeToastNotify(toast);
        // 跳转到对应会话
        const conv = State.sessionPreviews.get(convKey);
        if (conv) {
            openConversation(conv);
        } else {
            // 没有会话预览，手动构建
            if (msg.type === 'PRIVATE') {
                openConversation({
                    key: convKey, type: 'PRIVATE',
                    peerId: msg.senderId === State.me.id ? msg.receiverId : msg.senderId,
                    title: senderName, avatar: msg.senderAvatar
                });
            }
        }
    };
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        removeToastNotify(toast);
    };

    container.appendChild(toast);
    setTimeout(() => removeToastNotify(toast), 5000);
}

function removeToastNotify(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('fade-out');
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
}

// 页面可见性变化：重新计算标题 + 回到前台时清当前会话未读
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        updateDocumentTitle();
        clearActiveChatUnread();
    }
});
window.addEventListener('focus', () => {
    updateDocumentTitle();
    clearActiveChatUnread();
});

// 页面重新可见/聚焦时，清掉当前打开会话的未读数（之前因为失焦累积的）
function clearActiveChatUnread() {
    if (!State.activeChat) return;
    const key = State.activeChat.key;
    const unread = State.unreadMap.get(key) || 0;
    if (unread === 0) return;
    State.unreadMap.set(key, 0);
    const msgs = State.messages.get(key) || [];
    if (msgs.length > 0) {
        markConversationRead(key, msgs[msgs.length - 1].id);
    }
    renderSidebar();
    updateBadges();
}

// ================================================================
// 表情面板
// ================================================================
const EMOJI_DATA = {
    '笑脸': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴'],
    '手势': ['👍','👎','👌','✌','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝','✋','🤚','🖐','🖖','👋','🤝','👏','🙌','👐','🤲','🙏','✍','💪','🦵','🦶','👂','👃','👁','🧠','🦷','🦴'],
    '动物': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','Bat','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🕷','🦂','🐢','🐍','🦎','🐙','🦑','🦀','🐠','🐟','🐬','🐳','🐋','🦈'],
    '食物': ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🌽','🥕','🥔','🍠','🥐','🍞','🥖','🧀','🥚','🍳','🥞','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🌮','🌯','🍜','🍲','🍝','🍿'],
    '活动': ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥅','🏒','🏑','🥍','🏏','🥊','🥋','⛳','🏹','🎣','🥇','🥈','🥉','🏅','🏆','🎮','🎲','🎯','🎳','🎨','🎭','🎪','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻','🎬'],
    '旅行': ['🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🚚','🚛','🚜','🛴','🚲','🛵','🏍','✈','🚀','🛸','🚁','⛵','🚤','🚢','⚓','🚂','🚆','🚊','🚉','🚇','🗺','🗿','🗽','🗼','🏰','🏯','🏟','🎡','🎢','🎠','⛱','🏖','🏝','⛰','🏔','🗻'],
    '物品': ['⌚','📱','💻','🖥','🖨','🖱','🖲','🕹','🗜','💽','💾','💿','📷','📸','📹','🎥','📽','🎞','📞','☎','📟','📠','📺','📻','🎙','🎚','🎛','⏱','⏰','🕰','⏳','📡','🔋','🔌','💡','🔦','🕯','🗑','🛢','💸','💵','💳','💎','🔧','🔨'],
    '符号': ['❤','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣','💕','💞','💓','💗','💖','💘','💝','💟','☮','✝','☪','🕉','☸','✡','🔯','🕎','☯','☦','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛','🉑']
};

// 精选小黄脸
const STICKER_DATA = ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘','😋','😛','😜','🤪','😝','🤑','🤗','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','🧐','😭','😢','😡','😠','🤬','😈','💀','👻','🤖','💩','🎉','🎊','💯','✨'];

function toggleEmojiPanel() {
    const panel = document.getElementById('emoji-panel');
    if (panel.classList.contains('show')) {
        closeEmojiPanel();
    } else {
        closeMoreMenu();
        closeMentionPanel();
        panel.classList.add('show');
        renderEmojiPanel();
    }
}

function closeEmojiPanel() {
    document.getElementById('emoji-panel').classList.remove('show');
}

// ================================================================
// + 号更多菜单
// ================================================================
function toggleMoreMenu(e) {
    if (e) e.stopPropagation();
    closeEmojiPanel();
    closeMentionPanel();
    document.getElementById('more-menu').classList.toggle('show');
}

function closeMoreMenu() {
    const el = document.getElementById('more-menu');
    if (el) el.classList.remove('show');
}

// ================================================================
// 语音消息
// ================================================================
const MAX_RECORD_SECONDS = 60;

function isRecording() {
    return State.recording && State.recording.recorder && State.recording.recorder.state === 'recording';
}

async function toggleRecording() {
    if (isRecording()) {
        stopRecordingAndSend();
        return;
    }
    if (!State.activeChat) {
        showToast('请先选择会话');
        return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('语音功能需要在 HTTPS 或 localhost 下访问');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const options = {};
        if (typeof MediaRecorder !== 'undefined') {
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) options.mimeType = 'audio/webm;codecs=opus';
            else if (MediaRecorder.isTypeSupported('audio/webm')) options.mimeType = 'audio/webm';
            else if (MediaRecorder.isTypeSupported('audio/mp4')) options.mimeType = 'audio/mp4';
        }
        const recorder = options.mimeType ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => handleRecorderStop(recorder, stream, chunks);
        recorder.start();
        State.recording = {
            recorder, stream, chunks,
            startTime: Date.now(),
            duration: 0,
            timer: setInterval(() => {
                const sec = Math.floor((Date.now() - State.recording.startTime) / 1000);
                State.recording.duration = sec;
                updateRecordingUI(sec);
                if (sec >= MAX_RECORD_SECONDS) stopRecordingAndSend();
            }, 200),
            cancelled: false,
            mimeType: recorder.mimeType || 'audio/webm'
        };
        // 切换 UI
        closeEmojiPanel(); closeMoreMenu(); closeMentionPanel();
        document.getElementById('input-toolbar').style.display = 'none';
        document.getElementById('recording-indicator').style.display = 'flex';
        document.getElementById('voice-btn').classList.add('recording');
        updateRecordingUI(0);
    } catch (e) {
        showToast('无法访问麦克风：' + (e && e.message ? e.message : '已拒绝'));
    }
}

function updateRecordingUI(sec) {
    const el = document.getElementById('rec-time');
    if (el) el.textContent = formatDuration(sec);
}

function handleRecorderStop(recorder, stream, chunks) {
    if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
    if (State.recording && State.recording.timer) {
        clearInterval(State.recording.timer);
    }
    const cancelled = State.recording && State.recording.cancelled;
    const duration = State.recording ? State.recording.duration : 0;
    const mimeType = State.recording ? State.recording.mimeType : 'audio/webm';
    // 恢复 UI
    document.getElementById('input-toolbar').style.display = '';
    document.getElementById('recording-indicator').style.display = 'none';
    document.getElementById('voice-btn').classList.remove('recording');
    State.recording = null;
    if (cancelled) return;
    if (!chunks || chunks.length === 0) return;
    const blob = new Blob(chunks, { type: mimeType });
    sendAudioMessage(blob, duration, mimeType);
}

function stopRecordingAndSend() {
    if (!isRecording()) return;
    State.recording.recorder.stop();
}

function cancelRecording() {
    if (!isRecording()) return;
    if (State.recording) State.recording.cancelled = true;
    State.recording.recorder.stop();
}

async function sendAudioMessage(blob, duration, mimeType) {
    if (!State.activeChat) return;
    if (duration < 1) {
        showToast('录音太短');
        return;
    }
    let ext = 'webm';
    if (mimeType && mimeType.includes('mp4')) ext = 'm4a';
    else if (mimeType && mimeType.includes('ogg')) ext = 'ogg';
    const file = new File([blob], 'voice-' + Date.now() + '.' + ext, { type: blob.type });
    try {
        const attachment = await apiUpload('/api/messages/upload', file);
        const req = {
            type: State.activeChat.type,
            content: '',
            contentType: 'AUDIO',
            attachmentUrl: attachment.url,
            attachmentName: file.name,
            attachmentSize: attachment.size,
            audioDuration: duration
        };
        if (State.activeChat.type === 'PRIVATE') req.receiverId = State.activeChat.peerId;
        else {
            req.groupId = State.activeChat.groupId;
            if (State.currentMentions && State.currentMentions.length > 0) {
                req.mentionUserIds = [...new Set(State.currentMentions.map(m => m.userId))];
            }
        }
        await apiPost('/api/messages', req);
    } catch (e) {
        showToast(e.message || '发送失败');
    }
}

function formatDuration(sec) {
    if (!sec || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
}

// 气泡内播放控制
const AUDIO_PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const AUDIO_PAUSE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

function toggleAudioPlay(btn) {
    const audio = btn.parentElement.querySelector('audio');
    if (!audio) return;
    if (audio.paused) {
        // 停止其他正在播放的
        document.querySelectorAll('.msg-bubble.audio audio').forEach(a => {
            if (a !== audio) { a.pause(); a.currentTime = 0; }
        });
        document.querySelectorAll('.audio-play-btn.playing').forEach(b => {
            b.classList.remove('playing');
            b.innerHTML = AUDIO_PLAY_SVG;
        });
        audio.play().catch(() => {});
        btn.classList.add('playing');
        btn.innerHTML = AUDIO_PAUSE_SVG;
    } else {
        audio.pause();
        btn.classList.remove('playing');
        btn.innerHTML = AUDIO_PLAY_SVG;
    }
}

function onAudioEnded(audio) {
    const btn = audio.parentElement.querySelector('.audio-play-btn');
    if (btn) {
        btn.classList.remove('playing');
        btn.innerHTML = AUDIO_PLAY_SVG;
    }
    audio.currentTime = 0;
}

// ================================================================
// 群聊 @ 浮层
// ================================================================
async function ensureGroupMembersCache(groupId) {
    if (State.groupMembersCache[groupId]) return State.groupMembersCache[groupId];
    try {
        const members = await apiGet('/api/groups/' + groupId + '/members');
        State.groupMembersCache[groupId] = members;
        return members;
    } catch {
        State.groupMembersCache[groupId] = [];
        return [];
    }
}

function openMentionPanel(keyword) {
    const panel = document.getElementById('mention-panel');
    const list = document.getElementById('mention-list');
    if (!panel || !list) return;
    if (!State.activeChat || State.activeChat.type !== 'GROUP') return;
    const members = State.groupMembersCache[State.activeChat.groupId] || [];
    const kw = (keyword || '').toLowerCase();
    // 第一项永远是"所有人"
    const candidates = [
        { id: -1, nickname: '所有人', username: '', avatar: null, isAll: true },
        ...members
    ].filter(m => {
        if (!kw) return true;
        return (m.nickname && m.nickname.toLowerCase().includes(kw))
            || (m.username && m.username.toLowerCase().includes(kw));
    });

    if (candidates.length === 0) { closeMentionPanel(); return; }

    list.innerHTML = '';
    candidates.forEach((m, idx) => {
        const item = document.createElement('div');
        item.className = 'mention-item' + (idx === 0 ? ' active' : '');
        const avatar = m.avatar
            ? '<img src="' + escapeAttr(m.avatar) + '">'
            : '<div class="avatar-circle" style="width:28px;height:28px;border-radius:50%;background:#07c160;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;">'
                + escapeHtml((m.nickname || m.username || '?').charAt(0).toUpperCase()) + '</div>';
        item.innerHTML = avatar + '<span class="mention-name">' + escapeHtml(m.nickname || m.username || '所有人') + '</span>';
        item.onclick = () => pickMention(m);
        list.appendChild(item);
    });
    panel.classList.add('show');
}

function closeMentionPanel() {
    const panel = document.getElementById('mention-panel');
    if (panel) panel.classList.remove('show');
}

function pickMention(user) {
    const ta = document.getElementById('input-box');
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const after = ta.value.slice(pos);
    const atIdx = before.lastIndexOf('@');
    if (atIdx < 0) { closeMentionPanel(); return; }
    const nickname = user.isAll ? '所有人' : (user.nickname || user.username);
    const insertText = '@' + nickname + ' ';
    ta.value = before.slice(0, atIdx) + insertText + after;
    const newPos = atIdx + insertText.length;
    ta.focus();
    ta.setSelectionRange(newPos, newPos);
    closeMentionPanel();
    syncMentionsFromText(ta.value);
}

// 每次输入/发送前从全文重解析 @ 列表（不维护区间，避免 backspace 同步 bug）
function syncMentionsFromText(text) {
    State.currentMentions = [];
    if (!State.activeChat || State.activeChat.type !== 'GROUP') return;
    const members = State.groupMembersCache[State.activeChat.groupId] || [];
    const nameMap = new Map();
    members.forEach(m => {
        const name = m.nickname || m.username;
        if (name) nameMap.set(name, m.id);
    });
    const regex = /@([^\s@]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const name = match[1];
        if (name === '所有人' || name === 'all') {
            State.currentMentions.push({ userId: -1, nickname: 'all' });
        } else if (nameMap.has(name)) {
            State.currentMentions.push({ userId: nameMap.get(name), nickname: name });
        }
    }
}

function switchEmojiTab(tab, el) {
    State.currentEmojiTab = tab;
    document.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    renderEmojiPanel();
}

function renderEmojiPanel() {
    const container = document.getElementById('emoji-content');
    container.innerHTML = '';

    if (State.currentEmojiTab === 'emoji') {
        // 分类显示
        Object.entries(EMOJI_DATA).forEach(([category, emojis]) => {
            const title = document.createElement('div');
            title.style.cssText = 'font-size:11px;color:#9ca3af;margin:4px 0 2px;';
            title.textContent = category;
            container.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'emoji-grid';
            emojis.forEach(e => {
                const item = document.createElement('div');
                item.className = 'emoji-item';
                item.textContent = e;
                item.onclick = () => insertEmoji(e);
                grid.appendChild(item);
            });
            container.appendChild(grid);
        });
    } else if (State.currentEmojiTab === 'sticker') {
        const grid = document.createElement('div');
        grid.className = 'emoji-grid';
        STICKER_DATA.forEach(e => {
            const item = document.createElement('div');
            item.className = 'emoji-item';
            item.style.fontSize = '28px';
            item.textContent = e;
            item.onclick = () => insertEmoji(e);
            grid.appendChild(item);
        });
        container.appendChild(grid);
    } else if (State.currentEmojiTab === 'mine') {
        const grid = document.createElement('div');
        grid.className = 'emoji-grid';
        if (State.myEmojis.length === 0) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#b0b0b0;font-size:13px;">还没有自定义表情</div>';
        } else {
            State.myEmojis.forEach(emoji => {
                const item = document.createElement('div');
                item.className = 'emoji-item custom-emoji';
                item.innerHTML = '<img src="' + escapeAttr(emoji.url) + '" title="' + escapeHtml(emoji.name || '') + '">';
                item.onclick = () => sendEmojiMessage(emoji.url);
                grid.appendChild(item);
            });
            container.appendChild(grid);
        }

        // 上传区
        const uploadZone = document.createElement('div');
        uploadZone.className = 'emoji-upload-zone';
        uploadZone.innerHTML = '<span class="emoji-upload-btn">+ 添加自定义表情</span>';
        uploadZone.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async () => {
                const file = input.files[0];
                if (!file) return;
                try {
                    await apiUpload('/api/emojis', file);
                    await refreshMyEmojis();
                    renderEmojiPanel();
                    showToast('表情上传成功');
                } catch (e) {
                    showToast(e.message);
                }
            };
            input.click();
        };
        container.appendChild(uploadZone);
    }
}

function insertEmoji(emoji) {
    const input = document.getElementById('input-box');
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.substring(0, start) + emoji + input.value.substring(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + emoji.length;

    // 记录最近使用
    saveRecentEmoji(emoji);
}

function sendEmojiMessage(url) {
    if (!State.activeChat) return;
    const req = {
        type: State.activeChat.type,
        contentType: 'IMAGE',
        attachmentUrl: url,
        attachmentThumb: url,
        content: ''
    };
    if (State.activeChat.type === 'PRIVATE') {
        req.receiverId = State.activeChat.peerId;
    } else {
        req.groupId = State.activeChat.groupId;
    }
    apiPost('/api/messages', req).catch(e => showToast(e.message));
}

function saveRecentEmoji(emoji) {
    let recent = JSON.parse(localStorage.getItem('recentEmojis') || '[]');
    recent = recent.filter(e => e !== emoji);
    recent.unshift(emoji);
    recent = recent.slice(0, 8);
    localStorage.setItem('recentEmojis', JSON.stringify(recent));
}

// ================================================================
// 详情面板
// ================================================================
function toggleDetailPanel() {
    State.detailPanelOpen = !State.detailPanelOpen;
    document.getElementById('detail-panel').classList.toggle('show', State.detailPanelOpen);
    if (State.detailPanelOpen) {
        renderDetailPanel();
    }
}

// 返回会话列表（移动端用）
function backToList() {
    // 清除当前会话的未读标记（避免返回后仍显示红点）
    if (State.activeChat) {
        State.unreadMap.set(State.activeChat.key, 0);
        updateBadges();
    }
    document.querySelector('.layout').classList.remove('mobile-chat-open');
    State.detailPanelOpen = false;
    document.getElementById('detail-panel').classList.remove('show');
    renderSidebar();
}

// ==================== 聊天记录搜索 ====================
function toggleSearchBar() {
    const bar = document.getElementById('search-bar');
    if (bar.classList.contains('show')) {
        closeSearchBar();
    } else {
        bar.classList.add('show');
        const input = document.getElementById('msg-search-input');
        input.value = '';
        document.getElementById('search-result-info').textContent = '';
        input.focus();
    }
}

function closeSearchBar() {
    document.getElementById('search-bar').classList.remove('show');
    document.getElementById('msg-search-input').value = '';
    document.getElementById('search-result-info').textContent = '';
    clearSearchHighlight();
    State.searchMatches = [];
    State.searchCurrentIdx = -1;
}

function clearSearchHighlight() {
    document.querySelectorAll('.msg-row.search-match').forEach(el => {
        el.classList.remove('search-match', 'search-current');
    });
    document.querySelectorAll('mark.search-highlight').forEach(m => {
        const parent = m.parentNode;
        parent.replaceChild(document.createTextNode(m.textContent), m);
        parent.normalize();
    });
}

let searchDebounce = null;
function doMessageSearch(keyword) {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => performSearch(keyword), 200);
}

function performSearch(keyword) {
    clearSearchHighlight();
    State.searchMatches = [];
    State.searchCurrentIdx = -1;

    keyword = (keyword || '').trim();
    const info = document.getElementById('search-result-info');

    if (!keyword) {
        info.textContent = '';
        return;
    }

    // 在已加载的消息行中查找（匹配消息文本内容）
    const rows = document.querySelectorAll('.msg-row');
    const lower = keyword.toLowerCase();
    const matches = [];
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(lower)) {
            matches.push(row);
        }
    });

    State.searchMatches = matches;
    if (matches.length === 0) {
        info.textContent = '无匹配';
        return;
    }

    // 高亮匹配行
    matches.forEach(el => el.classList.add('search-match'));
    // 高亮文本（仅在文本气泡内简单替换）
    highlightTextInRows(matches, keyword);

    State.searchCurrentIdx = matches.length - 1; // 默认定位最后一条（最新）
    focusCurrentMatch();
    info.textContent = (State.searchCurrentIdx + 1) + '/' + matches.length;
}

function highlightTextInRows(rows, keyword) {
    const regex = new RegExp(escapeRegExp(keyword), 'gi');
    rows.forEach(row => {
        // 只在文本气泡内高亮，避免破坏 DOM 结构
        row.querySelectorAll('.msg-bubble.text').forEach(bubble => {
            const text = bubble.textContent;
            if (!regex.test(text)) return;
            bubble.innerHTML = escapeHtml(text).replace(new RegExp(escapeRegExp(keyword), 'gi'),
                m => '<mark class="search-highlight">' + m + '</mark>');
        });
    });
}

function searchJump(direction) {
    if (State.searchMatches.length === 0) return;
    let idx = State.searchCurrentIdx + direction;
    if (idx < 0) idx = State.searchMatches.length - 1;
    if (idx >= State.searchMatches.length) idx = 0;
    State.searchCurrentIdx = idx;
    focusCurrentMatch();
    document.getElementById('search-result-info').textContent =
        (idx + 1) + '/' + State.searchMatches.length;
}

function focusCurrentMatch() {
    document.querySelectorAll('.msg-row.search-current').forEach(el => el.classList.remove('search-current'));
    if (State.searchCurrentIdx < 0 || State.searchCurrentIdx >= State.searchMatches.length) return;
    const el = State.searchMatches[State.searchCurrentIdx];
    el.classList.add('search-current');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function renderDetailPanel() {
    if (!State.detailPanelOpen || !State.activeChat) return;
    const title = document.getElementById('detail-title');
    const body = document.getElementById('detail-body');

    if (State.activeChat.type === 'GROUP') {
        title.textContent = '群信息';
        const group = State.groups.find(g => g.id === State.activeChat.groupId);
        let members = [];
        try {
            members = await apiGet('/api/groups/' + State.activeChat.groupId + '/members');
            // 缓存成员供 @ 浮层使用
            State.groupMembersCache[State.activeChat.groupId] = members;
        } catch (e) { console.warn('loadGroupMembers failed:', e.message); }
        const isOwner = group && State.me && group.ownerId === State.me.id;
        const groupAvatarInner = group && group.avatar
            ? '<img src="' + escapeAttr(group.avatar) + '" style="width:100%;height:100%;object-fit:cover;">'
            : escapeHtml((group ? group.name : '#').charAt(0).toUpperCase());
        const avatarHtml = isOwner
            ? '<div id="group-avatar-display" style="position:relative;cursor:pointer;">' +
                '<div style="width:64px;height:64px;border-radius:8px;margin:0 auto 12px;background:#07c160;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:600;overflow:hidden;">' + groupAvatarInner + '</div>' +
                '<div style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:-8px;margin-bottom:8px;">点击更换</div>' +
              '</div>' +
              '<input type="file" id="group-avatar-input" accept="image/*" style="display:none;" onchange="uploadGroupAvatar(this, ' + State.activeChat.groupId + ')">'
            : '<div style="width:64px;height:64px;border-radius:8px;margin:0 auto 12px;background:#07c160;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:600;overflow:hidden;">' + groupAvatarInner + '</div>';

        body.innerHTML = '<div style="text-align:center;padding:8px 0 12px;">' + avatarHtml + '</div>';

        // 群名（群主可编辑）
        const nameSection = document.createElement('div');
        nameSection.innerHTML = '<div class="detail-section-title">群名</div>';
        const nameRow = document.createElement('div');
        nameRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:12px;font-size:14px;';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'group-name-input';
        nameInput.value = group ? group.name : '';
        nameInput.maxLength = 100;
        nameInput.style.cssText = 'flex:1;padding:6px 8px;border:0.5px solid var(--border-light);border-radius:6px;background:var(--bg-input-box);color:var(--text-primary);font-size:14px;font-family:inherit;';
        nameInput.disabled = !isOwner;
        nameInput.dataset.original = group ? group.name : '';
        nameInput.onblur = () => updateGroupName(State.activeChat.groupId, nameInput);
        if (!isOwner) nameInput.style.opacity = '0.85';
        nameRow.appendChild(nameInput);
        nameSection.appendChild(nameRow);
        body.appendChild(nameSection);

        const memberTitle = document.createElement('div');
        memberTitle.className = 'detail-section-title';
        memberTitle.textContent = '群成员 (' + members.length + ')';
        body.appendChild(memberTitle);
        members.forEach(m => {
            const div = document.createElement('div');
            div.className = 'member-item';
            const avatar = document.createElement('div');
            avatar.className = 'member-avatar';
            if (m.avatar) {
                avatar.innerHTML = '<img src="' + m.avatar + '">';
            } else {
                avatar.textContent = (m.nickname || m.username || '?').charAt(0).toUpperCase();
            }
            const info = document.createElement('div');
            info.className = 'member-name';
            info.textContent = m.nickname || m.username;
            if (group && m.id === group.ownerId) {
                const tag = document.createElement('span');
                tag.style.cssText = 'margin-left:6px;font-size:11px;color:#fa9d3b;';
                tag.textContent = '群主';
                info.appendChild(tag);
            }
            if (m.signature) {
                const sig = document.createElement('div');
                sig.className = 'member-signature';
                sig.textContent = m.signature;
                info.appendChild(sig);
            }
            div.appendChild(avatar);
            div.appendChild(info);
            body.appendChild(div);
        });

        // 邀请按钮
        const inviteBtn = document.createElement('button');
        inviteBtn.className = 'btn-confirm';
        inviteBtn.style.cssText = 'width:100%;margin-top:16px;padding:8px;';
        inviteBtn.textContent = '邀请好友入群';
        inviteBtn.onclick = () => openInviteModal(State.activeChat.groupId);
        body.appendChild(inviteBtn);

        // 群主点击头像触发上传
        if (isOwner) {
            const display = document.getElementById('group-avatar-display');
            if (display) display.onclick = () => document.getElementById('group-avatar-input').click();
        }
    } else {
        title.textContent = '好友信息';
        const friend = State.friends.find(f => f.id === State.activeChat.peerId);
        if (friend) {
            body.innerHTML = '<div style="text-align:center;padding:16px 0;">' +
                '<div style="width:64px;height:64px;border-radius:8px;margin:0 auto 12px;background:#07c160;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:600;overflow:hidden;">' +
                (friend.avatar ? '<img src="' + escapeAttr(friend.avatar) + '" style="width:100%;height:100%;object-fit:cover;">' : escapeHtml((friend.nickname || friend.username || '?').charAt(0).toUpperCase())) +
                '</div>' +
                '<div style="font-size:16px;font-weight:600;">' + escapeHtml(friend.nickname || friend.username) + '</div>' +
                '<div style="font-size:13px;color:#9a9a9a;margin-top:4px;">@' + escapeHtml(friend.username) + '</div>' +
                (friend.signature ? '<div style="font-size:13px;color:#9a9a9a;margin-top:6px;">签名：' + escapeHtml(friend.signature) + '</div>' : '') +
                '</div>';
        }
    }
}

// ================================================================
// 模态弹窗
// ================================================================
function openModal(content) {
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('show');
}

// 好友申请列表
function openFriendRequestsModal() {
    const requests = State.pendingRequests;
    if (requests.length === 0) {
        openModal('<h3>好友申请</h3><div style="padding:40px 0;text-align:center;color:#b0b0b0;">暂无好友申请</div>');
        return;
    }

    let html = '<h3>好友申请 (' + requests.length + ')</h3><div class="modal-list">';
    requests.forEach(r => {
        const avatarHtml = r.fromAvatar
            ? '<img src="' + r.fromAvatar + '">'
            : escapeHtml((r.fromNickname || r.fromUsername || '?').charAt(0).toUpperCase());
        html += '<div class="modal-list-item">' +
            '<div class="modal-item-avatar">' + avatarHtml + '</div>' +
            '<div class="modal-item-body">' +
            '<div class="modal-item-name">' + escapeHtml(r.fromNickname || r.fromUsername) + '</div>' +
            '<div class="modal-item-desc">@' + escapeHtml(r.fromUsername) + '</div>' +
            '</div>' +
            '<div class="modal-item-actions">' +
            '<button class="btn-accept" onclick="acceptFriend(' + r.id + ')">接受</button>' +
            '<button class="btn-reject" onclick="rejectFriend(' + r.id + ')">拒绝</button>' +
            '</div>' +
            '</div>';
    });
    html += '</div>';
    openModal(html);
}

async function acceptFriend(requestId) {
    try {
        await apiPost('/api/friends/' + requestId + '/accept', {});
        showToast('已接受好友申请');
        closeModal();
        await refreshAll();
    } catch (e) {
        showToast(e.message);
    }
}

async function rejectFriend(requestId) {
    try {
        await apiPost('/api/friends/' + requestId + '/reject', {});
        showToast('已拒绝好友申请');
        closeModal();
        await refreshPendingRequests();
        updateBadges();
    } catch (e) {
        showToast(e.message);
    }
}

// 群邀请列表
function openInvitationsModal() {
    const invitations = State.pendingInvitations;
    if (invitations.length === 0) {
        openModal('<h3>群邀请</h3><div style="padding:40px 0;text-align:center;color:#b0b0b0;">暂无群邀请</div>');
        return;
    }

    let html = '<h3>群邀请 (' + invitations.length + ')</h3><div class="modal-list">';
    invitations.forEach(inv => {
        html += '<div class="modal-list-item">' +
            '<div class="modal-item-avatar" style="background:#7a7a7a;border-radius:8px;">#</div>' +
            '<div class="modal-item-body">' +
            '<div class="modal-item-name">' + escapeHtml(inv.groupName || '群组') + '</div>' +
            '<div class="modal-item-desc">' + escapeHtml(inv.inviterName || '') + ' 邀请你加入</div>' +
            '</div>' +
            '<div class="modal-item-actions">' +
            '<button class="btn-accept" onclick="acceptInvitation(' + inv.id + ')">接受</button>' +
            '<button class="btn-reject" onclick="rejectInvitation(' + inv.id + ')">拒绝</button>' +
            '</div>' +
            '</div>';
    });
    html += '</div>';
    openModal(html);
}

async function acceptInvitation(invitationId) {
    try {
        await apiPost('/api/groups/invitations/' + invitationId + '/accept', {});
        showToast('已加入群组');
        closeModal();
        await refreshAll();
        if (State.connected) subscribeAll();
    } catch (e) {
        showToast(e.message);
    }
}

async function rejectInvitation(invitationId) {
    try {
        await apiPost('/api/groups/invitations/' + invitationId + '/reject', {});
        showToast('已拒绝群邀请');
        closeModal();
        await refreshPendingInvitations();
        updateBadges();
    } catch (e) {
        showToast(e.message);
    }
}

// 创建群组
function openCreateGroupModal() {
    if (State.friends.length === 0) {
        showToast('请先添加好友');
        return;
    }

    let html = '<h3>创建群组</h3>' +
        '<div class="form-group"><label>群名称</label>' +
        '<input type="text" id="group-name-input" placeholder="输入群名称" style="width:100%;padding:8px 12px;border:1px solid #e5e6eb;border-radius:6px;font-size:14px;"></div>' +
        '<div class="detail-section-title">选择成员</div>' +
        '<div class="checkbox-list">';

    State.friends.forEach(f => {
        html += '<label class="checkbox-item">' +
            '<input type="checkbox" value="' + f.id + '" style="margin-right:8px;">' +
            '<span>' + escapeHtml(f.nickname || f.username) + '</span>' +
            '</label>';
    });

    html += '</div>' +
        '<div class="modal-footer">' +
        '<button class="btn-cancel" onclick="closeModal()">取消</button>' +
        '<button class="btn-confirm" onclick="createGroup()">创建</button>' +
        '</div>';
    openModal(html);
}

async function createGroup() {
    const name = document.getElementById('group-name-input').value.trim();
    if (!name) { showToast('请输入群名称'); return; }
    const checked = document.querySelectorAll('.checkbox-list input:checked');
    const memberIds = Array.from(checked).map(c => parseInt(c.value));
    if (memberIds.length === 0) { showToast('请选择至少一名成员'); return; }

    try {
        await apiPost('/api/groups', { name, memberIds });
        showToast('群组创建成功');
        closeModal();
        await refreshAll();
        if (State.connected) subscribeAll();
    } catch (e) {
        showToast(e.message);
    }
}

// 邀请好友入群
function openInviteModal(groupId) {
    const availableFriends = State.friends.filter(f => {
        return !State.groups.find(g => g.id === groupId);
    });

    let html = '<h3>邀请好友入群</h3>' +
        '<div class="checkbox-list">';
    if (State.friends.length === 0) {
        html += '<div style="padding:20px;text-align:center;color:#b0b0b0;">暂无好友</div>';
    } else {
        State.friends.forEach(f => {
            html += '<label class="checkbox-item">' +
                '<input type="checkbox" value="' + f.id + '" style="margin-right:8px;">' +
                '<span>' + escapeHtml(f.nickname || f.username) + '</span>' +
                '</label>';
        });
    }
    html += '</div>' +
        '<div class="modal-footer">' +
        '<button class="btn-cancel" onclick="closeModal()">取消</button>' +
        '<button class="btn-confirm" onclick="inviteMembers(' + groupId + ')">邀请</button>' +
        '</div>';
    openModal(html);
}

async function inviteMembers(groupId) {
    const checked = document.querySelectorAll('.checkbox-list input:checked');
    const inviteeIds = Array.from(checked).map(c => parseInt(c.value));
    if (inviteeIds.length === 0) { showToast('请选择好友'); return; }

    try {
        await apiPost('/api/groups/' + groupId + '/invitations', { inviteeIds });
        showToast('邀请已发送');
        closeModal();
    } catch (e) {
        showToast(e.message);
    }
}

// 个人信息（头像上传）
async function showMyInfo() {
    const me = State.me;
    const avatarHtml = me.avatar
        ? '<img src="' + me.avatar + '">'
        : escapeHtml((me.nickname || me.username || '?').charAt(0).toUpperCase());

    const html = '<h3>个人信息<span class="modal-close" onclick="closeModal()">×</span></h3>' +
        '<div class="my-info-header">' +
            '<div id="my-avatar-display" class="my-info-avatar" onclick="document.getElementById(\'avatar-file-input\').click()">' +
                avatarHtml +
            '</div>' +
            '<div class="my-info-meta">' +
                '<div class="my-info-nickname">' + escapeHtml(me.nickname || '未设置昵称') + '</div>' +
                '<div class="my-info-username">@' + escapeHtml(me.username || '') + '</div>' +
                '<div class="my-info-hint">点击头像可更换</div>' +
            '</div>' +
            '<input type="file" id="avatar-file-input" accept="image/*" style="display:none;" onchange="uploadAvatar(this)">' +
        '</div>' +
        '<div class="setting-section-title">个性签名</div>' +
        '<div id="my-signature" class="signature-box" contenteditable="true" style="outline:none;" onblur="saveMySignature()" data-original="' + escapeHtml(me.signature || '') + '">' + escapeHtml(me.signature || '') + '</div>' +
        '<div class="setting-section-title">主题模式</div>' +
        '<div class="theme-switch-row">' +
            buildThemeBtn('light') +
            buildThemeBtn('dark') +
            buildThemeBtn('tech') +
            buildThemeBtn('pastoral') +
        '</div>' +
        '<div class="setting-section-title">气泡颜色</div>' +
        '<div class="bubble-color-row">' +
            buildBubbleColorDot('white', '白') +
            buildBubbleColorDot('blue', '蓝') +
            buildBubbleColorDot('green', '绿') +
            buildBubbleColorDot('cyber', '⚡', '赛博朋克') +
            buildBubbleColorDot('meadow', '🌿', '田园') +
            buildBubbleColorDot('galaxy', '✨', '星空') +
        '</div>' +
        '<div class="my-info-actions">' +
            '<button class="my-info-btn favorites" onclick="openFavoritesModal()">⭐ 我的收藏</button>' +
            '<button class="my-info-btn logout" onclick="confirmLogout()">退出登录</button>' +
        '</div>';
    openModal(html);
}

// 构建主题切换按钮（带选中态）
function buildThemeBtn(key) {
    const cfg = THEMES[key] || THEMES.light;
    const current = localStorage.getItem('theme') || 'light';
    return '<div class="theme-switch-btn' + (current === key ? ' active' : '') + '" data-theme="' + key + '" ' +
        'onclick="applyTheme(\'' + key + '\')">' + cfg.label + '</div>';
}

function buildBubbleColorDot(key, label, title) {
    const cfg = BUBBLE_COLORS[key] || BUBBLE_COLORS.green;
    const selected = (localStorage.getItem('bubbleColor') || 'green') === key;
    return '<div class="bubble-color-dot' + (selected ? ' selected' : '') + '" data-color="' + key + '" ' +
        'style="background:' + bubbleBackground(key) + ';color:' + cfg.text + ';" ' +
        'onclick="applyBubbleColor(\'' + key + '\')" title="' + (title || label) + '">' + label + '</div>';
}

function confirmLogout() {
    if (confirm('确定要退出当前账号吗？')) {
        logout();
    }
}

async function saveMySignature() {
    const el = document.getElementById('my-signature');
    if (!el) return;
    const signature = el.innerText.trim();
    // 与原值相同则不请求，避免初次渲染或未改动触发
    const original = el.dataset.original || '';
    if (signature === original) return;
    if (signature.length > 200) {
        showToast('签名最长 200 字');
        return;
    }
    try {
        await apiPut('/api/users/me/profile', { signature });
        if (State.me) {
            State.me.signature = signature;
            localStorage.setItem('me', JSON.stringify(State.me));
        }
        el.dataset.original = signature;
        showToast('签名已保存');
    } catch (e) {
        showToast(e.message);
    }
}

// ==================== 收藏功能 ====================
async function favoriteMessage(msgId, btn) {
    try {
        await apiPost('/api/favorites', { messageId: msgId, note: '' });
        if (btn) {
            btn.textContent = '已收藏';
            btn.style.color = '#10b981';
        }
        showToast('已收藏');
    } catch (e) {
        showToast(e.message);
    }
}

async function openFavoritesModal() {
    try {
        State.favorites = await apiGet('/api/favorites');
    } catch {
        State.favorites = [];
    }
    renderFavoritesList();
}

function renderFavoritesList() {
    const list = State.favorites;
    let html = '<h3>我的收藏 (' + list.length + ')<span class="modal-close" onclick="closeModal()">×</span></h3>';
    if (list.length === 0) {
        html += '<div style="padding:40px 0;text-align:center;color:#b0b0b0;">暂无收藏</div>';
        openModal(html);
        return;
    }
    html += '<div class="modal-list">';
    list.forEach(fav => {
        const msgContent = favoriteMsgPreview(fav);
        html += '<div class="modal-list-item" style="align-items:flex-start;">' +
            '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;color:#4e5969;margin-bottom:4px;">' +
            escapeHtml(fav.senderName || '') + ' · ' + formatTime(fav.sendTime) +
            '</div>' +
            '<div style="font-size:14px;color:#1f2329;word-break:break-word;">' + msgContent + '</div>' +
            (fav.note ?
                '<div style="margin-top:6px;padding:6px 8px;background:#f5f5f5;border-radius:4px;font-size:12px;color:#4e5969;">📝 ' + escapeHtml(fav.note) + '</div>' : '') +
            '</div>' +
            '<div class="modal-item-actions" style="flex-direction:column;gap:4px;">' +
            '<button class="btn-accept" onclick="openEditNoteModal(' + fav.id + ')">' + (fav.note ? '改笔记' : '加笔记') + '</button>' +
            '<button class="btn-reject" onclick="removeFavorite(' + fav.id + ')">取消收藏</button>' +
            '</div>' +
            '</div>';
    });
    html += '</div>';
    openModal(html);
}

function favoriteMsgPreview(fav) {
    if (fav.messageDeleted) return '<i style="color:#b0b0b0;">原消息已被删除</i>';
    switch (fav.contentType) {
        case 'TEXT':
        case 'EMOJI':
            return escapeHtml(fav.content || '');
        case 'IMAGE':
            return (fav.attachment && fav.attachment.thumbUrl)
                ? '<img src="' + fav.attachment.thumbUrl + '" style="max-width:120px;max-height:120px;border-radius:4px;">'
                : '[图片]';
        case 'FILE':
            return '<span style="color:#07c160;">[文件]</span> ' + escapeHtml((fav.attachment && fav.attachment.name) || '');
        case 'AUDIO':
            return '<span style="color:#fa9d3b;">[语音]</span> ' + formatDuration(fav.audioDuration || 0);
        default:
            return escapeHtml(fav.content || '');
    }
}

function openEditNoteModal(favoriteId) {
    const fav = State.favorites.find(f => f.id === favoriteId);
    const currentNote = fav ? (fav.note || '') : '';
    const html = '<h3>编辑笔记<span class="modal-close" onclick="openFavoritesModal()">×</span></h3>' +
        '<div class="form-group">' +
        '<textarea id="fav-note-input" style="width:100%;min-height:120px;padding:10px;border:1px solid #e5e6eb;border-radius:6px;font-size:14px;resize:vertical;font-family:inherit;" placeholder="为这条收藏添加备注...">' + escapeHtml(currentNote) + '</textarea>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button class="btn-cancel" onclick="openFavoritesModal()">取消</button>' +
        '<button class="btn-confirm" onclick="saveFavoriteNote(' + favoriteId + ')">保存</button>' +
        '</div>';
    document.getElementById('modal-content').innerHTML = html;
}

async function saveFavoriteNote(favoriteId) {
    const note = document.getElementById('fav-note-input').value;
    try {
        await api('/api/favorites/' + favoriteId, { method: 'PUT', body: JSON.stringify({ note: note }) });
        showToast('笔记已保存');
        await openFavoritesModal();
    } catch (e) {
        showToast(e.message);
    }
}

async function removeFavorite(favoriteId) {
    if (!confirm('确定取消这条收藏？')) return;
    try {
        await apiDelete('/api/favorites/' + favoriteId);
        showToast('已取消收藏');
        await openFavoritesModal();
    } catch (e) {
        showToast(e.message);
    }
}

async function uploadAvatar(input) {
    const file = input.files[0];
    if (!file) return;
    try {
        const resp = await apiUpload('/api/users/me/avatar', file);
        State.me.avatar = resp.url;
        localStorage.setItem('me', JSON.stringify(State.me));
        renderNavAvatar();
        // 更新弹窗内头像
        const display = document.getElementById('my-avatar-display');
        if (display) {
            display.innerHTML = '<img src="' + resp.url + '" style="width:100%;height:100%;object-fit:cover;">';
        }
        showToast('头像更新成功');
    } catch (e) {
        showToast(e.message);
    }
}

async function uploadGroupAvatar(input, groupId) {
    const file = input.files[0];
    if (!file) return;
    try {
        const resp = await apiUpload('/api/groups/' + groupId + '/avatar', file);
        // 更新本地缓存
        const g = State.groups.find(g => g.id === groupId);
        if (g) g.avatar = resp.url;
        // 更新详情面板内头像显示
        const display = document.getElementById('group-avatar-display');
        if (display) {
            const inner = display.querySelector('div');
            if (inner) inner.innerHTML = '<img src="' + resp.url + '" style="width:100%;height:100%;object-fit:cover;">';
        }
        renderSidebar();
        showToast('群头像已更新');
    } catch (e) {
        showToast(e.message);
    }
}

async function updateGroupName(groupId, input) {
    const name = input.value.trim();
    const original = input.dataset.original || '';
    if (name === original) return;
    if (!name) {
        showToast('群名不能为空');
        input.value = original;
        return;
    }
    if (name.length > 100) {
        showToast('群名最长 100 字');
        return;
    }
    try {
        await apiPut('/api/groups/' + groupId, { name });
        const g = State.groups.find(g => g.id === groupId);
        if (g) g.name = name;
        input.dataset.original = name;
        // 更新聊天区标题
        if (State.activeChat && State.activeChat.groupId === groupId) {
            document.getElementById('chat-title').textContent = name;
            State.activeChat.title = name;
        }
        renderSidebar();
        showToast('群名已更新');
    } catch (e) {
        showToast(e.message);
    }
}

// 点击空白处关闭弹窗
document.addEventListener('click', (e) => {
    // 关闭表情面板
    const emojiPanel = document.getElementById('emoji-panel');
    const emojiBtn = document.getElementById('emoji-btn');
    if (emojiPanel.classList.contains('show') &&
        !emojiPanel.contains(e.target) && !emojiBtn.contains(e.target)) {
        closeEmojiPanel();
    }
    // 关闭 + 号更多菜单
    const moreMenu = document.getElementById('more-menu');
    if (moreMenu && moreMenu.classList.contains('show') &&
        !moreMenu.contains(e.target) && !e.target.closest('.more-trigger')) {
        closeMoreMenu();
    }
    // 关闭 @ 浮层（点击 textarea 内不算）
    const mentionPanel = document.getElementById('mention-panel');
    if (mentionPanel && mentionPanel.classList.contains('show') &&
        !mentionPanel.contains(e.target) && e.target.id !== 'input-box') {
        closeMentionPanel();
    }
    // 关闭模态
    if (e.target.id === 'modal-overlay') {
        closeModal();
    }
});

// 键盘 Enter 提交登录
document.getElementById('auth-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAuth();
});

// 点击导航栏的 badge 打开对应弹窗
document.getElementById('nav-contacts').addEventListener('click', () => {
    // 在通讯录 tab 中可以查看好友申请和群邀请
});

// 暴露给全局
window.handleAuth = handleAuth;
window.validateAuthInput = validateAuthInput;
window.switchAuthMode = switchAuthMode;
window.switchTab = switchTab;
window.handleSearchInput = handleSearchInput;
window.handleInput = handleInput;
window.handleInputKeyDown = handleInputKeyDown;
window.handleSend = handleSend;
window.handleImageUpload = handleImageUpload;
window.handleFileUpload = handleFileUpload;
window.toggleEmojiPanel = toggleEmojiPanel;
window.switchEmojiTab = switchEmojiTab;
window.toggleDetailPanel = toggleDetailPanel;
window.backToList = backToList;
window.showConvActionSheet = showConvActionSheet;
window.clearChatHistory = clearChatHistory;
window.deleteConversation = deleteConversation;
window.toggleSearchBar = toggleSearchBar;
window.closeSearchBar = closeSearchBar;
window.doMessageSearch = doMessageSearch;
window.searchJump = searchJump;
window.confirmLogout = confirmLogout;
window.applyTheme = applyTheme;
window.applyBubbleColor = applyBubbleColor;
window.favoriteMessage = favoriteMessage;
window.openFavoritesModal = openFavoritesModal;
window.openEditNoteModal = openEditNoteModal;
window.saveFavoriteNote = saveFavoriteNote;
window.removeFavorite = removeFavorite;
window.openFriendRequestsModal = openFriendRequestsModal;
window.openInvitationsModal = openInvitationsModal;
window.openCreateGroupModal = openCreateGroupModal;
window.openInviteModal = openInviteModal;
window.acceptFriend = acceptFriend;
window.rejectFriend = rejectFriend;
window.acceptInvitation = acceptInvitation;
window.rejectInvitation = rejectInvitation;
window.createGroup = createGroup;
window.inviteMembers = inviteMembers;
window.showMyInfo = showMyInfo;
window.uploadAvatar = uploadAvatar;
window.recallMessage = recallMessage;
window.deleteMessage = deleteMessage;
window.logout = logout;
window.closeModal = closeModal;
window.closeLightbox = closeLightbox;

// 覆盖通讯录 tab 的 badge 点击：打开对应弹窗
document.getElementById('badge-requests').parentElement.addEventListener('click', (e) => {
    e.stopPropagation();
    if (State.pendingRequests.length > 0) {
        openFriendRequestsModal();
    } else if (State.pendingInvitations.length > 0) {
        openInvitationsModal();
    }
});

// ================================================================
// 初始化
// ================================================================
// 主题 & 气泡颜色（提前执行，避免页面闪烁）
const BUBBLE_COLORS = {
    // 纯色
    white:  { type: 'solid',    stops: ['#FFFFFF'],                        text: '#1F2329', shadow: '255, 255, 255' },
    blue:   { type: 'solid',    stops: ['#4A90E2'],                        text: '#FFFFFF', shadow: '74, 144, 226' },
    green:  { type: 'solid',    stops: ['#95EC69'],                        text: '#1F2329', shadow: '149, 236, 105' },
    // 渐变
    cyber:  { type: 'gradient', stops: ['#FF2E97', '#7C4DFF', '#00E5FF'], text: '#FFFFFF', shadow: '124, 77, 255' },
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

// 主题定义表：name/label/是否暗色基底/安卓状态栏色
const THEMES = {
    light:    { label: '☀️ 白天', dark: false, statusBar: '#F5F5F7' },
    dark:     { label: '🌙 黑夜', dark: true,  statusBar: '#000000' },
    tech:     { label: '🌌 科技', dark: true,  statusBar: '#0A0E1A' },
    pastoral: { label: '🌿 田园', dark: false, statusBar: '#FAF6EF' }
};

(function loadSavedTheme() {
    try {
        const theme = localStorage.getItem('theme') || 'light';
        if (theme === 'dark' || theme === 'tech') document.body.classList.add('theme-dark');
        if (theme === 'tech') document.body.classList.add('theme-tech');
        if (theme === 'pastoral') document.body.classList.add('theme-pastoral');
        const bubble = localStorage.getItem('bubbleColor') || 'green';
        const cfg = BUBBLE_COLORS[bubble] || BUBBLE_COLORS.green;
        document.documentElement.style.setProperty('--bubble-mine', bubbleBackground(bubble));
        document.documentElement.style.setProperty('--bubble-mine-rgb', cfg.shadow);
        document.documentElement.style.setProperty('--text-bubble-mine', cfg.text);
        // 页面加载后通知原生状态栏当前主题色
        notifyNativeStatusBar(theme);
    } catch {}
})();

function applyTheme(theme) {
    const cfg = THEMES[theme] ? theme : 'light';
    localStorage.setItem('theme', cfg);
    // 清除所有主题类，再挂当前主题类（tech 挂双类继承暗色组件样式）
    document.body.classList.remove('theme-dark', 'theme-tech', 'theme-pastoral');
    if (cfg === 'dark' || cfg === 'tech') document.body.classList.add('theme-dark');
    if (cfg === 'tech') document.body.classList.add('theme-tech');
    if (cfg === 'pastoral') document.body.classList.add('theme-pastoral');
    // 刷新"我的"弹窗中的主题按钮选中态
    document.querySelectorAll('.theme-switch-btn').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === cfg);
    });
    // 通知原生状态栏跟随主题变色
    notifyNativeStatusBar(cfg);
}

/** 通知 Android 原生状态栏颜色（跟随主题）。 */
function notifyNativeStatusBar(theme) {
    try {
        if (window.AndroidBridge && AndroidBridge.setStatusBarColor) {
            // 从主题表取状态栏色（与页面 --bg-page 一致），未知主题回退浅色
            const cfg = (typeof THEMES !== 'undefined' && THEMES[theme]) || THEMES.light;
            AndroidBridge.setStatusBarColor(cfg.statusBar);
        }
    } catch {}
}

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

(async function init() {
    const restored = await tryRestoreSession();
    if (restored) {
        enterMainPage();
    }
})();

// ================================================================
// Android 返回键拦截协议：按优先级关闭当前最上层浮层。
// 返回 true 表示前端已处理（关闭了某浮层），返回 false 让 app 退出。
// 由 WebView 套壳在 canGoBack()=false 时调用。
// ================================================================
window.handleNativeBack = function () {
    try {
        // 0. 吃啥页：先关时间轴抽屉，再切回消息 tab
        var eatHistoryPanel = document.getElementById('eat-history-panel');
        if (eatHistoryPanel && eatHistoryPanel.classList.contains('show')) {
            if (typeof toggleEatHistory === 'function') toggleEatHistory(false);
            return true;
        }
        if (typeof State !== 'undefined' && State.currentTab === 'eat') {
            if (typeof switchTab === 'function') switchTab('sessions');
            return true;
        }
        // 1. 图片灯箱（z-index 最高 500）
        var lightbox = document.getElementById('lightbox');
        if (lightbox && lightbox.classList.contains('show')) {
            closeLightbox();
            return true;
        }
        // 2. 通用 modal（好友申请/群邀请/创建群/邀请入群/个人信息/收藏/笔记编辑）
        var modal = document.getElementById('modal-overlay');
        if (modal && modal.classList.contains('show')) {
            closeModal();
            return true;
        }
        // 3. 聊天搜索栏
        var searchBar = document.getElementById('search-bar');
        if (searchBar && searchBar.classList.contains('show')) {
            closeSearchBar();
            return true;
        }
        // 4. 表情面板
        var emojiPanel = document.getElementById('emoji-panel');
        if (emojiPanel && emojiPanel.classList.contains('show')) {
            closeEmojiPanel();
            return true;
        }
        // 5. 详情面板
        var detailPanel = document.getElementById('detail-panel');
        var detailOpen = detailPanel && detailPanel.classList.contains('show')
            || (typeof State !== 'undefined' && State.detailPanelOpen);
        if (detailOpen) {
            if (detailPanel) detailPanel.classList.remove('show');
            if (typeof State !== 'undefined') State.detailPanelOpen = false;
            return true;
        }
        // 6. 移动端聊天视图抽屉（chat-area 滑入覆盖列表）
        var layout = document.querySelector('.layout');
        if (layout && layout.classList.contains('mobile-chat-open')) {
            if (typeof backToList === 'function') backToList();
            else layout.classList.remove('mobile-chat-open');
            return true;
        }
    } catch (e) {
        console.warn('handleNativeBack error:', e);
    }
    return false;
};
