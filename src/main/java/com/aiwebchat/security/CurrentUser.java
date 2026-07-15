package com.aiwebchat.security;

import com.aiwebchat.entity.User;
import jakarta.servlet.http.HttpServletRequest;

/**
 * HTTP 请求作用域的当前用户存取工具。
 */
public final class CurrentUser {

    public static final String REQUEST_ATTR = "currentUser";

    private CurrentUser() {
    }

    public static void set(HttpServletRequest request, User user) {
        request.setAttribute(REQUEST_ATTR, user);
    }

    public static User get(HttpServletRequest request) {
        return (User) request.getAttribute(REQUEST_ATTR);
    }
}
