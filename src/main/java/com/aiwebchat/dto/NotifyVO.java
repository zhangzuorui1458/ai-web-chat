package com.aiwebchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 统一系统通知体，推送到 /topic/notify.{userId}。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotifyVO {

    private String type;
    private Object payload;

    public static NotifyVO of(String type, Object payload) {
        return NotifyVO.builder().type(type).payload(payload).build();
    }
}
