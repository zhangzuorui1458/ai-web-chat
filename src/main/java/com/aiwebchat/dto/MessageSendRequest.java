package com.aiwebchat.dto;

import com.aiwebchat.entity.Message;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageSendRequest {

    @NotNull(message = "消息类型不能为空")
    private Message.MessageType type;

    private Long receiverId;

    private Long groupId;

    private String content;

    private Message.ContentType contentType;

    private String attachmentUrl;
    private String attachmentName;
    private Long attachmentSize;
    private String attachmentThumb;
    private Integer audioDuration;
    private List<Long> mentionUserIds;
}
