package com.aiwebchat.service.impl;

import com.aiwebchat.dto.GroupInvitationVO;
import com.aiwebchat.dto.GroupVO;
import com.aiwebchat.dto.UserVO;
import com.aiwebchat.entity.ChatGroup;
import com.aiwebchat.entity.GroupInvitation;
import com.aiwebchat.entity.GroupMember;
import com.aiwebchat.entity.User;
import com.aiwebchat.exception.BusinessException;
import com.aiwebchat.repository.*;
import com.aiwebchat.service.GroupService;
import com.aiwebchat.service.NotifyService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class GroupServiceImpl implements GroupService {

    private final ChatGroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupInvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final NotifyService notifyService;

    @Override
    @Transactional
    public GroupVO createGroup(String name, Long ownerId, List<Long> memberIds) {
        ChatGroup group = ChatGroup.builder()
                .name(name)
                .ownerId(ownerId)
                .build();
        group = groupRepository.save(group);

        joinGroup(group.getId(), ownerId);
        for (Long memberId : memberIds) {
            if (!memberId.equals(ownerId)) {
                userRepository.findById(memberId)
                        .orElseThrow(() -> BusinessException.notFound("用户不存在: " + memberId));
                joinGroup(group.getId(), memberId);
            }
        }
        return toVO(group);
    }

    @Override
    public List<GroupVO> listMyGroups(Long userId) {
        List<ChatGroup> groups = groupRepository.findGroupsByMemberUserId(userId);
        if (groups.isEmpty()) return List.of();

        // 批量查询所有群的成员数（N+1 → 1次查询）
        List<Long> groupIds = groups.stream().map(ChatGroup::getId).toList();
        Map<Long, Long> countMap = new java.util.HashMap<>();
        for (Object[] row : groupMemberRepository.countMembersByGroupIds(groupIds)) {
            countMap.put((Long) row[0], (Long) row[1]);
        }

        return groups.stream()
                .map(g -> GroupVO.builder()
                        .id(g.getId())
                        .name(g.getName())
                        .avatar(g.getAvatar())
                        .ownerId(g.getOwnerId())
                        .memberCount(countMap.getOrDefault(g.getId(), 0L).intValue())
                        .createTime(g.getCreateTime())
                        .build())
                .toList();
    }

    @Override
    public List<UserVO> listMembers(Long groupId, Long requesterId) {
        if (!groupRepository.existsById(groupId)) {
            throw BusinessException.notFound("群组不存在");
        }
        // 权限校验：只有群成员才能查看成员列表
        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, requesterId)) {
            throw BusinessException.badRequest("你不在该群中，无权查看成员列表");
        }
        // 使用 JOIN 查询，一次获取所有成员的 UserVO（N+1 → 1次查询）
        return groupMemberRepository.findMemberVOsByGroupId(groupId);
    }

    @Override
    @Transactional
    public void inviteMember(Long groupId, Long targetUserId) {
        if (!groupRepository.existsById(groupId)) {
            throw BusinessException.notFound("群组不存在");
        }
        userRepository.findById(targetUserId)
                .orElseThrow(() -> BusinessException.notFound("用户不存在: " + targetUserId));
        if (groupMemberRepository.existsByGroupIdAndUserId(groupId, targetUserId)) {
            throw BusinessException.badRequest("该用户已在群中");
        }
        joinGroup(groupId, targetUserId);
    }

    @Override
    @Transactional
    public void updateGroupInfo(Long groupId, Long operatorId, String name, String avatar) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> BusinessException.notFound("群组不存在"));
        if (!group.getOwnerId().equals(operatorId)) {
            throw BusinessException.badRequest("仅群主可修改群信息");
        }
        if (name != null && !name.isBlank()) {
            if (name.length() > 100) {
                throw BusinessException.badRequest("群名最长 100 字");
            }
            group.setName(name.trim());
        }
        if (avatar != null) {
            group.setAvatar(avatar);
        }
        groupRepository.save(group);

        // 通知群内成员群信息更新
        for (Long memberId : groupMemberRepository.findUserIdsByGroupId(groupId)) {
            if (!memberId.equals(operatorId)) {
                notifyService.notifyUser(memberId, "GROUP_INFO_UPDATED",
                        Map.of("groupId", groupId));
            }
        }
    }

    // ==================== 群邀请审批 ====================

    @Override
    @Transactional
    public List<GroupInvitationVO> createInvitations(Long groupId, Long inviterId, List<Long> inviteeIds) {
        ChatGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> BusinessException.notFound("群组不存在"));
        User inviter = userRepository.findById(inviterId)
                .orElseThrow(() -> BusinessException.notFound("邀请人不存在"));

        List<GroupInvitationVO> result = new ArrayList<>();
        for (Long inviteeId : inviteeIds) {
            if (inviteeId.equals(inviterId)) continue;
            User invitee = userRepository.findById(inviteeId)
                    .orElseThrow(() -> BusinessException.notFound("用户不存在: " + inviteeId));

            // 已在群中则跳过
            if (groupMemberRepository.existsByGroupIdAndUserId(groupId, inviteeId)) {
                continue;
            }

            // 已有 PENDING 邀请则跳过
            List<GroupInvitation> existing = invitationRepository
                    .findByInviteeIdAndStatus(inviteeId, GroupInvitation.Status.PENDING)
                    .stream()
                    .filter(inv -> inv.getGroupId().equals(groupId))
                    .toList();
            if (!existing.isEmpty()) {
                result.add(toInvitationVO(existing.get(0), group, inviter, invitee));
                continue;
            }

            GroupInvitation invitation = GroupInvitation.builder()
                    .groupId(groupId)
                    .inviterId(inviterId)
                    .inviteeId(inviteeId)
                    .status(GroupInvitation.Status.PENDING)
                    .build();
            invitation = invitationRepository.save(invitation);

            GroupInvitationVO vo = toInvitationVO(invitation, group, inviter, invitee);
            result.add(vo);

            // 实时推送邀请通知给被邀请人
            notifyService.notifyUser(inviteeId, "GROUP_INVITATION", vo);
        }
        return result;
    }

    @Override
    public List<GroupInvitationVO> listPendingInvitations(Long inviteeId) {
        List<GroupInvitation> invitations = invitationRepository
                .findByInviteeIdAndStatus(inviteeId, GroupInvitation.Status.PENDING);
        return invitations.stream()
                .map(inv -> {
                    ChatGroup group = groupRepository.findById(inv.getGroupId()).orElse(null);
                    User inviter = userRepository.findById(inv.getInviterId()).orElse(null);
                    User invitee = userRepository.findById(inv.getInviteeId()).orElse(null);
                    return toInvitationVO(inv, group, inviter, invitee);
                })
                .toList();
    }

    @Override
    @Transactional
    public void acceptInvitation(Long invitationId, Long currentUserId) {
        GroupInvitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> BusinessException.notFound("邀请不存在"));
        if (!invitation.getInviteeId().equals(currentUserId)) {
            throw BusinessException.badRequest("无权处理此邀请");
        }
        if (invitation.getStatus() != GroupInvitation.Status.PENDING) {
            throw BusinessException.badRequest("该邀请已被处理");
        }

        invitation.setStatus(GroupInvitation.Status.ACCEPTED);
        invitation.setHandleTime(LocalDateTime.now());
        invitationRepository.save(invitation);

        // 加入群组
        if (!groupMemberRepository.existsByGroupIdAndUserId(invitation.getGroupId(), currentUserId)) {
            joinGroup(invitation.getGroupId(), currentUserId);
        }

        // 通知邀请人
        notifyService.notifyUser(invitation.getInviterId(), "GROUP_INVITATION_HANDLED",
                Map.of("invitationId", invitationId, "action", "ACCEPTED",
                        "groupId", invitation.getGroupId(), "userId", currentUserId));

        // 通知群内其他成员有新成员加入
        for (Long memberId : groupMemberRepository.findUserIdsByGroupId(invitation.getGroupId())) {
            if (!memberId.equals(currentUserId)) {
                notifyService.notifyUser(memberId, "MEMBER_JOINED",
                        Map.of("groupId", invitation.getGroupId(), "userId", currentUserId));
            }
        }
    }

    @Override
    @Transactional
    public void rejectInvitation(Long invitationId, Long currentUserId) {
        GroupInvitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> BusinessException.notFound("邀请不存在"));
        if (!invitation.getInviteeId().equals(currentUserId)) {
            throw BusinessException.badRequest("无权处理此邀请");
        }
        if (invitation.getStatus() != GroupInvitation.Status.PENDING) {
            throw BusinessException.badRequest("该邀请已被处理");
        }

        invitation.setStatus(GroupInvitation.Status.REJECTED);
        invitation.setHandleTime(LocalDateTime.now());
        invitationRepository.save(invitation);

        notifyService.notifyUser(invitation.getInviterId(), "GROUP_INVITATION_HANDLED",
                Map.of("invitationId", invitationId, "action", "REJECTED",
                        "groupId", invitation.getGroupId(), "userId", currentUserId));
    }

    // ==================== 私有方法 ====================

    private void joinGroup(Long groupId, Long userId) {
        GroupMember member = GroupMember.builder()
                .groupId(groupId)
                .userId(userId)
                .build();
        groupMemberRepository.save(member);
    }

    private GroupVO toVO(ChatGroup g) {
        // 使用 COUNT 查询替代 findByGroupId().size()（避免加载全部成员实体）
        long memberCount = groupMemberRepository.countByGroupId(g.getId());
        return GroupVO.builder()
                .id(g.getId())
                .name(g.getName())
                .avatar(g.getAvatar())
                .ownerId(g.getOwnerId())
                .memberCount((int) memberCount)
                .createTime(g.getCreateTime())
                .build();
    }

    private UserVO toUserVO(User u) {
        return UserVO.builder()
                .id(u.getId())
                .username(u.getUsername())
                .nickname(u.getNickname())
                .avatar(u.getAvatar())
                .signature(u.getSignature())
                .build();
    }

    private GroupInvitationVO toInvitationVO(GroupInvitation inv, ChatGroup group, User inviter, User invitee) {
        return GroupInvitationVO.builder()
                .id(inv.getId())
                .groupId(inv.getGroupId())
                .groupName(group != null ? group.getName() : null)
                .inviterId(inv.getInviterId())
                .inviterName(inviter != null ? displayName(inviter) : null)
                .inviteeId(inv.getInviteeId())
                .inviteeName(invitee != null ? displayName(invitee) : null)
                .status(inv.getStatus())
                .createTime(inv.getCreateTime())
                .build();
    }

    private String displayName(User u) {
        return (u.getNickname() == null || u.getNickname().isBlank())
                ? u.getUsername() : u.getNickname();
    }
}
