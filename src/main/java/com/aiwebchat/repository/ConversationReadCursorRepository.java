package com.aiwebchat.repository;

import com.aiwebchat.entity.ConversationReadCursor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationReadCursorRepository extends JpaRepository<ConversationReadCursor, Long> {

    Optional<ConversationReadCursor> findByUserIdAndPeerId(Long userId, Long peerId);

    Optional<ConversationReadCursor> findByUserIdAndGroupId(Long userId, Long groupId);

    List<ConversationReadCursor> findByUserId(Long userId);
}
