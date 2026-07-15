package com.aiwebchat.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupInvitationRequest {

    @NotEmpty(message = "被邀请人不能为空")
    private List<Long> inviteeIds;
}
