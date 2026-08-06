package com.aiwebchat.service;

import com.aiwebchat.dto.FriendRequestVO;
import com.aiwebchat.dto.UserVO;
import com.aiwebchat.entity.User;

import java.util.List;

public interface UserService {

    User getUserById(Long id);

    String getDisplayName(User user);

    List<UserVO> searchUsers(String keyword);

    List<UserVO> listFriends(Long userId);

    void addFriend(Long userId, Long targetUserId);

    void acceptFriendRequest(Long requestId, Long currentUserId);

    void rejectFriendRequest(Long requestId, Long currentUserId);

    List<FriendRequestVO> listPendingRequests(Long currentUserId);

    void updateAvatar(Long userId, String avatarUrl);

    void updateProfile(Long userId, String signature);

    UserVO getCurrentUserInfo(Long userId);
}
