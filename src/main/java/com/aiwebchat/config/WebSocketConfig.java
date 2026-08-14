package com.aiwebchat.config;

import com.aiwebchat.security.StompAuthInterceptor;
import com.aiwebchat.security.WebSocketAuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthInterceptor webSocketAuthInterceptor;
    private final StompAuthInterceptor stompAuthInterceptor;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // 客户端订阅前缀：/topic/** 使用内置简单 broker
        // 注：不在此处启用 setHeartbeatValue，因 SimpleBroker 的 heartbeat 需依赖
        // TaskScheduler bean，部分环境下启动会失败。断线检测由前端指数退避重连兜底。
        registry.enableSimpleBroker("/topic");
        // 客户端发送消息前缀（本项目发送走 HTTP，此配置保留以备扩展）
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .addInterceptors(webSocketAuthInterceptor)
                .setAllowedOriginPatterns(
                        "http://localhost:*",
                        "http://127.0.0.1:*",
                        "https://localhost:*",
                        "https://127.0.0.1:*"
                        // 生产环境请在此追加实际域名
                )
                .withSockJS();
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registry) {
        // 允许较大的消息体（文件消息等）
        registry.setMessageSizeLimit(512 * 1024);
        registry.setSendBufferSizeLimit(1024 * 1024);
        registry.setSendTimeLimit(20000);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // 在 STOMP CONNECT 帧中校验 Authorization header 的 token
        registration.interceptors(stompAuthInterceptor);
    }
}
