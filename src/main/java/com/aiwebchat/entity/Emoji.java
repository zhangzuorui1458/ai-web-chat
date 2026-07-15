package com.aiwebchat.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 自定义表情包。owner_id 为 NULL 表示系统预设。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "emoji",
        indexes = {
                @Index(name = "idx_emoji_owner", columnList = "owner_id"),
                @Index(name = "idx_emoji_category", columnList = "category")
        })
public class Emoji {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id")
    private Long ownerId;

    @Column(length = 64)
    private String name;

    @Column(nullable = false, length = 512)
    private String url;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Category category = Category.CUSTOM;

    @Column(name = "create_time", nullable = false, updatable = false)
    private LocalDateTime createTime;

    public enum Category {
        SYSTEM, CUSTOM
    }

    @PrePersist
    protected void onCreate() {
        createTime = LocalDateTime.now();
    }
}
