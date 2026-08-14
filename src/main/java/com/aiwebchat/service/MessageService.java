package com.aiwebchat.service;

import com.aiwebchat.dto.*;

import com.aiwebchat.entity.User;

import java.util.List;

public interface MessageService {

    MessageVO sendMessage(MessageSendRequest request, User sender);

    List<MessageVO> listPrivateHistory(Long meId, Long peerId);

    List<MessageVO> listGroupHistory(Long groupId, Long currentUserId);

    /** 分页查询私聊历史消息 */
    PagedResult<MessageVO> listPrivateHistoryPaged(Long meId, Long peerId, int page, int size);

    /** 分页查询群聊历史消息 */
    PagedResult<MessageVO> listGroupHistoryPaged(Long groupId, Long currentUserId, int page, int size);

    MessageVO recallMessage(Long messageId, User operator);

    void deleteMessage(Long messageId, User operator);

    void markRead(MessageReadRequest request, User currentUser);

    List<UnreadVO> listUnread(Long userId);

    List<ConversationVO> listConversations(Long userId);

    /** 清空私聊聊天记录（仅删除当前用户视角的消息） */
    void clearPrivateHistory(Long userId, Long peerId);

    /** 清空群聊聊天记录（仅删除当前用户发送的消息） */
    void clearGroupHistory(Long groupId, Long userId);
}
