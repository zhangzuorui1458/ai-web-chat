package com.aiwebchat.service.impl;

import com.aiwebchat.dto.AttachmentVO;
import com.aiwebchat.dto.FavoriteVO;
import com.aiwebchat.entity.Favorite;
import com.aiwebchat.entity.Message;
import com.aiwebchat.entity.User;
import com.aiwebchat.exception.BusinessException;
import com.aiwebchat.repository.FavoriteRepository;
import com.aiwebchat.repository.MessageRepository;
import com.aiwebchat.repository.UserRepository;
import com.aiwebchat.service.FavoriteService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FavoriteServiceImpl implements FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public FavoriteVO addFavorite(Long userId, Long messageId, String note) {
        // 校验消息存在
        messageRepository.findById(messageId)
                .orElseThrow(() -> BusinessException.notFound("消息不存在"));

        // 已收藏则更新笔记，不重复创建
        Favorite fav = favoriteRepository.findByUserIdAndMessageId(userId, messageId)
                .orElseGet(() -> Favorite.builder()
                        .userId(userId)
                        .messageId(messageId)
                        .build());
        // 若提供了新笔记则覆盖；否则保留旧笔记
        if (note != null && !note.isBlank()) {
            fav.setNote(note);
        }
        fav = favoriteRepository.save(fav);
        return toVO(fav);
    }

    @Override
    public List<FavoriteVO> listMyFavorites(Long userId) {
        return favoriteRepository.findByUserIdOrderByCreateTimeDesc(userId).stream()
                .map(this::toVO)
                .toList();
    }

    @Override
    @Transactional
    public FavoriteVO updateNote(Long favoriteId, Long userId, String note) {
        Favorite fav = favoriteRepository.findById(favoriteId)
                .orElseThrow(() -> BusinessException.notFound("收藏不存在"));
        if (!fav.getUserId().equals(userId)) {
            throw BusinessException.badRequest("无权修改此收藏");
        }
        fav.setNote(note);
        fav = favoriteRepository.save(fav);
        return toVO(fav);
    }

    @Override
    @Transactional
    public void removeFavorite(Long favoriteId, Long userId) {
        Favorite fav = favoriteRepository.findById(favoriteId)
                .orElseThrow(() -> BusinessException.notFound("收藏不存在"));
        if (!fav.getUserId().equals(userId)) {
            throw BusinessException.badRequest("无权删除此收藏");
        }
        favoriteRepository.delete(fav);
    }

    private FavoriteVO toVO(Favorite fav) {
        FavoriteVO.FavoriteVOBuilder builder = FavoriteVO.builder()
                .id(fav.getId())
                .messageId(fav.getMessageId())
                .note(fav.getNote())
                .createTime(fav.getCreateTime());

        // 关联消息快照（消息可能已被删除）
        Message msg = messageRepository.findById(fav.getMessageId()).orElse(null);
        if (msg == null) {
            builder.messageDeleted(true);
        } else {
            builder.messageDeleted(false)
                    .type(msg.getType())
                    .senderId(msg.getSenderId())
                    .content(msg.getContent())
                    .contentType(msg.getContentType())
                    .sendTime(msg.getSendTime());

            User sender = userRepository.findById(msg.getSenderId()).orElse(null);
            String displayName = sender == null ? "未知用户"
                    : (sender.getNickname() == null || sender.getNickname().isBlank()
                            ? sender.getUsername() : sender.getNickname());
            builder.senderName(displayName);

            if (msg.getAttachmentUrl() != null) {
                boolean isImage = msg.getContentType() == Message.ContentType.IMAGE;
                builder.attachment(AttachmentVO.builder()
                        .url(msg.getAttachmentUrl())
                        .name(msg.getAttachmentName())
                        .size(msg.getAttachmentSize())
                        .thumbUrl(msg.getAttachmentThumb() != null ? msg.getAttachmentThumb() : msg.getAttachmentUrl())
                        .isImage(isImage)
                        .build());
            }
        }
        return builder.build();
    }
}
