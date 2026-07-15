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
public class FavoriteRequest {

    @NotNull(message = "消息 ID 不能为空")
    private Long messageId;

    /** 收藏时可附带的笔记，可空 */
    private String note;
}
