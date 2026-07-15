package com.aiwebchat.dto;

import com.aiwebchat.entity.Message;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 会话列表项：最近消息 + 未读数 + 排序信息。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationVO {

    private String key;
    private Message.MessageType type;
    private Long peerId;
    private Long groupId;
    private String title;
    private String avatar;
    private String lastContent;
    private Message.ContentType lastContentType;
    private java.time.LocalDateTime lastTime;
    private int unreadCount;
}
