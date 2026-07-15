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
public class FavoriteVO {

    private Long id;
    private Long messageId;
    private String note;
    private LocalDateTime createTime;

    /** 消息内容快照（原消息被删除时这些字段为 null，messageDeleted=true） */
    private boolean messageDeleted;
    private Message.MessageType type;
    private Long senderId;
    private String senderName;
    private String content;
    private Message.ContentType contentType;
    private AttachmentVO attachment;
    private LocalDateTime sendTime;
}
