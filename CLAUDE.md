# CLAUDE.md

请始终使用简体中文与我对话，主要是 Java coding 任务，并在回答时保持专业、简洁。请叫我索大。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ai-web-chat is a Spring Boot 4.0.6 application (Java 17) implementing a browser-based instant messaging system with **user accounts, private chat, and group chat**. It uses STOMP over WebSocket (with SockJS fallback) for real-time message delivery, and persists messages in an H2 file database.

**Group ID**: `com.aiwebchat` | **Artifact ID**: `ai-web-chat` | **Version**: `0.0.1-SNAPSHOT`

## Build & Run Commands

```bash
# Build (Windows)
mvnw.cmd clean install

# Run (Windows)
mvnw.cmd spring-boot:run

# Run tests
mvnw.cmd test
```

After startup, open `http://localhost:8080` in a browser. H2 console is at `http://localhost:8080/h2-console` (JDBC URL `jdbc:h2:file:./data/webchat`).

## Technology Stack

- **Framework**: Spring Boot 4.0.6
- **Java**: 17
- **ORM**: Spring Data JPA with Hibernate (`ddl-auto=update`)
- **Database**: H2 file-based (persistent), console enabled
- **Realtime**: spring-boot-starter-websocket (STOMP + SockJS)
- **Auth**: In-memory UUID token (`ConcurrentHashMap`), BCrypt password hashing via `spring-security-crypto`
- **Build**: Maven with wrapper (Maven 3.9.15)
- **Annotation Processing**: Lombok

## Architecture

```
HTTP 请求 ──> AuthInterceptor (token 校验) ──> Controller ──> Service ──> Repository
                                                                    │
                                                                    └─> 入库后通过 SimpMessagingTemplate 推送
                                                                         到 /topic/user.{id} 或 /topic/group.{id}

WebSocket 握手 ──> WebSocketAuthInterceptor (URL ?token= 校验)
```

Messages are sent via HTTP `POST /api/messages` (transactional, persisted) and pushed to recipients over WebSocket subscriptions. Clients subscribe to `/topic/user.{ownUserId}` for private messages and `/topic/group.{groupId}` for group messages.

## Project Structure

```
src/main/java/com/aiwebchat/
├── WebChatApplication.java        # Entry point
├── config/                         # WebSocketConfig, WebConfig (interceptors + CORS)
├── security/                       # AuthInterceptor, WebSocketAuthInterceptor, OnlineUserManager
├── controller/                     # AuthController, UserController, GroupController, MessageController
├── entity/                         # JPA entities: User, Friendship, ChatGroup, GroupMember, Message
├── repository/                     # Spring Data JPA repositories
├── service/                        # Service interfaces + impl/ implementations
├── dto/                            # Request/response DTOs and VOs
└── exception/                      # GlobalExceptionHandler (@RestControllerAdvice)
```

## Coding Conventions

- Entities: `@Data @Builder @NoArgsConstructor @AllArgsConstructor @Entity`, `@PrePersist` for timestamps, embedded enums with `@Enumerated(EnumType.STRING)`
- Services: interface in `service/`, implementation in `service/impl/` with `@RequiredArgsConstructor` constructor injection
- Controllers: `@RestController`, return raw DTO/VO or `ResponseEntity`, `@CrossOrigin` handled globally
- Auth: `Authorization` header carries the token; `AuthInterceptor` stores the current `User` in request attribute `"currentUser"`

## API Endpoints (all under `/api`)

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/users/search`, `GET /api/friends`, `POST /api/friends/{userId}`, `POST /api/friends/{id}/accept|reject`, `GET /api/friends/requests`
- `POST /api/groups`, `GET /api/groups`, `GET /api/groups/{groupId}/members`, `POST /api/groups/{groupId}/members/{userId}`
- `POST /api/messages`, `GET /api/messages/private?peerId=`, `GET /api/messages/group?groupId=`

All endpoints except `/api/auth/register` and `/api/auth/login` require the `Authorization` header.

## Data Model

Tables (H2, auto-created by Hibernate): `user`, `friendship`, `chat_group`, `group_member`, `message`. See entities for column details.
