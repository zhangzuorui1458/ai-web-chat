package com.aiwebchat.controller;

import com.aiwebchat.dto.*;
import com.aiwebchat.entity.User;
import com.aiwebchat.security.CurrentUser;
import com.aiwebchat.service.FileService;
import com.aiwebchat.service.MessageService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final FileService fileService;

    @PostMapping
    public ResponseEntity<MessageVO> send(@Valid @RequestBody MessageSendRequest request,
                                          HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        return ResponseEntity.ok(messageService.sendMessage(request, current));
    }

    @GetMapping("/private")
    public ResponseEntity<List<MessageVO>> privateHistory(@RequestParam("peerId") Long peerId,
                                                          HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        return ResponseEntity.ok(messageService.listPrivateHistory(current.getId(), peerId));
    }

    @GetMapping("/group")
    public ResponseEntity<List<MessageVO>> groupHistory(@RequestParam("groupId") Long groupId) {
        return ResponseEntity.ok(messageService.listGroupHistory(groupId));
    }

    @PostMapping("/upload")
    public ResponseEntity<AttachmentVO> upload(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(fileService.upload(file));
    }

    @PostMapping("/{id}/recall")
    public ResponseEntity<MessageVO> recall(@PathVariable("id") Long messageId,
                                            HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        return ResponseEntity.ok(messageService.recallMessage(messageId, current));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable("id") Long messageId,
                                                      HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        messageService.deleteMessage(messageId, current);
        return ResponseEntity.ok(Map.of("message", "消息已删除"));
    }

    @PostMapping("/read")
    public ResponseEntity<Map<String, String>> markRead(@Valid @RequestBody MessageReadRequest request,
                                                        HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        messageService.markRead(request, current);
        return ResponseEntity.ok(Map.of("message", "已标记已读"));
    }

    @GetMapping("/unread")
    public ResponseEntity<List<UnreadVO>> unread(HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        return ResponseEntity.ok(messageService.listUnread(current.getId()));
    }

    @GetMapping("/conversations")
    public ResponseEntity<List<ConversationVO>> conversations(HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        return ResponseEntity.ok(messageService.listConversations(current.getId()));
    }
}
