package com.aiwebchat.dto;

import com.aiwebchat.entity.Emoji;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmojiVO {

    private Long id;
    private String name;
    private String url;
    private Emoji.Category category;
}
