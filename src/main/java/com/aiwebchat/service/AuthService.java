package com.aiwebchat.service;

import com.aiwebchat.dto.LoginRequest;
import com.aiwebchat.dto.LoginResponse;
import com.aiwebchat.dto.RegisterRequest;
import com.aiwebchat.entity.User;

public interface AuthService {

    User register(RegisterRequest request);

    LoginResponse login(LoginRequest request);

    void logout(String token);
}
