package com.aiwebchat.repository;

import com.aiwebchat.entity.GroupInvitation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GroupInvitationRepository extends JpaRepository<GroupInvitation, Long> {

    List<GroupInvitation> findByInviteeIdAndStatus(Long inviteeId, GroupInvitation.Status status);

    List<GroupInvitation> findByGroupIdAndStatus(Long groupId, GroupInvitation.Status status);
}
