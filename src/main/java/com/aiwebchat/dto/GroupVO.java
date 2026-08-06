package com.aiwebchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupVO {

    private Long id;
    private String name;
    private String avatar;
    private Long ownerId;
    private Integer memberCount;
    private LocalDateTime createTime;
}
