package com.aiwebchat.controller;

import com.aiwebchat.dto.AttachmentVO;
import com.aiwebchat.entity.User;
import com.aiwebchat.security.CurrentUser;
import com.aiwebchat.service.FileService;
import com.aiwebchat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;
    private final UserService userService;

    @PostMapping("/users/me/avatar")
    public ResponseEntity<Map<String, String>> uploadAvatar(@RequestParam("file") MultipartFile file,
                                                            HttpServletRequest request) {
        User current = CurrentUser.get(request);
        AttachmentVO attachment = fileService.upload(file);
        userService.updateAvatar(current.getId(), attachment.getUrl());
        return ResponseEntity.ok(Map.of("url", attachment.getUrl()));
    }
}
