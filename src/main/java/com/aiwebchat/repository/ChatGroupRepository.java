package com.aiwebchat.repository;

import com.aiwebchat.entity.ChatGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatGroupRepository extends JpaRepository<ChatGroup, Long> {

    @Query("select g from ChatGroup g where g.id in " +
            "(select m.groupId from GroupMember m where m.userId = :userId)")
    List<ChatGroup> findGroupsByMemberUserId(@Param("userId") Long userId);
}
