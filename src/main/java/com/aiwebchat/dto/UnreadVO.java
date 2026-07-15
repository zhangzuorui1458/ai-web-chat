package com.aiwebchat.dto;

import com.aiwebchat.entity.Message;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnreadVO {

    private Message.MessageType type;
    private String key;
    private Long peerId;
    private Long groupId;
    private int count;
}
