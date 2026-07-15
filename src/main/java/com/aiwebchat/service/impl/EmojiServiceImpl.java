package com.aiwebchat.service.impl;

import com.aiwebchat.dto.AttachmentVO;
import com.aiwebchat.dto.EmojiVO;
import com.aiwebchat.entity.Emoji;
import com.aiwebchat.exception.BusinessException;
import com.aiwebchat.repository.EmojiRepository;
import com.aiwebchat.service.EmojiService;
import com.aiwebchat.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EmojiServiceImpl implements EmojiService {

    private final EmojiRepository emojiRepository;
    private final FileService fileService;

    @Override
    public List<EmojiVO> listSystemEmojis() {
        return emojiRepository.findByCategory(Emoji.Category.SYSTEM).stream()
                .map(this::toVO)
                .toList();
    }

    @Override
    public List<EmojiVO> listMyEmojis(Long ownerId) {
        return emojiRepository.findByOwnerId(ownerId).stream()
                .filter(e -> e.getCategory() == Emoji.Category.CUSTOM)
                .map(this::toVO)
                .toList();
    }

    @Override
    @Transactional
    public EmojiVO uploadEmoji(Long ownerId, MultipartFile file) {
        AttachmentVO attachment = fileService.upload(file);
        Emoji emoji = Emoji.builder()
                .ownerId(ownerId)
                .name(file.getOriginalFilename())
                .url(attachment.getUrl())
                .category(Emoji.Category.CUSTOM)
                .build();
        emoji = emojiRepository.save(emoji);
        return toVO(emoji);
    }

    @Override
    @Transactional
    public void deleteEmoji(Long emojiId, Long ownerId) {
        Emoji emoji = emojiRepository.findById(emojiId)
                .orElseThrow(() -> BusinessException.notFound("表情不存在"));
        if (emoji.getCategory() == Emoji.Category.SYSTEM) {
            throw BusinessException.badRequest("系统表情不可删除");
        }
        if (!ownerId.equals(emoji.getOwnerId())) {
            throw BusinessException.badRequest("无权删除他人表情");
        }
        emojiRepository.delete(emoji);
    }

    private EmojiVO toVO(Emoji e) {
        return EmojiVO.builder()
                .id(e.getId())
                .name(e.getName())
                .url(e.getUrl())
                .category(e.getCategory())
                .build();
    }
}
