package com.aiwebchat.repository;

import com.aiwebchat.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    // ==================== 分页查询（历史消息） ====================

    @Query("select m from Message m where m.type = com.aiwebchat.entity.Message$MessageType.PRIVATE " +
            "and ((m.senderId = :meId and m.receiverId = :peerId) " +
            "  or (m.senderId = :peerId and m.receiverId = :meId)) " +
            "order by m.sendTime desc")
    Page<Message> findPrivateHistory(@Param("meId") Long meId, @Param("peerId") Long peerId, Pageable pageable);

    @Query("select m from Message m where m.type = com.aiwebchat.entity.Message$MessageType.GROUP " +
            "and m.groupId = :groupId order by m.sendTime desc")
    Page<Message> findGroupHistory(@Param("groupId") Long groupId, Pageable pageable);

    // ==================== 不分页（兼容旧调用） ====================

    @Query("select m from Message m where m.type = com.aiwebchat.entity.Message$MessageType.PRIVATE " +
            "and ((m.senderId = :meId and m.receiverId = :peerId) " +
            "  or (m.senderId = :peerId and m.receiverId = :meId)) " +
            "order by m.sendTime asc")
    List<Message> findPrivateHistoryAll(@Param("meId") Long meId, @Param("peerId") Long peerId);

    @Query("select m from Message m where m.type = com.aiwebchat.entity.Message$MessageType.GROUP " +
            "and m.groupId = :groupId order by m.sendTime asc")
    List<Message> findGroupHistoryAll(@Param("groupId") Long groupId);

    /**
     * 统计私聊未读数：对方发给我、id 大于 lastReadId、状态为 NORMAL 的消息数。
     */
    @Query("select count(m) from Message m where m.type = com.aiwebchat.entity.Message$MessageType.PRIVATE " +
            "and m.senderId = :peerId and m.receiverId = :meId " +
            "and m.id > :lastReadId " +
            "and m.status = com.aiwebchat.entity.Message$Status.NORMAL")
    long countPrivateUnread(@Param("meId") Long meId, @Param("peerId") Long peerId, @Param("lastReadId") Long lastReadId);

    /**
     * 统计群聊未读数：非我发送、id 大于 lastReadId、状态为 NORMAL 的消息数。
     */
    @Query("select count(m) from Message m where m.type = com.aiwebchat.entity.Message$MessageType.GROUP " +
            "and m.groupId = :groupId and m.senderId <> :meId " +
            "and m.id > :lastReadId " +
            "and m.status = com.aiwebchat.entity.Message$Status.NORMAL")
    long countGroupUnread(@Param("meId") Long meId, @Param("groupId") Long groupId, @Param("lastReadId") Long lastReadId);

    /**
     * 查找某私聊会话最后一条消息。
     */
    @Query("select m from Message m where m.type = com.aiwebchat.entity.Message$MessageType.PRIVATE " +
            "and ((m.senderId = :meId and m.receiverId = :peerId) " +
            "  or (m.senderId = :peerId and m.receiverId = :meId)) " +
            "order by m.sendTime desc limit 1")
    Message findLastPrivateMessage(@Param("meId") Long meId, @Param("peerId") Long peerId);

    /**
     * 查找某群会话最后一条消息。
     */
    @Query("select m from Message m where m.type = com.aiwebchat.entity.Message$MessageType.GROUP " +
            "and m.groupId = :groupId order by m.sendTime desc limit 1")
    Message findLastGroupMessage(@Param("groupId") Long groupId);

    /**
     * 批量查询：根据 senderId 集合批量获取用户信息（用于 N+1 优化）。
     */
    @Query("select distinct m.senderId from Message m where m.id in :messageIds")
    List<Long> findSenderIdsByMessageIds(@Param("messageIds") List<Long> messageIds);

    /**
     * 删除两个用户之间的所有私聊消息。
     */
    @Modifying
    @Query("delete from Message m where m.type = com.aiwebchat.entity.Message$MessageType.PRIVATE " +
            "and ((m.senderId = :userId and m.receiverId = :peerId) " +
            "  or (m.senderId = :peerId and m.receiverId = :userId))")
    void deletePrivateHistory(@Param("userId") Long userId, @Param("peerId") Long peerId);

    /**
     * 删除某群中某用户发送的所有消息。
     */
    @Modifying
    @Query("delete from Message m where m.type = com.aiwebchat.entity.Message$MessageType.GROUP " +
            "and m.groupId = :groupId and m.senderId = :userId")
    void deleteGroupHistoryByUser(@Param("groupId") Long groupId, @Param("userId") Long userId);
}
