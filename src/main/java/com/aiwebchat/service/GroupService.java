package com.aiwebchat.service;

import com.aiwebchat.dto.GroupInvitationVO;
import com.aiwebchat.dto.GroupVO;
import com.aiwebchat.dto.UserVO;

import java.util.List;

public interface GroupService {

    GroupVO createGroup(String name, Long ownerId, List<Long> memberIds);

    List<GroupVO> listMyGroups(Long userId);

    List<UserVO> listMembers(Long groupId, Long requesterId);

    void updateGroupInfo(Long groupId, Long operatorId, String name, String avatar);

    void inviteMember(Long groupId, Long targetUserId);

    // 群邀请审批流
    List<GroupInvitationVO> createInvitations(Long groupId, Long inviterId, List<Long> inviteeIds);

    List<GroupInvitationVO> listPendingInvitations(Long inviteeId);

    void acceptInvitation(Long invitationId, Long currentUserId);

    void rejectInvitation(Long invitationId, Long currentUserId);
}
