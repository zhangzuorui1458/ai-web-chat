package com.aiwebchat.dto;

import com.aiwebchat.entity.Message;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageReadRequest {

    @NotNull(message = "类型不能为空")
    private Message.MessageType type;

    private Long peerId;

    private Long groupId;

    @NotNull(message = "lastReadMessageId 不能为空")
    private Long lastReadMessageId;
}
