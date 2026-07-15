package com.aiwebchat.service;

import com.aiwebchat.dto.*;

import com.aiwebchat.entity.User;

import java.util.List;

public interface MessageService {

    MessageVO sendMessage(MessageSendRequest request, User sender);

    List<MessageVO> listPrivateHistory(Long meId, Long peerId);

    List<MessageVO> listGroupHistory(Long groupId);

    MessageVO recallMessage(Long messageId, User operator);

    void deleteMessage(Long messageId, User operator);

    void markRead(MessageReadRequest request, User currentUser);

    List<UnreadVO> listUnread(Long userId);

    List<ConversationVO> listConversations(Long userId);
}
