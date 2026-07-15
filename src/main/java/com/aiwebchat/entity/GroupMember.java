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
@Table(name = "group_member",
        uniqueConstraints = @UniqueConstraint(name = "uk_group_member", columnNames = {"groupId", "userId"}),
        indexes = {
                @Index(name = "idx_group_member_group", columnList = "group_id"),
                @Index(name = "idx_group_member_user", columnList = "user_id")
        })
public class GroupMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, updatable = false)
    private LocalDateTime joinTime;

    @PrePersist
    protected void onCreate() {
        joinTime = LocalDateTime.now();
    }
}
