package com.aiwebchat.security;

import com.aiwebchat.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final OnlineUserManager onlineUserManager;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 预检请求直接放行
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || authHeader.isBlank()) {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.getWriter().write("{\"error\":\"未提供认证 token\"}");
            response.setContentType("application/json;charset=UTF-8");
            return false;
        }

        // 支持 "Bearer <token>" 与纯 token 两种形式
        String token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : authHeader.trim();

        User user = onlineUserManager.getUser(token)
                .orElseThrow(() -> new com.aiwebchat.exception.BusinessException(HttpStatus.UNAUTHORIZED, "token 无效或已过期"));

        CurrentUser.set(request, user);
        return true;
    }
}
