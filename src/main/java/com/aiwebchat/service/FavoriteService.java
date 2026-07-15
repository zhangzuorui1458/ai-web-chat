package com.aiwebchat.service;

import com.aiwebchat.dto.FavoriteVO;

import java.util.List;

public interface FavoriteService {

    FavoriteVO addFavorite(Long userId, Long messageId, String note);

    List<FavoriteVO> listMyFavorites(Long userId);

    FavoriteVO updateNote(Long favoriteId, Long userId, String note);

    void removeFavorite(Long favoriteId, Long userId);
}
