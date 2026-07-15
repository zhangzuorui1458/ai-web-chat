package com.aiwebchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttachmentVO {

    private String url;
    private String name;
    private Long size;
    private String thumbUrl;
    private Boolean isImage;
}
