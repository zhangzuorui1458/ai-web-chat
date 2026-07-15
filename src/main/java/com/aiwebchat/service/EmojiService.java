package com.aiwebchat.service;

import com.aiwebchat.dto.EmojiVO;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface EmojiService {

    List<EmojiVO> listSystemEmojis();

    List<EmojiVO> listMyEmojis(Long ownerId);

    EmojiVO uploadEmoji(Long ownerId, MultipartFile file);

    void deleteEmoji(Long emojiId, Long ownerId);
}
