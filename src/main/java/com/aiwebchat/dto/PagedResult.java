package com.aiwebchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 通用分页结果包装。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PagedResult<T> {

    private List<T> items;
    private long total;
    private int totalPages;
    private int page;
    private int size;
    private boolean hasMore;

    public static <T> PagedResult<T> of(List<T> items, long total, int totalPages, int page, int size) {
        return PagedResult.<T>builder()
                .items(items)
                .total(total)
                .totalPages(totalPages)
                .page(page)
                .size(size)
                .hasMore(page + 1 < totalPages)
                .build();
    }
}
