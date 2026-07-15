package com.aiwebchat.dto;

import com.aiwebchat.entity.GroupInvitation;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupInvitationVO {

    private Long id;
    private Long groupId;
    private String groupName;
    private Long inviterId;
    private String inviterName;
    private Long inviteeId;
    private String inviteeName;
    private GroupInvitation.Status status;
    private LocalDateTime createTime;
}
