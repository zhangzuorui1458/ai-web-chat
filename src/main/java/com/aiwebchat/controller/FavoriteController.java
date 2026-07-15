package com.aiwebchat.controller;

import com.aiwebchat.dto.FavoriteNoteRequest;
import com.aiwebchat.dto.FavoriteRequest;
import com.aiwebchat.dto.FavoriteVO;
import com.aiwebchat.entity.User;
import com.aiwebchat.security.CurrentUser;
import com.aiwebchat.service.FavoriteService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
public class FavoriteController {

    private final FavoriteService favoriteService;

    /** 收藏消息（已收藏则更新笔记） */
    @PostMapping
    public ResponseEntity<FavoriteVO> add(@Valid @RequestBody FavoriteRequest request,
                                          HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        return ResponseEntity.ok(favoriteService.addFavorite(current.getId(), request.getMessageId(), request.getNote()));
    }

    /** 我的收藏列表 */
    @GetMapping
    public ResponseEntity<List<FavoriteVO>> list(HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        return ResponseEntity.ok(favoriteService.listMyFavorites(current.getId()));
    }

    /** 修改收藏笔记 */
    @PutMapping("/{id}")
    public ResponseEntity<FavoriteVO> updateNote(@PathVariable("id") Long favoriteId,
                                                  @Valid @RequestBody FavoriteNoteRequest request,
                                                  HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        return ResponseEntity.ok(favoriteService.updateNote(favoriteId, current.getId(), request.getNote()));
    }

    /** 取消收藏 */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> remove(@PathVariable("id") Long favoriteId,
                                                       HttpServletRequest httpRequest) {
        User current = CurrentUser.get(httpRequest);
        favoriteService.removeFavorite(favoriteId, current.getId());
        return ResponseEntity.ok(Map.of("message", "已取消收藏"));
    }
}
