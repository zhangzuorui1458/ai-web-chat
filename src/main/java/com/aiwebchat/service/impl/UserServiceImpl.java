package com.aiwebchat.service.impl;

import com.aiwebchat.dto.FriendRequestVO;
import com.aiwebchat.dto.UserVO;
import com.aiwebchat.entity.Friendship;
import com.aiwebchat.entity.User;
import com.aiwebchat.exception.BusinessException;
import com.aiwebchat.repository.FriendshipRepository;
import com.aiwebchat.repository.UserRepository;
import com.aiwebchat.service.NotifyService;
import com.aiwebchat.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;
    private final NotifyService notifyService;

    @Override
    public User getUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("用户不存在: " + id));
    }

    @Override
    public String getDisplayName(User user) {
        return (user.getNickname() == null || user.getNickname().isBlank())
                ? user.getUsername() : user.getNickname();
    }

    @Override
    public List<UserVO> searchUsers(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return List.of();
        }
        return userRepository.searchByKeyword(keyword.trim()).stream()
                .map(this::toVO)
                .toList();
    }

    @Override
    public List<UserVO> listFriends(Long userId) {
        List<Friendship> friendships = friendshipRepository.findByUserIdAndStatus(userId, Friendship.Status.ACCEPTED);
        return friendships.stream()
                .map(f -> userRepository.findById(f.getFriendId()).orElse(null))
                .filter(java.util.Objects::nonNull)
                .map(this::toVO)
                .toList();
    }

    @Override
    @Transactional
    public void addFriend(Long userId, Long targetUserId) {
        if (userId.equals(targetUserId)) {
            throw BusinessException.badRequest("不能添加自己为好友");
        }
        getUserById(targetUserId);

        Optional<Friendship> existing = friendshipRepository.findByUserIdAndFriendId(userId, targetUserId);
        if (existing.isPresent()) {
            Friendship f = existing.get();
            if (f.getStatus() == Friendship.Status.ACCEPTED) {
                throw BusinessException.badRequest("你们已经是好友");
            }
            if (f.getStatus() == Friendship.Status.PENDING) {
                throw BusinessException.badRequest("已发送过好友申请，等待对方确认");
            }
            f.setStatus(Friendship.Status.PENDING);
            friendshipRepository.save(f);
        } else {
            Friendship friendship = Friendship.builder()
                    .userId(userId)
                    .friendId(targetUserId)
                    .status(Friendship.Status.PENDING)
                    .build();
            friendshipRepository.save(friendship);
        }

        // 推送好友申请通知给对方
        User fromUser = getUserById(userId);
        FriendRequestVO vo = FriendRequestVO.builder()
                .fromUserId(userId)
                .fromUsername(fromUser.getUsername())
                .fromNickname(fromUser.getNickname())
                .fromAvatar(fromUser.getAvatar())
                .status(Friendship.Status.PENDING)
                .build();
        notifyService.notifyUser(targetUserId, "FRIEND_REQUEST", vo);
    }

    @Override
    @Transactional
    public void acceptFriendRequest(Long requestId, Long currentUserId) {
        Friendship request = friendshipRepository.findById(requestId)
                .orElseThrow(() -> BusinessException.notFound("好友申请不存在"));
        if (!request.getFriendId().equals(currentUserId)) {
            throw BusinessException.badRequest("无权处理此好友申请");
        }
        if (request.getStatus() != Friendship.Status.PENDING) {
            throw BusinessException.badRequest("该申请已被处理");
        }
        request.setStatus(Friendship.Status.ACCEPTED);
        friendshipRepository.save(request);

        friendshipRepository.findByUserIdAndFriendId(currentUserId, request.getUserId())
                .ifPresentOrElse(
                        reverse -> {
                            reverse.setStatus(Friendship.Status.ACCEPTED);
                            friendshipRepository.save(reverse);
                        },
                        () -> {
                            Friendship reverse = Friendship.builder()
                                    .userId(currentUserId)
                                    .friendId(request.getUserId())
                                    .status(Friendship.Status.ACCEPTED)
                                    .build();
                            friendshipRepository.save(reverse);
                        }
                );

        // 通知申请方：好友申请已通过
        notifyService.notifyUser(request.getUserId(), "FRIEND_HANDLED",
                Map.of("requestId", requestId, "action", "ACCEPTED", "byUserId", currentUserId));
    }

    @Override
    @Transactional
    public void rejectFriendRequest(Long requestId, Long currentUserId) {
        Friendship request = friendshipRepository.findById(requestId)
                .orElseThrow(() -> BusinessException.notFound("好友申请不存在"));
        if (!request.getFriendId().equals(currentUserId)) {
            throw BusinessException.badRequest("无权处理此好友申请");
        }
        if (request.getStatus() != Friendship.Status.PENDING) {
            throw BusinessException.badRequest("该申请已被处理");
        }
        request.setStatus(Friendship.Status.REJECTED);
        friendshipRepository.save(request);

        notifyService.notifyUser(request.getUserId(), "FRIEND_HANDLED",
                Map.of("requestId", requestId, "action", "REJECTED", "byUserId", currentUserId));
    }

    @Override
    public List<FriendRequestVO> listPendingRequests(Long currentUserId) {
        List<Friendship> requests = friendshipRepository.findByFriendIdAndStatus(currentUserId, Friendship.Status.PENDING);
        return requests.stream()
                .map(f -> {
                    User from = userRepository.findById(f.getUserId()).orElse(null);
                    return FriendRequestVO.builder()
                            .id(f.getId())
                            .fromUserId(f.getUserId())
                            .fromUsername(from == null ? null : from.getUsername())
                            .fromNickname(from == null ? null : from.getNickname())
                            .fromAvatar(from == null ? null : from.getAvatar())
                            .status(f.getStatus())
                            .createTime(f.getCreateTime())
                            .build();
                })
                .sorted(Comparator.comparing(FriendRequestVO::getCreateTime).reversed())
                .toList();
    }

    @Override
    @Transactional
    public void updateAvatar(Long userId, String avatarUrl) {
        User user = getUserById(userId);
        user.setAvatar(avatarUrl);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void updateProfile(Long userId, String signature) {
        if (signature != null && signature.length() > 200) {
            throw BusinessException.badRequest("签名最长 200 字");
        }
        User user = getUserById(userId);
        user.setSignature(signature);
        userRepository.save(user);
    }

    @Override
    public UserVO getCurrentUserInfo(Long userId) {
        return toVO(getUserById(userId));
    }

    private UserVO toVO(User u) {
        return UserVO.builder()
                .id(u.getId())
                .username(u.getUsername())
                .nickname(u.getNickname())
                .avatar(u.getAvatar())
                .signature(u.getSignature())
                .build();
    }
}
