package com.aiwebchat.repository;

import com.aiwebchat.dto.UserVO;
import com.aiwebchat.entity.Friendship;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    // 我的好友列表（已接受）
    List<Friendship> findByUserIdAndStatus(Long userId, Friendship.Status status);

    // 我作为申请人，与某用户的关系
    Optional<Friendship> findByUserIdAndFriendId(Long userId, Long friendId);

    // 收到的好友申请（pending）
    List<Friendship> findByFriendIdAndStatus(Long friendId, Friendship.Status status);

    // ==================== 批量查询（N+1 优化） ====================

    /**
     * JOIN 查询好友列表的 UserVO（避免逐个 findById）。
     */
    @org.springframework.data.jpa.repository.Query(
            "select new com.aiwebchat.dto.UserVO(u.id, u.username, u.nickname, u.avatar, u.signature) " +
            "from Friendship f join User u on f.friendId = u.id " +
            "where f.userId = :userId and f.status = :status")
    java.util.List<UserVO> findFriendVOsByUserIdAndStatus(
            @org.springframework.data.repository.query.Param("userId") Long userId,
            @org.springframework.data.repository.query.Param("status") Friendship.Status status);

    /**
     * JOIN 查询好友申请人列表的 UserVO（避免逐个 findById）。
     */
    @org.springframework.data.jpa.repository.Query(
            "select new com.aiwebchat.dto.UserVO(u.id, u.username, u.nickname, u.avatar, u.signature), f.id, f.createTime " +
            "from Friendship f join User u on f.userId = u.id " +
            "where f.friendId = :userId and f.status = :status")
    java.util.List<Object[]> findRequestVOsByFriendIdAndStatus(
            @org.springframework.data.repository.query.Param("userId") Long userId,
            @org.springframework.data.repository.query.Param("status") Friendship.Status status);
}
