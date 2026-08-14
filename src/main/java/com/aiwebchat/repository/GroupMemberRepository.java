package com.aiwebchat.repository;

import com.aiwebchat.dto.UserVO;
import com.aiwebchat.entity.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {

    List<GroupMember> findByGroupId(Long groupId);

    List<GroupMember> findByUserId(Long userId);

    Optional<GroupMember> findByGroupIdAndUserId(Long groupId, Long userId);

    boolean existsByGroupIdAndUserId(Long groupId, Long userId);

    @Query("select gm.userId from GroupMember gm where gm.groupId = :groupId")
    List<Long> findUserIdsByGroupId(@Param("groupId") Long groupId);

    /**
     * 批量查询群成员的 UserVO（避免 N+1 查询）。
     */
    @Query("select new com.aiwebchat.dto.UserVO(u.id, u.username, u.nickname, u.avatar, u.signature) " +
            "from GroupMember gm join User u on gm.userId = u.id where gm.groupId = :groupId")
    List<UserVO> findMemberVOsByGroupId(@Param("groupId") Long groupId);

    /**
     * 统计群成员数（避免 findByGroupId().size() 的全量加载）。
     */
    @Query("select count(gm) from GroupMember gm where gm.groupId = :groupId")
    long countByGroupId(@Param("groupId") Long groupId);

    /**
     * 批量查询多个群的成员数（用于 listMyGroups 优化）。
     */
    @Query("select gm.groupId, count(gm) from GroupMember gm where gm.groupId in :groupIds group by gm.groupId")
    List<Object[]> countMembersByGroupIds(@Param("groupIds") List<Long> groupIds);
}
