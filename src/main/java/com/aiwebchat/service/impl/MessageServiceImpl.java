package com.aiwebchat.service.impl;

import com.aiwebchat.dto.*;
import com.aiwebchat.entity.*;
import com.aiwebchat.exception.BusinessException;
import com.aiwebchat.repository.*;
import com.aiwebchat.service.MessageService;
import com.aiwebchat.service.NotifyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageServiceImpl implements MessageService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final ChatGroupRepository groupRepository;
    private final FriendshipRepository friendshipRepository;
    private final ConversationReadCursorRepository cursorRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotifyService notifyService;

    private static final long RECALL_WINDOW_SECONDS = 120; // 2 分钟

    // ==================== 发送消息 ====================

    @Override
    @Transactional
    public MessageVO sendMessage(MessageSendRequest request, User sender) {
        // 填充默认 contentType
        Message.ContentType contentType = request.getContentType();
        if (contentType == null) {
            contentType = Message.ContentType.TEXT;
        }

        // 内容校验：TEXT/EMOJI 需要 content；IMAGE/FILE 需要 attachmentUrl
        if (contentType == Message.ContentType.TEXT || contentType == Message.ContentType.EMOJI) {
            if (request.getContent() == null || request.getContent().isBlank()) {
                throw BusinessException.badRequest("消息内容不能为空");
            }
        } else if (contentType == Message.ContentType.IMAGE || contentType == Message.ContentType.FILE || contentType == Message.ContentType.AUDIO) {
            if (request.getAttachmentUrl() == null || request.getAttachmentUrl().isBlank()) {
                throw BusinessException.badRequest("附件 URL 不能为空");
            }
            if (request.getContent() == null) {
                request.setContent("");
            }
        }

        if (request.getType() == Message.MessageType.PRIVATE) {
            return sendPrivateMessage(request, sender, contentType);
        } else if (request.getType() == Message.MessageType.GROUP) {
            return sendGroupMessage(request, sender, contentType);
        }
        throw BusinessException.badRequest("未知消息类型: " + request.getType());
    }

    private MessageVO sendPrivateMessage(MessageSendRequest request, User sender, Message.ContentType contentType) {
        Long receiverId = request.getReceiverId();
        if (receiverId == null) {
            throw BusinessException.badRequest("私聊消息必须指定 receiverId");
        }
        userRepository.findById(receiverId)
                .orElseThrow(() -> BusinessException.notFound("接收方不存在: " + receiverId));

        Message message = buildMessage(request, sender, contentType, Message.MessageType.PRIVATE);
        message.setReceiverId(receiverId);
        message = messageRepository.save(message);

        MessageVO vo = toVO(message, sender, sender.getId());

        messagingTemplate.convertAndSend("/topic/user." + receiverId, vo);
        messagingTemplate.convertAndSend("/topic/user." + sender.getId(), vo);
        log.debug("Private message {} -> {} pushed", sender.getId(), receiverId);
        return vo;
    }

    private MessageVO sendGroupMessage(MessageSendRequest request, User sender, Message.ContentType contentType) {
        Long groupId = request.getGroupId();
        if (groupId == null) {
            throw BusinessException.badRequest("群聊消息必须指定 groupId");
        }
        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, sender.getId())) {
            throw BusinessException.badRequest("你不在该群中，无权发送消息");
        }

        Message message = buildMessage(request, sender, contentType, Message.MessageType.GROUP);
        message.setGroupId(groupId);
        message = messageRepository.save(message);

        MessageVO vo = toVO(message, sender, sender.getId());
        messagingTemplate.convertAndSend("/topic/group." + groupId, vo);
        log.debug("Group message to group {} pushed", groupId);
        return vo;
    }

    private Message buildMessage(MessageSendRequest request, User sender, Message.ContentType contentType, Message.MessageType type) {
        return Message.builder()
                .type(type)
                .senderId(sender.getId())
                .content(request.getContent() == null ? "" : request.getContent())
                .contentType(contentType)
                .attachmentUrl(request.getAttachmentUrl())
                .attachmentName(request.getAttachmentName())
                .attachmentSize(request.getAttachmentSize())
                .attachmentThumb(request.getAttachmentThumb() != null ? request.getAttachmentThumb() : request.getAttachmentUrl())
                .audioDuration(request.getAudioDuration())
                .mentionUserIds(joinMentions(request.getMentionUserIds()))
                .status(Message.Status.NORMAL)
                .build();
    }

    private String joinMentions(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return null;
        return ids.stream().distinct().map(String::valueOf).collect(Collectors.joining(","));
    }

    private List<Long> parseMentions(String raw) {
        if (raw == null || raw.isBlank()) return Collections.emptyList();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> "all".equals(s) ? -1L : Long.parseLong(s))
                .toList();
    }

    // ==================== 历史消息 ====================

    @Override
    public List<MessageVO> listPrivateHistory(Long meId, Long peerId) {
        List<Message> messages = messageRepository.findPrivateHistoryAll(meId, peerId);
        return convertMessagesToVOs(messages, meId);
    }

    @Override
    public List<MessageVO> listGroupHistory(Long groupId, Long currentUserId) {
        // 权限校验：只有群成员才能查看群消息
        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, currentUserId)) {
            throw BusinessException.badRequest("你不在该群中，无权查看消息");
        }
        List<Message> messages = messageRepository.findGroupHistoryAll(groupId);
        return convertMessagesToVOs(messages, currentUserId);
    }

    // ==================== 分页历史消息 ====================

    @Override
    public PagedResult<MessageVO> listPrivateHistoryPaged(Long meId, Long peerId, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("sendTime").descending());
        Page<Message> msgPage = messageRepository.findPrivateHistory(meId, peerId, pageable);
        List<MessageVO> vos = new ArrayList<>(convertMessagesToVOs(msgPage.getContent(), meId));
        // 按时间正序返回（前端渲染需要从旧到新）
        Collections.reverse(vos);
        return PagedResult.of(vos, msgPage.getTotalElements(), msgPage.getTotalPages(), page, size);
    }

    @Override
    public PagedResult<MessageVO> listGroupHistoryPaged(Long groupId, Long currentUserId, int page, int size) {
        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, currentUserId)) {
            throw BusinessException.badRequest("你不在该群中，无权查看消息");
        }
        PageRequest pageable = PageRequest.of(page, size, Sort.by("sendTime").descending());
        Page<Message> msgPage = messageRepository.findGroupHistory(groupId, pageable);
        List<MessageVO> vos = new ArrayList<>(convertMessagesToVOs(msgPage.getContent(), currentUserId));
        Collections.reverse(vos);
        return PagedResult.of(vos, msgPage.getTotalElements(), msgPage.getTotalPages(), page, size);
    }

    /**
     * 批量将 Message 列表转为 VO 列表（消除 N+1 查询）。
     * 一次性批量获取所有 sender 的 User 信息。
     */
    private List<MessageVO> convertMessagesToVOs(List<Message> messages, Long currentUserId) {
        if (messages.isEmpty()) return List.of();

        // 批量查询所有 sender
        Set<Long> senderIds = messages.stream().map(Message::getSenderId).collect(Collectors.toSet());
        Map<Long, User> senderMap = userRepository.findAllById(senderIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        // 批量查询私聊已读游标（消除 toVO 中的逐条查询）
        Set<Long> privateReceiverIds = messages.stream()
                .filter(m -> m.getType() == Message.MessageType.PRIVATE && m.getReceiverId() != null)
                .map(Message::getReceiverId)
                .collect(Collectors.toSet());

        return messages.stream()
                .map(m -> toVO(m, senderMap.get(m.getSenderId()), currentUserId))
                .toList();
    }

    // ==================== 撤回 ====================

    @Override
    @Transactional
    public MessageVO recallMessage(Long messageId, User operator) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> BusinessException.notFound("消息不存在"));
        if (!message.getSenderId().equals(operator.getId())) {
            throw BusinessException.badRequest("只能撤回自己发送的消息");
        }
        if (message.getStatus() == Message.Status.RECALLED) {
            throw BusinessException.badRequest("该消息已被撤回");
        }
        Duration elapsed = Duration.between(message.getSendTime(), LocalDateTime.now());
        if (elapsed.getSeconds() > RECALL_WINDOW_SECONDS) {
            throw BusinessException.badRequest("超过 2 分钟，无法撤回");
        }

        message.setStatus(Message.Status.RECALLED);
        message.setRecalledAt(LocalDateTime.now());
        message = messageRepository.save(message);

        MessageVO vo = toVO(message, operator, operator.getId());

        // 推送撤回通知 + 更新后的消息
        if (message.getType() == Message.MessageType.PRIVATE) {
            Long otherId = message.getSenderId().equals(operator.getId()) ? message.getReceiverId() : message.getSenderId();
            messagingTemplate.convertAndSend("/topic/user." + otherId, vo);
            messagingTemplate.convertAndSend("/topic/user." + operator.getId(), vo);
            String convKey = "private:" + operator.getId() + ":" + otherId;
            notifyService.notifyUser(otherId, "MESSAGE_RECALL", Map.of("messageId", messageId, "conversationKey", convKey));
        } else if (message.getType() == Message.MessageType.GROUP) {
            messagingTemplate.convertAndSend("/topic/group." + message.getGroupId(), vo);
            String convKey = "group:" + message.getGroupId();
            notifyService.notifyUser(operator.getId(), "MESSAGE_RECALL", Map.of("messageId", messageId, "conversationKey", convKey));
            // 通知群内其他成员
            for (Long memberId : groupMemberRepository.findUserIdsByGroupId(message.getGroupId())) {
                if (!memberId.equals(operator.getId())) {
                    notifyService.notifyUser(memberId, "MESSAGE_RECALL", Map.of("messageId", messageId, "conversationKey", convKey));
                }
            }
        }
        return vo;
    }

    // ==================== 删除 ====================

    @Override
    @Transactional
    public void deleteMessage(Long messageId, User operator) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> BusinessException.notFound("消息不存在"));
        if (!message.getSenderId().equals(operator.getId())) {
            throw BusinessException.badRequest("只能删除自己发送的消息");
        }

        messageRepository.delete(message);

        String convKey;
        if (message.getType() == Message.MessageType.PRIVATE) {
            Long otherId = message.getSenderId().equals(operator.getId()) ? message.getReceiverId() : message.getSenderId();
            convKey = "private:" + operator.getId() + ":" + otherId;
            notifyService.notifyUser(otherId, "MESSAGE_DELETE", Map.of("messageId", messageId, "conversationKey", convKey));
        } else {
            convKey = "group:" + message.getGroupId();
            for (Long memberId : groupMemberRepository.findUserIdsByGroupId(message.getGroupId())) {
                if (!memberId.equals(operator.getId())) {
                    notifyService.notifyUser(memberId, "MESSAGE_DELETE", Map.of("messageId", messageId, "conversationKey", convKey));
                }
            }
        }
    }

    // ==================== 已读标记 ====================

    @Override
    @Transactional
    public void markRead(MessageReadRequest request, User currentUser) {
        if (request.getType() == Message.MessageType.PRIVATE) {
            if (request.getPeerId() == null) {
                throw BusinessException.badRequest("私聊已读标记需要 peerId");
            }
            ConversationReadCursor cursor = cursorRepository
                    .findByUserIdAndPeerId(currentUser.getId(), request.getPeerId())
                    .orElseGet(() -> ConversationReadCursor.builder()
                            .userId(currentUser.getId())
                            .peerId(request.getPeerId())
                            .build());
            // 只前进不后退
            if (cursor.getLastReadMessageId() == null || request.getLastReadMessageId() > cursor.getLastReadMessageId()) {
                cursor.setLastReadMessageId(request.getLastReadMessageId());
                cursor.setLastReadTime(LocalDateTime.now());
                cursorRepository.save(cursor);
            }
            // 推送已读回执给对方
            notifyService.notifyUser(request.getPeerId(), "READ_RECEIPT",
                    Map.of("peerId", currentUser.getId(), "lastReadMessageId", request.getLastReadMessageId()));

        } else if (request.getType() == Message.MessageType.GROUP) {
            if (request.getGroupId() == null) {
                throw BusinessException.badRequest("群聊已读标记需要 groupId");
            }
            ConversationReadCursor cursor = cursorRepository
                    .findByUserIdAndGroupId(currentUser.getId(), request.getGroupId())
                    .orElseGet(() -> ConversationReadCursor.builder()
                            .userId(currentUser.getId())
                            .groupId(request.getGroupId())
                            .build());
            if (cursor.getLastReadMessageId() == null || request.getLastReadMessageId() > cursor.getLastReadMessageId()) {
                cursor.setLastReadMessageId(request.getLastReadMessageId());
                cursor.setLastReadTime(LocalDateTime.now());
                cursorRepository.save(cursor);
            }
        }
    }

    // ==================== 未读统计 ====================

    @Override
    public List<UnreadVO> listUnread(Long userId) {
        List<UnreadVO> result = new ArrayList<>();

        // 私聊未读：遍历好友
        List<Friendship> friends = friendshipRepository.findByUserIdAndStatus(userId, Friendship.Status.ACCEPTED);
        for (Friendship f : friends) {
            ConversationReadCursor cursor = cursorRepository
                    .findByUserIdAndPeerId(userId, f.getFriendId()).orElse(null);
            long lastReadId = cursor != null && cursor.getLastReadMessageId() != null ? cursor.getLastReadMessageId() : 0L;
            long count = messageRepository.countPrivateUnread(userId, f.getFriendId(), lastReadId);
            result.add(UnreadVO.builder()
                    .type(Message.MessageType.PRIVATE)
                    .key("private:" + f.getFriendId())
                    .peerId(f.getFriendId())
                    .count((int) count)
                    .build());
        }

        // 群聊未读
        List<ChatGroup> groups = groupRepository.findGroupsByMemberUserId(userId);
        for (ChatGroup g : groups) {
            ConversationReadCursor cursor = cursorRepository
                    .findByUserIdAndGroupId(userId, g.getId()).orElse(null);
            long lastReadId = cursor != null && cursor.getLastReadMessageId() != null ? cursor.getLastReadMessageId() : 0L;
            long count = messageRepository.countGroupUnread(userId, g.getId(), lastReadId);
            result.add(UnreadVO.builder()
                    .type(Message.MessageType.GROUP)
                    .key("group:" + g.getId())
                    .groupId(g.getId())
                    .count((int) count)
                    .build());
        }

        return result;
    }

    // ==================== 会话列表 ====================

    @Override
    public List<ConversationVO> listConversations(Long userId) {
        Map<String, ConversationVO> convMap = new HashMap<>();

        // 私聊会话
        List<Friendship> friends = friendshipRepository.findByUserIdAndStatus(userId, Friendship.Status.ACCEPTED);
        for (Friendship f : friends) {
            User friend = userRepository.findById(f.getFriendId()).orElse(null);
            if (friend == null) continue;

            Message lastMsg = messageRepository.findLastPrivateMessage(userId, f.getFriendId());
            if (lastMsg == null) continue;

            ConversationReadCursor cursor = cursorRepository
                    .findByUserIdAndPeerId(userId, f.getFriendId()).orElse(null);
            long lastReadId = cursor != null && cursor.getLastReadMessageId() != null ? cursor.getLastReadMessageId() : 0L;
            int unread = (int) messageRepository.countPrivateUnread(userId, f.getFriendId(), lastReadId);

            String displayName = (friend.getNickname() == null || friend.getNickname().isBlank())
                    ? friend.getUsername() : friend.getNickname();

            convMap.put("private:" + f.getFriendId(), ConversationVO.builder()
                    .key("private:" + f.getFriendId())
                    .type(Message.MessageType.PRIVATE)
                    .peerId(f.getFriendId())
                    .title(displayName)
                    .avatar(friend.getAvatar())
                    .lastContent(previewContent(lastMsg))
                    .lastContentType(lastMsg.getContentType())
                    .lastTime(lastMsg.getSendTime())
                    .unreadCount(unread)
                    .build());
        }

        // 群聊会话
        List<ChatGroup> groups = groupRepository.findGroupsByMemberUserId(userId);
        for (ChatGroup g : groups) {
            Message lastMsg = messageRepository.findLastGroupMessage(g.getId());
            if (lastMsg == null) continue;

            ConversationReadCursor cursor = cursorRepository
                    .findByUserIdAndGroupId(userId, g.getId()).orElse(null);
            long lastReadId = cursor != null && cursor.getLastReadMessageId() != null ? cursor.getLastReadMessageId() : 0L;
            int unread = (int) messageRepository.countGroupUnread(userId, g.getId(), lastReadId);

            convMap.put("group:" + g.getId(), ConversationVO.builder()
                    .key("group:" + g.getId())
                    .type(Message.MessageType.GROUP)
                    .groupId(g.getId())
                    .title(g.getName())
                    .lastContent(previewContent(lastMsg))
                    .lastContentType(lastMsg.getContentType())
                    .lastTime(lastMsg.getSendTime())
                    .unreadCount(unread)
                    .build());
        }

        return convMap.values().stream()
                .sorted(Comparator.comparing(ConversationVO::getLastTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    private String previewContent(Message m) {
        if (m.getStatus() == Message.Status.RECALLED) {
            return "消息已撤回";
        }
        Message.ContentType ct = m.getContentType() == null ? Message.ContentType.TEXT : m.getContentType();
        return switch (ct) {
            case TEXT, EMOJI -> m.getContent();
            case IMAGE -> "[图片]";
            case FILE -> "[文件] " + (m.getAttachmentName() != null ? m.getAttachmentName() : "");
            case AUDIO -> "[语音]";
            case RECALL_NOTICE -> "消息已撤回";
        };
    }

    // ==================== VO 转换 ====================

    private MessageVO toVO(Message m, User sender, Long currentUserId) {
        String displayName = sender == null ? "未知用户"
                : (sender.getNickname() == null || sender.getNickname().isBlank()
                        ? sender.getUsername() : sender.getNickname());

        AttachmentVO attachment = null;
        if (m.getAttachmentUrl() != null) {
            boolean isImage = m.getContentType() == Message.ContentType.IMAGE;
            attachment = AttachmentVO.builder()
                    .url(m.getAttachmentUrl())
                    .name(m.getAttachmentName())
                    .size(m.getAttachmentSize())
                    .thumbUrl(m.getAttachmentThumb() != null ? m.getAttachmentThumb() : m.getAttachmentUrl())
                    .isImage(isImage)
                    .build();
        }

        // 计算 read 状态（仅私聊、仅自己发送的消息有意义）
        Boolean read = null;
        if (currentUserId != null && m.getType() == Message.MessageType.PRIVATE
                && m.getSenderId().equals(currentUserId) && m.getStatus() == Message.Status.NORMAL) {
            Long receiverId = m.getReceiverId();
            ConversationReadCursor cursor = cursorRepository
                    .findByUserIdAndPeerId(receiverId, currentUserId).orElse(null);
            if (cursor != null && cursor.getLastReadMessageId() != null) {
                read = m.getId() <= cursor.getLastReadMessageId();
            } else {
                read = false;
            }
        }

        return MessageVO.builder()
                .id(m.getId())
                .type(m.getType())
                .senderId(m.getSenderId())
                .senderName(displayName)
                .senderAvatar(sender != null ? sender.getAvatar() : null)
                .receiverId(m.getReceiverId())
                .groupId(m.getGroupId())
                .content(m.getContent())
                .contentType(m.getContentType())
                .attachment(attachment)
                .status(m.getStatus())
                .recalledAt(m.getRecalledAt())
                .sendTime(m.getSendTime())
                .read(read)
                .mentionUserIds(parseMentions(m.getMentionUserIds()))
                .audioDuration(m.getAudioDuration())
                .build();
    }

    // ==================== 清空聊天记录 ====================

    @Override
    @Transactional
    public void clearPrivateHistory(Long userId, Long peerId) {
        messageRepository.deletePrivateHistory(userId, peerId);
        // 同时清除已读游标
        cursorRepository.findByUserIdAndPeerId(userId, peerId)
                .ifPresent(cursorRepository::delete);
    }

    @Override
    @Transactional
    public void clearGroupHistory(Long groupId, Long userId) {
        // 校验群成员身份
        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, userId)) {
            throw BusinessException.badRequest("你不在该群中");
        }
        // 仅删除当前用户发送的消息
        messageRepository.deleteGroupHistoryByUser(groupId, userId);
        // 清除已读游标
        cursorRepository.findByUserIdAndGroupId(userId, groupId)
                .ifPresent(cursorRepository::delete);
    }
}
