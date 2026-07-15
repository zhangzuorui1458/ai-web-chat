package com.aiwebchat.service.impl;

import com.aiwebchat.dto.LoginRequest;
import com.aiwebchat.dto.LoginResponse;
import com.aiwebchat.dto.RegisterRequest;
import com.aiwebchat.entity.User;
import com.aiwebchat.exception.BusinessException;
import com.aiwebchat.repository.UserRepository;
import com.aiwebchat.security.OnlineUserManager;
import com.aiwebchat.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final OnlineUserManager onlineUserManager;

    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();

    @Override
    @Transactional
    public User register(RegisterRequest request) {
        userRepository.findByUsername(request.getUsername()).ifPresent(u -> {
            throw BusinessException.conflict("用户名已被占用");
        });

        User user = User.builder()
                .username(request.getUsername())
                .password(PASSWORD_ENCODER.encode(request.getPassword()))
                .nickname(request.getNickname() == null || request.getNickname().isBlank()
                        ? request.getUsername() : request.getNickname())
                .build();
        return userRepository.save(user);
    }

    @Override
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> BusinessException.unauthorized("用户名或密码错误"));
        if (!PASSWORD_ENCODER.matches(request.getPassword(), user.getPassword())) {
            throw BusinessException.unauthorized("用户名或密码错误");
        }
        String token = onlineUserManager.login(user);
        log.info("User {} logged in", user.getId());
        return LoginResponse.builder()
                .token(token)
                .userId(user.getId())
                .username(user.getUsername())
                .nickname(user.getNickname())
                .avatar(user.getAvatar())
                .build();
    }

    @Override
    public void logout(String token) {
        if (token != null && !token.isBlank()) {
            onlineUserManager.logout(token);
        }
    }
}
