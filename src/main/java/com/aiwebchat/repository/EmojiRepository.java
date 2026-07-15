package com.aiwebchat.repository;

import com.aiwebchat.entity.Emoji;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EmojiRepository extends JpaRepository<Emoji, Long> {

    List<Emoji> findByCategory(Emoji.Category category);

    List<Emoji> findByOwnerId(Long ownerId);
}
