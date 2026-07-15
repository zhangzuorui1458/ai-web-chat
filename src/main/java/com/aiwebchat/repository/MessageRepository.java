package com.aiwebchat.repository;

import com.aiwebchat.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    @Query("select m from Message m where m.type = com.aiwebchat.entity.Message$MessageType.PRIVATE " +
            "and ((m.senderId = :meId and m.receiverId = :peerId) " +
            "  or (m.senderId = :peerId and m.receiverId = :meId)) " +
            "order by m.sendTime asc")
    List<Message> findPrivateHistory(@Param("meId") Long meId, @Param("peerId") Long peerId);

    @Query("select m from Message m where m.type = com.aiwebchat.entity.Message$MessageType.GROUP " +
            "and m.groupId = :groupId order by m.sendTime asc")
    List<Message> findGroupHistory(@Param("groupId") Long groupId);

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
}
