package com.aiwebchat.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "message",
        indexes = {
                @Index(name = "idx_message_sender", columnList = "sender_id"),
                @Index(name = "idx_message_receiver", columnList = "receiver_id"),
                @Index(name = "idx_message_group", columnList = "group_id"),
                @Index(name = "idx_message_send_time", columnList = "send_time")
        })
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    @Enumerated(EnumType.STRING)
    private MessageType type;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    @Column(name = "receiver_id")
    private Long receiverId;

    @Column(name = "group_id")
    private Long groupId;

    @Lob
    @Column(nullable = false)
    private String content;

    @Column(name = "content_type", length = 16)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ContentType contentType = ContentType.TEXT;

    @Column(name = "attachment_url", length = 512)
    private String attachmentUrl;

    @Column(name = "attachment_name", length = 255)
    private String attachmentName;

    @Column(name = "attachment_size")
    private Long attachmentSize;

    @Column(name = "attachment_thumb", length = 512)
    private String attachmentThumb;

    @Column(name = "audio_duration")
    private Integer audioDuration;

    @Column(name = "mention_user_ids", length = 200)
    private String mentionUserIds;

    @Column(length = 16)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Status status = Status.NORMAL;

    @Column(name = "recalled_at")
    private LocalDateTime recalledAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime sendTime;

    public enum MessageType {
        PRIVATE, GROUP
    }

    public enum ContentType {
        TEXT, IMAGE, FILE, EMOJI, AUDIO, RECALL_NOTICE
    }

    public enum Status {
        NORMAL, RECALLED
    }

    @PrePersist
    protected void onCreate() {
        if (sendTime == null) {
            sendTime = LocalDateTime.now();
        }
    }
}
