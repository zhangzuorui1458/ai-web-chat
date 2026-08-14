package com.aiwebchat.controller;

import com.aiwebchat.dto.*;
import com.aiwebchat.entity.User;
import com.aiwebchat.security.CurrentUser;
import com.aiwebchat.service.FileService;
import com.aiwebchat.service.GroupService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final FileService fileService;

    @PostMapping
    public ResponseEntity<GroupVO> create(@Valid @RequestBody GroupCreateRequest request,
                                          HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        return ResponseEntity.ok(groupService.createGroup(request.getName(), current.getId(), request.getMemberIds()));
    }

    @GetMapping
    public ResponseEntity<List<GroupVO>> myGroups(HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        return ResponseEntity.ok(groupService.listMyGroups(current.getId()));
    }

    @GetMapping("/{groupId}/members")
    public ResponseEntity<List<UserVO>> members(@PathVariable("groupId") Long groupId) {
        return ResponseEntity.ok(groupService.listMembers(groupId));
    }

    @PutMapping("/{groupId}")
    public ResponseEntity<Map<String, String>> updateGroup(@PathVariable("groupId") Long groupId,
                                                            @RequestBody Map<String, String> body,
                                                            HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        groupService.updateGroupInfo(groupId, current.getId(), body.get("name"), body.get("avatar"));
        return ResponseEntity.ok(Map.of("message", "已更新"));
    }

    @PostMapping("/{groupId}/avatar")
    public ResponseEntity<Map<String, String>> uploadGroupAvatar(@PathVariable("groupId") Long groupId,
                                                                  @RequestParam("file") MultipartFile file,
                                                                  HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        AttachmentVO attachment = fileService.upload(file);
        groupService.updateGroupInfo(groupId, current.getId(), null, attachment.getUrl());
        return ResponseEntity.ok(Map.of("url", attachment.getUrl()));
    }

    @PostMapping("/{groupId}/members/{userId}")
    public ResponseEntity<Map<String, String>> invite(@PathVariable("groupId") Long groupId,
                                                      @PathVariable("userId") Long userId) {
        groupService.inviteMember(groupId, userId);
        return ResponseEntity.ok(Map.of("message", "用户已加入群组"));
    }

    // ==================== 群邀请审批 ====================

    @PostMapping("/{groupId}/invitations")
    public ResponseEntity<List<GroupInvitationVO>> createInvitations(
            @PathVariable("groupId") Long groupId,
            @Valid @RequestBody GroupInvitationRequest request,
            HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        return ResponseEntity.ok(groupService.createInvitations(groupId, current.getId(), request.getInviteeIds()));
    }

    @GetMapping("/invitations/pending")
    public ResponseEntity<List<GroupInvitationVO>> pendingInvitations(HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        return ResponseEntity.ok(groupService.listPendingInvitations(current.getId()));
    }

    @PostMapping("/invitations/{id}/accept")
    public ResponseEntity<Map<String, String>> acceptInvitation(
            @PathVariable("id") Long invitationId,
            HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        groupService.acceptInvitation(invitationId, current.getId());
        return ResponseEntity.ok(Map.of("message", "已接受群邀请"));
    }

    @PostMapping("/invitations/{id}/reject")
    public ResponseEntity<Map<String, String>> rejectInvitation(
            @PathVariable("id") Long invitationId,
            HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        groupService.rejectInvitation(invitationId, current.getId());
        return ResponseEntity.ok(Map.of("message", "已拒绝群邀请"));
    }
}
