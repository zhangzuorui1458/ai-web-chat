package com.aiwebchat.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FavoriteNoteRequest {

    @Size(max = 2000, message = "笔记最长 2000 个字符")
    private String note;
}
