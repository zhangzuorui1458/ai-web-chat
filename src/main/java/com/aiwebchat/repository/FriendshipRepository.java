package com.aiwebchat.repository;

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
}
