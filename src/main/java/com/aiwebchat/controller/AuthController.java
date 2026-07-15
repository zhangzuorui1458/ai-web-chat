package com.aiwebchat.controller;

import com.aiwebchat.dto.LoginRequest;
import com.aiwebchat.dto.LoginResponse;
import com.aiwebchat.dto.RegisterRequest;
import com.aiwebchat.entity.User;
import com.aiwebchat.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterRequest request) {
        User user = authService.register(request);
        return ResponseEntity.ok(Map.of(
                "message", "注册成功",
                "userId", user.getId(),
                "username", user.getUsername()
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        String token = (authHeader != null && authHeader.startsWith("Bearer "))
                ? authHeader.substring(7).trim() : (authHeader == null ? "" : authHeader.trim());
        authService.logout(token);
        return ResponseEntity.ok(Map.of("message", "已退出登录"));
    }
}
