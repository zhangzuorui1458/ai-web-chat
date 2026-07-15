package com.aiwebchat.controller;

import com.aiwebchat.dto.EmojiVO;
import com.aiwebchat.entity.User;
import com.aiwebchat.security.CurrentUser;
import com.aiwebchat.service.EmojiService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/emojis")
@RequiredArgsConstructor
public class EmojiController {

    private final EmojiService emojiService;

    @GetMapping("/system")
    public ResponseEntity<List<EmojiVO>> systemEmojis() {
        return ResponseEntity.ok(emojiService.listSystemEmojis());
    }

    @GetMapping("/mine")
    public ResponseEntity<List<EmojiVO>> myEmojis(HttpServletRequest request) {
        User current = CurrentUser.get(request);
        return ResponseEntity.ok(emojiService.listMyEmojis(current.getId()));
    }

    @PostMapping
    public ResponseEntity<EmojiVO> upload(@RequestParam("file") MultipartFile file,
                                          HttpServletRequest request) {
        User current = CurrentUser.get(request);
        return ResponseEntity.ok(emojiService.uploadEmoji(current.getId(), file));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable("id") Long emojiId,
                                                      HttpServletRequest request) {
        User current = CurrentUser.get(request);
        emojiService.deleteEmoji(emojiId, current.getId());
        return ResponseEntity.ok(Map.of("message", "表情已删除"));
    }
}
