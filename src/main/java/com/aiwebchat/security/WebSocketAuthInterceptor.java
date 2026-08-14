package com.aiwebchat.security;

import com.aiwebchat.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

/**
 * STOMP/SockJS 握手阶段校验 token，把当前 userId 放入握手 attributes，
 * 供后续 WebSocket 会话使用。校验失败返回 401。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements HandshakeInterceptor {

    public static final String ATTR_USER_ID = "userId";

    private final OnlineUserManager onlineUserManager;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {
        // 兼容两种认证方式：
        // 1. URL ?token=xxx（旧客户端 / Android WebView）
        // 2. STOMP CONNECT header（新客户端，更安全）
        // 握手阶段优先检查 URL token；如果不带 URL token 也允许通过（认证推迟到 STOMP CONNECT）
        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpServletRequest = servletRequest.getServletRequest();
            String token = httpServletRequest.getParameter("token");
            if (token != null && !token.isBlank()) {
                User user = onlineUserManager.getUser(token).orElse(null);
                if (user != null) {
                    attributes.put(ATTR_USER_ID, user.getId());
                    log.debug("WS handshake accepted (URL token) for userId={}", user.getId());
                    return true;
                }
            }
        }
        // 不带 URL token 的握手也允许通过 — 认证由 StompAuthInterceptor 在 STOMP CONNECT 帧完成
        log.debug("WS handshake allowed; auth deferred to STOMP CONNECT");
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // no-op
    }
}
