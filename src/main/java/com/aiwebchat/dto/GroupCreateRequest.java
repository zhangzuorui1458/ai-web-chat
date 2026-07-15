package com.aiwebchat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupCreateRequest {

    @NotBlank(message = "群名称不能为空")
    @Size(max = 100, message = "群名称最长 100 个字符")
    private String name;

    @NotEmpty(message = "群成员不能为空")
    private List<Long> memberIds;
}
