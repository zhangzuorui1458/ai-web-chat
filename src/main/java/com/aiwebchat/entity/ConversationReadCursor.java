package com.aiwebchat.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 会话已读游标，用于轻量未读统计。
 * 私聊场景使用 peerId，群聊场景使用 groupId。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "conversation_read_cursor",
        indexes = {
                @Index(name = "idx_cursor_user", columnList = "user_id"),
                @Index(name = "idx_cursor_peer", columnList = "peer_id"),
                @Index(name = "idx_cursor_group", columnList = "group_id")
        })
public class ConversationReadCursor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "peer_id")
    private Long peerId;

    @Column(name = "group_id")
    private Long groupId;

    @Column(name = "last_read_message_id")
    private Long lastReadMessageId;

    @Column(name = "last_read_time")
    private LocalDateTime lastReadTime;
}
