package com.aiwebchat.security;

import com.aiwebchat.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * 在 STOMP CONNECT 帧中校验 Authorization header 中的 token，
 * 替代之前通过 URL query 参数传递 token 的方式（避免 token 泄露到日志/Referer）。
 *
 * 用法：前端在 stompClient.connect({Authorization: 'Bearer <token>'}, ...) 中传递。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StompAuthInterceptor implements ChannelInterceptor {

    private final OnlineUserManager onlineUserManager;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader == null || authHeader.isBlank()) {
                log.warn("STOMP CONNECT rejected: missing Authorization header");
                return null; // 拒绝连接
            }

            String token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : authHeader.trim();

            User user = onlineUserManager.getUser(token).orElse(null);
            if (user == null) {
                log.warn("STOMP CONNECT rejected: invalid or expired token");
                return null;
            }

            // 将 userId 存入 session attributes，供后续使用
            accessor.getSessionAttributes().put(WebSocketAuthInterceptor.ATTR_USER_ID, user.getId());
            log.debug("STOMP CONNECT accepted for userId={}", user.getId());
        }

        return message;
    }
}
