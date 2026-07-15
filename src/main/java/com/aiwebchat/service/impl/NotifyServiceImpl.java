package com.aiwebchat.service.impl;

import com.aiwebchat.dto.NotifyVO;
import com.aiwebchat.service.NotifyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotifyServiceImpl implements NotifyService {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public void notifyUser(Long userId, String type, Object payload) {
        NotifyVO notify = NotifyVO.of(type, payload);
        messagingTemplate.convertAndSend("/topic/notify." + userId, notify);
        log.debug("Notify user {}: type={}", userId, type);
    }
}
