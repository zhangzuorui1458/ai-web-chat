package com.aiwebchat.controller;

import com.aiwebchat.dto.ChangePasswordRequest;
import com.aiwebchat.dto.FriendRequestVO;
import com.aiwebchat.dto.UserVO;
import com.aiwebchat.entity.User;
import com.aiwebchat.security.CurrentUser;
import com.aiwebchat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/users/me")
    public ResponseEntity<UserVO> me(HttpServletRequest request) {
        User current = CurrentUser.get(request);
        return ResponseEntity.ok(userService.getCurrentUserInfo(current.getId()));
    }

    @PutMapping("/users/me/profile")
    public ResponseEntity<Map<String, String>> updateProfile(@RequestBody Map<String, String> body,
                                                              HttpServletRequest request) {
        User current = CurrentUser.get(request);
        userService.updateProfile(current.getId(), body.get("signature"));
        return ResponseEntity.ok(Map.of("message", "已更新"));
    }

    @GetMapping("/users/search")
    public ResponseEntity<List<UserVO>> search(@RequestParam("keyword") String keyword) {
        return ResponseEntity.ok(userService.searchUsers(keyword));
    }

    @GetMapping("/friends")
    public ResponseEntity<List<UserVO>> myFriends(HttpServletRequest request) {
        User current = CurrentUser.get(request);
        return ResponseEntity.ok(userService.listFriends(current.getId()));
    }

    @PostMapping("/friends/{userId}")
    public ResponseEntity<Map<String, String>> addFriend(@PathVariable("userId") Long targetUserId,
                                                         HttpServletRequest request) {
        User current = CurrentUser.get(request);
        userService.addFriend(current.getId(), targetUserId);
        return ResponseEntity.ok(Map.of("message", "好友申请已发送"));
    }

    @PostMapping("/friends/{id}/accept")
    public ResponseEntity<Map<String, String>> accept(@PathVariable("id") Long requestId,
                                                      HttpServletRequest request) {
        User current = CurrentUser.get(request);
        userService.acceptFriendRequest(requestId, current.getId());
        return ResponseEntity.ok(Map.of("message", "已接受好友申请"));
    }

    @PostMapping("/friends/{id}/reject")
    public ResponseEntity<Map<String, String>> reject(@PathVariable("id") Long requestId,
                                                      HttpServletRequest request) {
        User current = CurrentUser.get(request);
        userService.rejectFriendRequest(requestId, current.getId());
        return ResponseEntity.ok(Map.of("message", "已拒绝好友申请"));
    }

    @GetMapping("/friends/requests")
    public ResponseEntity<List<FriendRequestVO>> pendingRequests(HttpServletRequest request) {
        User current = CurrentUser.get(request);
        return ResponseEntity.ok(userService.listPendingRequests(current.getId()));
    }

    @PutMapping("/users/me/password")
    public ResponseEntity<Map<String, String>> changePassword(@Valid @RequestBody ChangePasswordRequest body,
                                                               HttpServletRequest request) {
        User current = CurrentUser.get(request);
        userService.changePassword(current.getId(), body.getOldPassword(), body.getNewPassword());
        return ResponseEntity.ok(Map.of("message", "密码已修改"));
    }
}
