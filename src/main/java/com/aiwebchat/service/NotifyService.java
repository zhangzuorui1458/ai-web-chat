package com.aiwebchat.service;

public interface NotifyService {

    /**
     * 向指定用户推送系统通知。
     */
    void notifyUser(Long userId, String type, Object payload);
}
