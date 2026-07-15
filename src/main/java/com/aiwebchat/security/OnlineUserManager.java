package com.aiwebchat.security;

import com.aiwebchat.entity.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 内存中的 token ↔ 用户映射，支持单一活跃会话（同一用户登录会让旧 token 失效）。
 */
@Slf4j
@Component
public class OnlineUserManager {

    private final ConcurrentHashMap<String, User> tokenToUser = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, String> userToToken = new ConcurrentHashMap<>();

    /**
     * 为用户生成新 token；若已存在旧 token 则移除。
     */
    public String login(User user) {
        String oldToken = userToToken.get(user.getId());
        if (oldToken != null) {
            tokenToUser.remove(oldToken);
            log.info("User {} replaced previous token", user.getId());
        }
        String token = UUID.randomUUID().toString().replace("-", "");
        tokenToUser.put(token, user);
        userToToken.put(user.getId(), token);
        return token;
    }

    public void logout(String token) {
        User user = tokenToUser.remove(token);
        if (user != null) {
            userToToken.remove(user.getId());
        }
    }

    public Optional<User> getUser(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(tokenToUser.get(token));
    }
}
