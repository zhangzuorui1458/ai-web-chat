package com.aiwebchat.dto;

import com.aiwebchat.entity.Message;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageVO {

    private Long id;
    private Message.MessageType type;
    private Long senderId;
    private String senderName;
    private String senderAvatar;
    private Long receiverId;
    private Long groupId;
    private String content;
    private Message.ContentType contentType;
    private AttachmentVO attachment;
    private Message.Status status;
    private LocalDateTime recalledAt;
    private LocalDateTime sendTime;
    private Boolean read;
}
